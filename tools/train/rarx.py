#!/usr/bin/env python3
"""Extract RAR (4 and 5) and other archives through the system libarchive (ctypes,
no extra packages). Only regular files whose path matches the regex are written.
Names are flattened to <n>_<basename> so nothing is overwritten.
usage: rarx.py <archive> <outdir> [regex] [--list] [--keep]  (--keep: keep the folder paths)"""
import ctypes, ctypes.util, os, re, sys

lib = ctypes.CDLL(ctypes.util.find_library('archive') or 'libarchive.so.13')
lib.archive_read_new.restype = ctypes.c_void_p
lib.archive_read_support_filter_all.argtypes = [ctypes.c_void_p]
lib.archive_read_support_format_all.argtypes = [ctypes.c_void_p]
lib.archive_read_open_filename.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_size_t]
lib.archive_read_next_header.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p)]
lib.archive_entry_pathname.argtypes = [ctypes.c_void_p]; lib.archive_entry_pathname.restype = ctypes.c_char_p
lib.archive_entry_pathname_utf8.argtypes = [ctypes.c_void_p]; lib.archive_entry_pathname_utf8.restype = ctypes.c_char_p
lib.archive_entry_size.argtypes = [ctypes.c_void_p]; lib.archive_entry_size.restype = ctypes.c_int64
lib.archive_entry_filetype.argtypes = [ctypes.c_void_p]; lib.archive_entry_filetype.restype = ctypes.c_uint
lib.archive_read_data.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t]; lib.archive_read_data.restype = ctypes.c_ssize_t
lib.archive_read_data_skip.argtypes = [ctypes.c_void_p]
lib.archive_error_string.argtypes = [ctypes.c_void_p]; lib.archive_error_string.restype = ctypes.c_char_p
lib.archive_read_free.argtypes = [ctypes.c_void_p]

def entries(path, want=None, maxsize=1 << 30):
    """yields (name, size, bytes|None); bytes only for names where want(name) is true"""
    a = lib.archive_read_new()
    lib.archive_read_support_filter_all(a); lib.archive_read_support_format_all(a)
    if lib.archive_read_open_filename(a, path.encode(), 1 << 20) != 0:
        raise OSError((lib.archive_error_string(a) or b'').decode())
    e = ctypes.c_void_p(); buf = ctypes.create_string_buffer(1 << 20)
    try:
        while True:
            r = lib.archive_read_next_header(a, ctypes.byref(e))
            if r == 1: break                      # EOF
            if r < -20: raise OSError((lib.archive_error_string(a) or b'').decode())
            raw = lib.archive_entry_pathname_utf8(e) or lib.archive_entry_pathname(e) or b''
            name = raw.decode('utf8', 'replace'); size = lib.archive_entry_size(e)
            if lib.archive_entry_filetype(e) != 0o100000 or not (want and want(name)) or size > maxsize:
                lib.archive_read_data_skip(a); yield name, size, None; continue
            out = bytearray()
            while True:
                n = lib.archive_read_data(a, buf, len(buf))
                if n <= 0: break
                out += buf.raw[:n]
            yield name, size, (bytes(out) if n == 0 else None)
    finally:
        lib.archive_read_free(a)

if __name__ == '__main__':
    arc, outdir = sys.argv[1], sys.argv[2]
    rx = re.compile(sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else '.', re.I)
    listing = '--list' in sys.argv
    os.makedirs(outdir, exist_ok=True)
    n = w = bad = 0
    for name, size, data in entries(arc, None if listing else (lambda s: bool(rx.search(s)))):
        n += 1
        if listing: print(size, name); continue
        if data is None:
            if rx.search(name): bad += 1
            continue
        if '--keep' in sys.argv:
            parts = [p for p in name.replace('\\', '/').split('/') if p not in ('', '.', '..')]
            dst = os.path.join(outdir, *parts); os.makedirs(os.path.dirname(dst), exist_ok=True)
        else:
            dst = os.path.join(outdir, f'{w:06d}_' + re.sub(r'[^\w.\- ]', '_', os.path.basename(name))[-100:])
        open(dst, 'wb').write(data); w += 1
    print(f'{arc}: {n} entries, {w} written, {bad} failed', file=sys.stderr)
