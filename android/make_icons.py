from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent / "app" / "res"
source = Image.open(Path(__file__).resolve().parent.parent / "docs" / "icon.png").convert("RGBA")
sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, size in sizes.items():
    folder = root / f"mipmap-{density}"
    folder.mkdir(parents=True, exist_ok=True)
    source.resize((size, size), Image.LANCZOS).save(folder / "ic_launcher.png")
    print(folder / "ic_launcher.png")
