#!/usr/bin/env python3
"""Convert a ParaView/OpenFOAM uniform-grid CSV into OcToS Aero's CFD JSON format.

CSV columns: x,y,z,vx,vy,vz, or ParaView's Points:0/1/2 and U:0/1/2.
Coordinate axes must already match the centred Aero scene: nose -X, Z transverse,
ground Y=0. Velocities must be expressed in m/s.
"""
import argparse
import csv
import json
import math
from pathlib import Path

ALIASES = {
    "x": ("x", "Points:0", "Points_0", "Points: 0"),
    "y": ("y", "Points:1", "Points_1", "Points: 1"),
    "z": ("z", "Points:2", "Points_2", "Points: 2"),
    "vx": ("vx", "U:0", "U_0", "U: 0", "Velocity:0", "velocity_x"),
    "vy": ("vy", "U:1", "U_1", "U: 1", "Velocity:1", "velocity_y"),
    "vz": ("vz", "U:2", "U_2", "U: 2", "Velocity:2", "velocity_z"),
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Uniform-grid CSV exported from ParaView")
    parser.add_argument("output", type=Path, help="Output octos-cfd-v1 JSON")
    parser.add_argument("--reference-speed", type=float, help="Freestream speed (m/s)")
    parser.add_argument("--display-max-speed", type=float, help="Upper limit of colour scale (m/s)")
    parser.add_argument("--source", default="ParaView / OpenFOAM exported field")
    args = parser.parse_args()
    if args.reference_speed is not None and args.reference_speed <= 0:
        parser.error("--reference-speed must be positive")
    if args.display_max_speed is not None and args.display_max_speed <= 0:
        parser.error("--display-max-speed must be positive")
    rows = {}
    with args.input.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        names = {}
        for key, aliases in ALIASES.items():
            names[key] = next((a for a in aliases if a in fields), None)
            if names[key] is None:
                parser.error("Missing column for %s (accepted: %s)" % (key, ", ".join(aliases)))
        xs, ys, zs = set(), set(), set()
        for number, row in enumerate(reader, start=2):
            vals = [float(row[names[k]]) for k in ("x", "y", "z", "vx", "vy", "vz")]
            if not all(map(math.isfinite, vals)):
                raise ValueError(f"Nonfinite value in CSV row {number}")
            x, y, z, ux, uy, uz = vals
            point = (round(x, 6), round(y, 6), round(z, 6))
            if point in rows:
                raise ValueError(f"Duplicate grid node {point} (CSV row {number})")
            rows[point] = [ux, uy, uz]
            xs.add(point[0]); ys.add(point[1]); zs.add(point[2])
            if len(rows) > 2_000_000:
                raise ValueError("2 million grid nodes maximum")
    axes = [sorted(xs), sorted(ys), sorted(zs)]
    if any(len(v) < 2 for v in axes):
        raise ValueError("Each grid axis must have at least two nodes")
    size = math.prod(map(len, axes))
    if size != len(rows):
        raise ValueError(f"Incomplete regular grid: {len(rows)} of {size} nodes provided")
    spacing = []
    for values in axes:
        gap = (values[-1]-values[0])/(len(values)-1)
        if gap <= 0 or any(abs(values[i]-values[i-1]-gap)>max(1e-5,gap*1e-4)
                          for i in range(1,len(values))):
            raise ValueError("Grid is not uniform; use ParaView 'Resample To Image' first")
        spacing.append(gap)
    values = []
    for z in axes[2]:
        for y in axes[1]:
            for x in axes[0]:
                values.extend(rows[(x,y,z)])
    payload = {
        "format":"octos-cfd-v1",
        "source":args.source,
        "units":"m/s",
        "origin":[a[0] for a in axes],
        "spacing":spacing,
        "dimensions":[len(a) for a in axes],
        "velocity":values,
    }
    if args.reference_speed is not None:
        payload["referenceSpeed"] = args.reference_speed
    if args.display_max_speed is not None:
        payload["displayMaxSpeed"] = args.display_max_speed
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open("w",encoding="utf-8") as handle:
        json.dump(payload,handle,separators=(",",":"),allow_nan=False)
    print(f"Written {size} CFD nodes -> {args.output}")

if __name__ == "__main__":
    main()
