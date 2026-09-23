#!/usr/bin/env python3
"""Key out a solid-ish background (white or black) to transparency via
border-connected flood fill. Usage: make_transparent.py file1.png [file2.png ...]
Only touches pixels connected to the image border that are within `tol`
of the corner key color. Interior art is never modified."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

TOL = 18  # max per-channel distance from key color

def key_out(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    h, w = a.shape[:2]
    # key color = median of the four corners
    corners = np.array([a[0, 0], a[0, w - 1], a[h - 1, 0], a[h - 1, w - 1]][:3])[:, :3].astype(int)
    key = np.median(corners, axis=0).astype(int)
    print(f'{path}: key color {tuple(key)}, size {w}x{h}')
    dist = np.abs(a[:, :, :3].astype(int) - key).max(axis=2)
    mask = dist <= TOL
    labeled, n = ndimage.label(mask)
    border_labels = set(np.unique(np.concatenate([
        labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]
    ])))
    border_labels.discard(0)
    if not border_labels:
        print('  no border-connected background found, skipping')
        return
    bg = np.isin(labeled, list(border_labels))
    frac = bg.mean()
    print(f'  removing {frac * 100:.1f}% of pixels as background')
    if frac > 0.85:
        print('  WARNING: >85% would be removed, skipping (probably full-bleed art)')
        return
    a[bg, 3] = 0
    Image.fromarray(a).save(path)
    print('  saved with transparency')

if __name__ == '__main__':
    for p in sys.argv[1:]:
        key_out(p)
