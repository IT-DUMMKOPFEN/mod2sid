#!/usr/bin/env python3
"""Minimal ISO9660 reader (Joliet preferred). usage:
  isox.py list <iso>                      -> path<TAB>size per file
  isox.py extract <iso> <outdir> <regex>  -> copy matching files (flat, unique names)"""
import sys, struct, os, re
def vds(f):
    pvd = jol = None
    for i in range(16, 64):
        f.seek(i * 2048); d = f.read(2048)
        if d[1:6] != b'CD001': break
        t = d[0]
        if t == 1 and pvd is None: pvd = d
        if t == 2 and d[88:91] in (b'%/@', b'%/C', b'%/E'): jol = d
        if t == 255: break
    return (jol, 'utf-16-be') if jol else (pvd, 'latin-1')
def walk(f, ext, ln, enc, path, out, seen):
    if ext in seen: return
    seen.add(ext)
    f.seek(ext * 2048); data = f.read(ln); p = 0
    while p < len(data):
        L = data[p]
        if L == 0: p = (p // 2048 + 1) * 2048; continue
        r = data[p:p + L]; p += L
        e = struct.unpack('<I', r[2:6])[0]; size = struct.unpack('<I', r[10:14])[0]; flags = r[25]; nl = r[32]; nm = r[33:33 + nl]
        if nm in (b'\x00', b'\x01'): continue
        name = nm.decode(enc, 'replace').split(';')[0]
        if flags & 2: walk(f, e, size, enc, path + name + '/', out, seen)
        else: out.append((path + name, e, size))
def files(iso):
    f = open(iso, 'rb'); d, enc = vds(f)
    root = d[156:190]; e = struct.unpack('<I', root[2:6])[0]; s = struct.unpack('<I', root[10:14])[0]
    out = []; walk(f, e, s, enc, '', out, set()); return f, out
if __name__ == '__main__':
    cmd, iso = sys.argv[1], sys.argv[2]
    f, fl = files(iso)
    if cmd == 'list':
        for p, e, s in fl: print(f'{p}\t{s}')
    else:
        outd, rx = sys.argv[3], re.compile(sys.argv[4], re.I); os.makedirs(outd, exist_ok=True); n = 0
        tag = os.path.basename(iso).split('.')[0][:12]
        for p, e, s in fl:
            if not rx.search(p.split('/')[-1]) or s < 1084 or s > 4_000_000: continue
            f.seek(e * 2048); b = f.read(s)
            safe = re.sub(r'[^A-Za-z0-9._-]+', '_', p)[-150:]
            open(os.path.join(outd, f'{tag}__{safe}'), 'wb').write(b); n += 1
        print('extracted', n)
