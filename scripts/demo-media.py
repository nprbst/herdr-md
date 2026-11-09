#!/usr/bin/env python3
"""Make the demo media in demo/: a chart (PNG), an animated loss curve (GIF)
and a line-fitting clip (MP4). They match the loss in demo/tour.md, carry no
captions, and the PNG and GIF have transparent backgrounds so they sit on any
theme. Needs numpy, matplotlib, Pillow and ffmpeg.

    python3 scripts/demo-media.py
"""
import os, subprocess, tempfile
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(HERE, "..", "demo")
INK, MUTED, A, B = "#c9ccd3", "#7d828c", "#7cc2ad", "#e6a95c"

rng = np.random.default_rng(7)
xs = np.sort(rng.uniform(0, 10, 40))
ys = 0.8 * xs + 1.5 + rng.normal(0, 1.1, xs.size)

def descent(steps=90, lr=0.012):
    w, b, out = -0.6, 7.5, []
    for _ in range(steps):
        r = w * xs + b - ys
        out.append((w, b, float((r ** 2).mean() / 2)))
        w -= lr * (r * xs).mean() * 2
        b -= lr * r.mean() * 6
    return out

path = descent()

def style(ax):
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    for s in ("left", "bottom"): ax.spines[s].set_color(MUTED)
    ax.tick_params(colors=MUTED, labelsize=13)
    ax.set_facecolor("none")

def chart():
    fig, ax = plt.subplots(figsize=(6, 3.4), dpi=260)
    fig.patch.set_alpha(0)
    style(ax)
    w, b, _ = path[-1]
    ax.scatter(xs, ys, s=34, color=A, alpha=0.9, linewidths=0)
    gx = np.array([0, 10])
    ax.plot(gx, w * gx + b, color=B, lw=2.5)
    ax.set_xlabel("x", color=INK, fontsize=14); ax.set_ylabel("y", color=INK, fontsize=14)
    ax.set_title(f"best fit: ŷ = {w:.2f}x + {b:.2f}", color=INK, fontsize=17, loc="left")
    fig.tight_layout()
    fig.savefig(os.path.join(DEMO, "fit.png"), transparent=True)
    plt.close(fig)

def loss_gif():
    losses = [p[2] for p in path]
    frames = []
    for i in range(1, len(losses) + 1, 2):
        fig, ax = plt.subplots(figsize=(5, 2.6), dpi=130)
        fig.patch.set_alpha(0); style(ax)
        ax.plot(range(i), losses[:i], color=B, lw=2.5)
        ax.scatter([i - 1], [losses[i - 1]], s=30, color=B, zorder=3)
        ax.set_xlim(0, len(losses)); ax.set_ylim(0, max(losses) * 1.05)
        ax.set_xlabel("step", color=INK, fontsize=14); ax.set_title(f"loss {losses[i-1]:.2f}", color=INK, fontsize=16, loc="left")
        fig.tight_layout(); fig.canvas.draw()
        frames.append(Image.frombuffer("RGBA", fig.canvas.get_width_height(), fig.canvas.buffer_rgba()).copy())
        plt.close(fig)
    frames += [frames[-1]] * 12
    # GIF has 1-bit alpha: quantize each frame, keep fully transparent pixels transparent.
    out = []
    for f in frames:
        alpha = f.getchannel("A")
        p = f.convert("RGB").quantize(colors=63, method=Image.Quantize.MEDIANCUT)
        p.paste(63, mask=alpha.point(lambda a: 255 if a < 128 else 0))
        out.append(p)
    out[0].save(os.path.join(DEMO, "loss.gif"), save_all=True, append_images=out[1:],
                duration=50, loop=0, transparency=63, disposal=2)

def fit_clip():
    tmp = tempfile.mkdtemp()
    gx = np.array([0, 10])
    seq = path + [path[-1]] * 30
    for i, (w, b, loss) in enumerate(seq):
        fig, ax = plt.subplots(figsize=(12.8, 7.2), dpi=100)
        fig.patch.set_facecolor("#16181c"); style(ax)
        ax.scatter(xs, ys, s=60, color=A, alpha=0.9, linewidths=0)
        for x, y in zip(xs, ys):
            ax.plot([x, x], [y, w * x + b], color=MUTED, lw=0.8, alpha=0.5)
        ax.plot(gx, w * gx + b, color=B, lw=3.5)
        ax.set_xlim(-0.3, 10.3); ax.set_ylim(min(ys) - 2, max(ys) + 2)
        ax.set_title(f"gradient descent   w {w:5.2f}   b {b:5.2f}   loss {loss:6.2f}",
                     color=INK, fontsize=18, loc="left", family="monospace")
        fig.tight_layout()
        fig.savefig(os.path.join(tmp, f"f{i:04d}.png"), facecolor=fig.get_facecolor())
        plt.close(fig)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "24", "-i", os.path.join(tmp, "f%04d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart",
                    os.path.join(DEMO, "fit.mp4")], check=True)

chart(); loss_gif(); fit_clip()
print("wrote demo/fit.png, demo/loss.gif, demo/fit.mp4")
