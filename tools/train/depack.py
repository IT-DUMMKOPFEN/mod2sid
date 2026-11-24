#!/usr/bin/env python3
"""Unpackers for Amiga module collections, pure Python (no external tools):
  - ZIP (stored, deflate, LZMA, XZ)       - 7-Zip (LZMA, LZMA2, copy; solid; encoded headers)
  - LHA/LZH (-lh0-, -lh5-, -lh6-, -lh7-)  - PowerPacker PP20 and Power Player SFCD/SFHD files
usage: depack.py <archive> <outdir>     (single crunched files are written decrunched)"""
import sys, os, struct, zlib, lzma


# ------------------------------------------------------------------ bit readers
class MsbBits:
    def __init__(self, data, pos=0):
        self.d, self.p, self.buf, self.n = data, pos, 0, 0

    def need(self, k):
        while self.n < k:
            self.buf = (self.buf << 8) | (self.d[self.p] if self.p < len(self.d) else 0)
            self.p += 1; self.n += 8

    def peek(self, k):
        self.need(k); return (self.buf >> (self.n - k)) & ((1 << k) - 1)

    def get(self, k):
        if k == 0: return 0
        v = self.peek(k); self.n -= k; self.buf &= (1 << self.n) - 1; return v


class Canon:
    """canonical Huffman code (MSB first), as built by LHA's make_table"""
    def __init__(self, lens):
        self.single = None
        mx = max(lens) if lens else 0
        self.cnt = [0] * (mx + 1); self.sym = [[] for _ in range(mx + 1)]
        for s, l in enumerate(lens):
            if l: self.cnt[l] += 1; self.sym[l].append(s)
        self.first = [0] * (mx + 2); c = 0
        for l in range(1, mx + 1):
            self.first[l] = c; c = (c + self.cnt[l]) << 1
        self.mx = mx

    def decode(self, br):
        if self.single is not None: return self.single
        code = 0
        for l in range(1, self.mx + 1):
            code = (code << 1) | br.get(1)
            k = code - self.first[l]
            if 0 <= k < self.cnt[l]: return self.sym[l][k]
        raise ValueError('bad huffman code')


# ------------------------------------------------------------------ LHA -lh5-/-lh6-/-lh7-
def lh_decode(data, outlen, dicbit):
    NC, NT, TBIT, CBIT = 510, 19, 5, 9
    NP = dicbit + 1; PBIT = 4 if dicbit <= 13 else 5
    br = MsbBits(data); out = bytearray(); blocksize = 0; ctab = ptab = None

    def read_pt_len(nn, nbit, special):
        n = br.get(nbit)
        if n == 0:
            t = Canon([]); t.single = br.get(nbit); return t, [0] * nn
        lens = [0] * nn; i = 0
        while i < n:
            c = br.peek(3)
            if c == 7:
                br.get(3)
                while br.get(1): c += 1
            else:
                br.get(3)
            lens[i] = c; i += 1
            if i == special:
                k = br.get(2)
                for _ in range(k): lens[i] = 0; i += 1
        return Canon(lens), lens

    def read_c_len(tt):
        n = br.get(CBIT)
        if n == 0:
            t = Canon([]); t.single = br.get(CBIT); return t
        lens = [0] * NC; i = 0
        while i < n:
            c = tt.decode(br)
            if c <= 2:
                k = 1 if c == 0 else (br.get(4) + 3 if c == 1 else br.get(CBIT) + 20)
                for _ in range(k): lens[i] = 0; i += 1
            else:
                lens[i] = c - 2; i += 1
        return Canon(lens)

    while len(out) < outlen:
        if blocksize == 0:
            blocksize = br.get(16)
            tt, _ = read_pt_len(NT, TBIT, 3)
            ctab = read_c_len(tt)
            ptab, _ = read_pt_len(NP, PBIT, -1)
        blocksize -= 1
        c = ctab.decode(br)
        if c < 256:
            out.append(c)
        else:
            ln = c - 256 + 3
            j = ptab.decode(br)
            if j: j = (1 << (j - 1)) + br.get(j - 1)
            s = len(out) - j - 1
            for k in range(ln):
                out.append(out[s + k] if s + k >= 0 else 0)
    return bytes(out[:outlen])


def lha_files(d):
    p = 0
    while p < len(d) - 21 and d[p]:
        hs, lvl = d[p], d[p + 20]
        meth = d[p + 2:p + 7].decode('latin-1')
        comp, orig = struct.unpack('<II', d[p + 7:p + 15])
        if lvl in (0, 1):
            nl = d[p + 21]; name = d[p + 22:p + 22 + nl].decode('latin-1')
            start = p + hs + 2
            if lvl == 1:  # extension headers follow, their size is included in comp
                q = start - 2
                while True:
                    es = struct.unpack('<H', d[q:q + 2])[0]
                    if es == 0: break
                    if d[q + 2] == 2 and es > 3: name = d[q + 3:q + es].decode('latin-1').replace('\xff', '/') + name
                    q += es; comp -= es
                start = q + 2
            body = d[start:start + comp]; p = start + comp
        elif lvl == 2:
            tot = struct.unpack('<H', d[p:p + 2])[0]; name = ''; q = p + 24
            while True:
                es = struct.unpack('<H', d[q:q + 2])[0]
                if es == 0: break
                t = d[q + 2]
                if t == 1: name = d[q + 3:q + es].decode('latin-1') + name
                if t == 2: name = d[q + 3:q + es].decode('latin-1').replace('\xff', '/') + '/' + name
                q += es
            body = d[p + tot:p + tot + comp]; p = p + tot + comp
        else:
            break
        if meth == '-lh0-': data = body[:orig]
        elif meth in ('-lh5-', '-lh6-', '-lh7-'):
            data = lh_decode(body, orig, {'-lh5-': 13, '-lh6-': 15, '-lh7-': 16}[meth])
        elif meth == '-lhd-': continue
        else: print('lha: unsupported', meth, name); continue
        yield name, data


# ------------------------------------------------------------------ PowerPacker
def pp20(d):
    if len(d) < 16 or d[:4] != b'PP20': return None
    offs = d[4:8]; outlen = int.from_bytes(d[-4:-1], 'big'); skip = d[-1]
    src = d[8:-4]; pos = len(src); buf = 0; left = 0
    out = bytearray(outlen); o = outlen; written = 0

    def bits(n):
        nonlocal pos, buf, left
        while left < n:
            pos -= 1; buf |= src[pos] << left; left += 8
        v = 0
        for _ in range(n): v = (v << 1) | (buf & 1); buf >>= 1
        left -= n; return v

    bits(skip)
    while written < outlen:
        if bits(1) == 0:
            todo = 1
            while True:
                x = bits(2); todo += x
                if x != 3: break
            for _ in range(todo): o -= 1; out[o] = bits(8); written += 1
            if written >= outlen: break
        x = bits(2); offbits = offs[x]; todo = x + 2
        if x == 3:
            if bits(1) == 0: offbits = 7
            off = bits(offbits)
            while True:
                y = bits(3); todo += y
                if y != 7: break
        else:
            off = bits(offbits)
        for _ in range(todo):
            o -= 1; out[o] = out[o + off + 1]; written += 1
    return bytes(out)


# ------------------------------------------------------------------ Power Player (LhLib, adaptive Huffman)
class DynHuff:
    def __init__(self, mc):
        self.mc = mc; n = mc * 2 - 1
        self.freq = [0] * n; self.idx = [0] * n; self.par = [0] * n; self.l = [0] * n; self.r = [0] * n; self.cmap = [0] * n
        for i in range(mc):
            self.freq[i] = 1; self.idx[i] = i; self.par[i] = mc + (i >> 1); self.cmap[i] = i
        j = 0
        for i in range(mc, n):
            self.freq[i] = self.freq[j] + self.freq[j + 1]; self.idx[i] = i; self.par[i] = mc + (i >> 1)
            self.l[i] = j; self.r[i] = j + 1; self.cmap[i] = i; j += 2

    def decode(self, bit):
        c = self.mc * 2 - 2
        while c >= self.mc: c = self.r[c] if bit() else self.l[c]
        return c

    def update(self, c):
        root = self.mc * 2 - 2
        while c != root:
            self.freq[c] += 1; i = self.idx[c]; dst = i; f = self.freq[c]
            while dst != root and f > self.freq[self.cmap[dst + 1]]: dst += 1
            if i != dst:
                dc = self.cmap[dst]
                pa, pb = self.par[c], self.par[dc]
                # swap the leaves in the parents
                if pa == pb:
                    self.l[pa], self.r[pa] = self.r[pa], self.l[pa]
                else:
                    if self.l[pa] == c: self.l[pa] = dc
                    else: self.r[pa] = dc
                    if self.l[pb] == dc: self.l[pb] = c
                    else: self.r[pb] = c
                self.idx[c], self.idx[dc] = self.idx[dc], self.idx[c]
                self.cmap[i], self.cmap[dst] = self.cmap[dst], self.cmap[i]
                self.par[c], self.par[dc] = self.par[dc], self.par[c]
            c = self.par[c]
        self.freq[c] += 1


def powerplayer(d):
    if d[:4] not in (b'SFCD', b'SFHD'): return None
    raw = struct.unpack('>I', d[4:8])[0]; packed = struct.unpack('>I', d[8:12])[0]
    src = d[12:12 + packed]
    # 16-bit big endian MSB-first bit reader
    words = src + b'\0\0\0\0'; st = {'p': 0, 'buf': 0, 'n': 0}

    def get(k):
        v = 0
        for _ in range(k):
            if st['n'] == 0:
                st['buf'] = (words[st['p']] << 8) | words[st['p'] + 1]; st['p'] += 2; st['n'] = 16
            st['n'] -= 1; v = (v << 1) | ((st['buf'] >> st['n']) & 1)
        return v

    bl = [5, 5, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10]; offs = []; acc = 0
    for b in bl: offs.append(acc); acc += 1 << b
    h = DynHuff(317); out = bytearray()
    while len(out) < raw:
        c = h.decode(lambda: get(1))
        if c == 316: break
        if h.freq[317 * 2 - 2] < 0x8000: h.update(c)
        if c < 256: out.append(c)
        else:
            b = get(4); dist = offs[b] + get(bl[b]); cnt = c - 255
            if dist:
                s = len(out) - dist
                for k in range(cnt): out.append(out[s + k] if s + k >= 0 else 0)
            else:
                out.extend(b'\0' * cnt)
    ln = len(out)
    if d[:4] == b'SFCD':
        c = 0
        for i in range(ln): c = (c + out[i]) & 255; out[i] = c
        if ln < raw: out.extend(bytes([out[-1] if out else 0]) * (raw - ln))
    else:
        out.extend(b'\0' * (raw - ln))
    return bytes(out[:raw])


def decrunch(d):
    for f in (pp20, powerplayer):
        try:
            r = f(d)
            if r: return r
        except Exception as e:
            print('decrunch failed:', e)
    return d


# ------------------------------------------------------------------ ZIP
def zip_files(d):
    e = d.rfind(b'PK\x05\x06'); n = struct.unpack('<H', d[e + 10:e + 12])[0]; p = struct.unpack('<I', d[e + 16:e + 20])[0]
    for _ in range(n):
        f = struct.unpack('<IHHHHHHIIIHHHHHII', d[p:p + 46])
        flg, meth, csz, usz, nl, xl, cl, lho = f[3], f[4], f[8], f[9], f[10], f[11], f[12], f[16]
        name = d[p + 46:p + 46 + nl].decode('utf-8' if flg & 0x800 else 'cp437'); p += 46 + nl + xl + cl
        if name.endswith('/') or '__MACOSX' in name: continue
        lnl, lxl = struct.unpack('<HH', d[lho + 26:lho + 30]); s = lho + 30 + lnl + lxl; raw = d[s:s + csz]
        if meth == 0: b = raw
        elif meth == 8: b = zlib.decompress(raw, -15)
        elif meth == 95: b = lzma.decompress(raw, format=lzma.FORMAT_XZ)
        elif meth == 14:
            ps = struct.unpack('<H', raw[2:4])[0]
            flt = lzma._decode_filter_properties(lzma.FILTER_LZMA1, raw[4:4 + ps])
            b = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[flt]).decompress(raw[4 + ps:], max_length=usz)
        else: print('zip: unsupported method', meth, name); continue
        yield name, b[:usz]


# ------------------------------------------------------------------ 7-Zip
class R7:
    def __init__(self, b): self.b, self.p = b, 0
    def byte(self): v = self.b[self.p]; self.p += 1; return v
    def num(self):
        f = self.byte(); mask = 0x80; v = 0
        for i in range(8):
            if not f & mask:
                hi = f & (mask - 1); return v | (hi << (8 * i))
            v |= self.byte() << (8 * i); mask >>= 1
        return v
    def bits(self, n):
        out = []; m = 0; c = 0
        for _ in range(n):
            if m == 0: c = self.byte(); m = 0x80
            out.append(bool(c & m)); m >>= 1
        return out
    def deflist(self, n):
        allset = self.byte()
        return [True] * n if allset else self.bits(n)


def sz_streams(r):
    info = {'packpos': 0, 'packsizes': [], 'folders': [], 'unpack': [], 'nsub': None, 'subsizes': None}
    while True:
        t = r.byte()
        if t == 0: break
        if t == 6:
            info['packpos'] = r.num(); n = r.num()
            while True:
                u = r.byte()
                if u == 0: break
                if u == 9: info['packsizes'] = [r.num() for _ in range(n)]
                elif u == 10:
                    dl = r.deflist(n); r.p += 4 * sum(dl)
        elif t == 7:
            assert r.byte() == 11
            nf = r.num(); assert r.byte() == 0
            for _ in range(nf):
                coders = []; tin = tout = 0
                for _ in range(r.num()):
                    fl = r.byte(); cid = r.b[r.p:r.p + (fl & 15)]; r.p += fl & 15
                    ni = no = 1
                    if fl & 0x10: ni = r.num(); no = r.num()
                    props = b''
                    if fl & 0x20: ps = r.num(); props = r.b[r.p:r.p + ps]; r.p += ps
                    coders.append((cid, props, ni, no)); tin += ni; tout += no
                pairs = [(r.num(), r.num()) for _ in range(tout - 1)]
                npk = tin - len(pairs)
                if npk > 1: [r.num() for _ in range(npk)]
                info['folders'].append({'coders': coders, 'pairs': pairs, 'tout': tout})
            assert r.byte() == 12
            for f in info['folders']: f['sizes'] = [r.num() for _ in range(f['tout'])]
            while True:
                u = r.byte()
                if u == 0: break
                if u == 10:
                    dl = r.deflist(len(info['folders'])); r.p += 4 * sum(dl)
        elif t == 8:
            nf = len(info['folders']); nsub = [1] * nf; sizes = None
            while True:
                u = r.byte()
                if u == 0: break
                if u == 13: nsub = [r.num() for _ in range(nf)]
                elif u == 9:
                    sizes = []
                    for k, f in enumerate(info['folders']):
                        if nsub[k] == 0: continue
                        tot = folder_size(f); acc = 0
                        for _ in range(nsub[k] - 1): s = r.num(); sizes.append(s); acc += s
                        sizes.append(tot - acc)
                elif u == 10:
                    ndig = sum(nsub)
                    dl = r.deflist(ndig); r.p += 4 * sum(dl)
            info['nsub'] = nsub; info['subsizes'] = sizes
    return info


def folder_size(f):
    bound = {o for _, o in f['pairs']}
    for i in range(f['tout']):
        if i not in bound: return f['sizes'][i]
    return f['sizes'][-1]


def sz_unpack_folder(f, data):
    out = data
    # simple chains only: each coder feeds the next (filters like BCJ are not used for music archives)
    for cid, props, _, _ in reversed(f['coders']) if len(f['coders']) > 1 else f['coders']:
        if cid == b'\x00': continue
        if cid == b'\x03\x01\x01':
            flt = lzma._decode_filter_properties(lzma.FILTER_LZMA1, props)
            out = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[flt]).decompress(out, max_length=folder_size(f))
        elif cid == b'\x21':
            flt = lzma._decode_filter_properties(lzma.FILTER_LZMA2, props)
            out = lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=[flt]).decompress(out)
        else:
            raise ValueError('7z: unsupported coder ' + cid.hex())
    return out


def sz_files(d):
    noff, nsize = struct.unpack('<QQ', d[12:28])
    hdr = d[32 + noff:32 + noff + nsize]
    r = R7(hdr)
    if r.byte() == 0x17:  # encoded header
        info = sz_streams(r)
        pp = 32 + info['packpos']
        hdr = sz_unpack_folder(info['folders'][0], d[pp:pp + info['packsizes'][0]])
        r = R7(hdr); assert r.byte() == 1
    main = None; names = []; empty = []
    while True:
        t = r.byte()
        if t == 0: break
        if t == 4: main = sz_streams(r)
        elif t == 5:
            nfiles = r.num(); empty = [False] * nfiles
            while True:
                pt = r.byte()
                if pt == 0: break
                sz = r.num(); end = r.p + sz
                if pt == 14: empty = r.bits(nfiles)
                elif pt == 17:
                    r.byte(); raw = r.b[r.p:end]
                    names = raw.decode('utf-16-le').split('\0')[:nfiles]
                r.p = end
        else:
            raise ValueError('7z header type %d' % t)
    # walk folders
    pos = 32 + main['packpos']; fi = 0; si = 0
    nsub = main['nsub'] or [1] * len(main['folders'])
    sizes = main['subsizes'] or [folder_size(f) for f in main['folders']]
    for k, f in enumerate(main['folders']):
        psz = main['packsizes'][k]
        blob = sz_unpack_folder(f, d[pos:pos + psz]); pos += psz; off = 0
        for _ in range(nsub[k]):
            while fi < len(names) and empty[fi]: fi += 1
            if fi >= len(names): break
            yield names[fi], blob[off:off + sizes[si]]; off += sizes[si]; si += 1; fi += 1


def unpack(path, outdir):
    d = open(path, 'rb').read(); n = 0
    if d[:4] == b'PK\x03\x04': it = zip_files(d)
    elif d[:6] == b"7z\xbc\xaf'\x1c": it = sz_files(d)
    elif len(d) > 21 and d[2:4] == b'-l' and d[6:7] == b'-': it = lha_files(d)
    else: it = [(os.path.basename(path), d)]
    for name, b in it:
        b = decrunch(b)
        fp = os.path.join(outdir, name.replace('\\', '/').lstrip('/'))
        os.makedirs(os.path.dirname(fp) or '.', exist_ok=True)
        open(fp, 'wb').write(b); n += 1
    return n


if __name__ == '__main__':
    print(sys.argv[1], 'files:', unpack(sys.argv[1], sys.argv[2]))
