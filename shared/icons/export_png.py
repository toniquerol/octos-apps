#!/usr/bin/env python3
"""Exporta PNGs transparentes desde los SVG canónicos de aplicaciones.
Requiere: pip install cairosvg. No reescribe los maestros SVG.
"""
import json
from pathlib import Path
try:
    import cairosvg
except ImportError as exc:
    raise SystemExit("Instala CairoSVG: python -m pip install cairosvg") from exc

ROOT = Path(__file__).resolve().parents[2]
CATALOG = json.loads((ROOT / "shared/icons/catalog.json").read_text(encoding="utf-8"))
for app in CATALOG["entries"]:
    source = ROOT / app["svg"]
    if not source.is_file():
        raise SystemExit(f"SVG inexistente: {source}")
    for field, pixels in (("png128", 128), ("favicon32", 32)):
        target = ROOT / app[field]
        target.parent.mkdir(parents=True, exist_ok=True)
        cairosvg.svg2png(url=str(source), write_to=str(target),
                          output_width=pixels, output_height=pixels)
        print(f"{target.relative_to(ROOT)}: {pixels}x{pixels}")
