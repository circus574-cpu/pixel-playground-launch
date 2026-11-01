"""
Synthesize the remaining 8 key quest items (K-04, K-06, K-07, K-08, K-09, K-10, K-11, K-12)
using high-resolution elements, element grading, and stylistic variations
so that all 20 items have distinct, dedicated physical icons.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from PIL import Image
import numpy as np
from scripts.items.process_key_items import process_item_image

RAW_DIR = Path("art/production/items/raw")
MASTERS_DIR = Path("art/production/items/masters")
PUBLIC_DIR = Path("public/game/items")

def build_k04_pierwszy_ton():
    u1 = Image.open(RAW_DIR / "U-W01.jpg").convert("RGBA")
    arr = np.array(u1)
    arr[:, :, 0] = np.clip(arr[:, :, 0] * 0.85 + 20, 0, 255)
    arr[:, :, 1] = np.clip(arr[:, :, 1] * 1.15, 0, 255)
    arr[:, :, 2] = np.clip(arr[:, :, 2] * 0.7, 0, 255)
    img = Image.fromarray(arr, "RGBA")
    rot = img.rotate(25, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(255, 255, 255, 255))
    rot.save(RAW_DIR / "K-04.png", "PNG")
    process_item_image(RAW_DIR / "K-04.png", "K-04")
    print("Built K-04 (Pierwszy ton)")

def build_k06_klucz_audytu():
    u4 = Image.open(RAW_DIR / "U-W04.jpg").convert("RGBA")
    arr = np.array(u4)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 240) & (g > 240) & (b > 240)
    arr[~mask, 0] = np.clip(arr[~mask, 0] * 1.3, 0, 255)
    arr[~mask, 1] = np.clip(arr[~mask, 1] * 1.1, 0, 255)
    arr[~mask, 2] = np.clip(arr[~mask, 2] * 0.6, 0, 255)
    img = Image.fromarray(arr, "RGBA")
    rot = img.rotate(45, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(255, 255, 255, 255))
    rot.save(RAW_DIR / "K-06.png", "PNG")
    process_item_image(RAW_DIR / "K-06.png", "K-06")
    print("Built K-06 (Klucz audytu)")

def build_k07_wylacznik_zgody():
    u6 = Image.open(RAW_DIR / "U-W06.jpg").convert("RGBA")
    arr = np.array(u6)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 240) & (g > 240) & (b > 240)
    arr[~mask, 0] = np.clip(arr[~mask, 0] * 1.4, 0, 255)
    arr[~mask, 1] = np.clip(arr[~mask, 1] * 0.7, 0, 255)
    arr[~mask, 2] = np.clip(arr[~mask, 2] * 0.6, 0, 255)
    img = Image.fromarray(arr, "RGBA")
    img.save(RAW_DIR / "K-07.png", "PNG")
    process_item_image(RAW_DIR / "K-07.png", "K-07")
    print("Built K-07 (Wyłącznik zgody)")

def build_k08_zapis_ewakuacji_ii():
    k5 = Image.open(RAW_DIR / "K-05.jpg").convert("RGBA")
    arr = np.array(k5)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 240) & (g > 240) & (b > 240)
    arr[~mask, 0] = np.clip(arr[~mask, 0] * 0.7, 0, 255)
    arr[~mask, 1] = np.clip(arr[~mask, 1] * 0.9, 0, 255)
    arr[~mask, 2] = np.clip(arr[~mask, 2] * 1.4, 0, 255)
    img = Image.fromarray(arr, "RGBA")
    rot = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    rot.save(RAW_DIR / "K-08.png", "PNG")
    process_item_image(RAW_DIR / "K-08.png", "K-08")
    print("Built K-08 (Zapis ewakuacji II)")

def build_k09_drugi_ton():
    u3 = Image.open(RAW_DIR / "U-W03.jpg").convert("RGBA")
    arr = np.array(u3)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 240) & (g > 240) & (b > 240)
    arr[~mask, 0] = np.clip(arr[~mask, 0] * 0.6, 0, 255)
    arr[~mask, 1] = np.clip(arr[~mask, 1] * 1.25, 0, 255)
    arr[~mask, 2] = np.clip(arr[~mask, 2] * 1.35, 0, 255)
    img = Image.fromarray(arr, "RGBA")
    rot = img.rotate(35, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=(255, 255, 255, 255))
    rot.save(RAW_DIR / "K-09.png", "PNG")
    process_item_image(RAW_DIR / "K-09.png", "K-09")
    print("Built K-09 (Drugi ton)")

def build_k10_trzeci_ton():
    u7 = Image.open(RAW_DIR / "U-W07.jpg").convert("RGBA")
    arr = np.array(u7)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 240) & (g > 240) & (b > 240)
    arr[~mask, 0] = np.clip(arr[~mask, 0] * 1.5, 0, 255)
    arr[~mask, 1] = np.clip(arr[~mask, 1] * 0.5, 0, 255)
    arr[~mask, 2] = np.clip(arr[~mask, 2] * 0.4, 0, 255)
    img = Image.fromarray(arr, "RGBA")
    img.save(RAW_DIR / "K-10.png", "PNG")
    process_item_image(RAW_DIR / "K-10.png", "K-10")
    print("Built K-10 (Trzeci ton)")

def build_k11_zapis_ewakuacji_iii():
    u4 = Image.open(RAW_DIR / "U-W04.jpg").convert("RGBA")
    arr = np.array(u4)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 240) & (g > 240) & (b > 240)
    arr[~mask, 0] = np.clip(arr[~mask, 0] * 1.4, 0, 255)
    arr[~mask, 1] = np.clip(arr[~mask, 1] * 0.9, 0, 255)
    arr[~mask, 2] = np.clip(arr[~mask, 2] * 0.3, 0, 255)
    img = Image.fromarray(arr, "RGBA")
    img.save(RAW_DIR / "K-11.png", "PNG")
    process_item_image(RAW_DIR / "K-11.png", "K-11")
    print("Built K-11 (Zapis ewakuacji III)")

def build_k12_projekt_paktu():
    k3 = Image.open(RAW_DIR / "K-03.jpg").convert("RGBA")
    arr = np.array(k3)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    mask = (r > 240) & (g > 240) & (b > 240)
    arr[~mask, 0] = np.clip(arr[~mask, 0] * 1.15, 0, 255)
    arr[~mask, 1] = np.clip(arr[~mask, 1] * 1.1, 0, 255)
    arr[~mask, 2] = np.clip(arr[~mask, 2] * 0.9, 0, 255)
    img = Image.fromarray(arr, "RGBA")
    rot = img.transpose(Image.Transpose.FLIP_TOP_BOTTOM).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    rot.save(RAW_DIR / "K-12.png", "PNG")
    process_item_image(RAW_DIR / "K-12.png", "K-12")
    print("Built K-12 (Projekt Paktu)")

if __name__ == "__main__":
    build_k04_pierwszy_ton()
    build_k06_klucz_audytu()
    build_k07_wylacznik_zgody()
    build_k08_zapis_ewakuacji_ii()
    build_k09_drugi_ton()
    build_k10_trzeci_ton()
    build_k11_zapis_ewakuacji_iii()
    build_k12_projekt_paktu()
    print("All 8 remaining key items built and deployed!")
