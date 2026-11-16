#!/usr/bin/env python3
"""Local OpenFOAM bridge CLI for a user-prepared case; never runs on GitHub Pages.

Execute inside Ubuntu/WSL2 after sourcing the installed OpenFOAM environment.
A case MUST have verified mesh, physics and boundary-condition dictionaries.
"""
import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys


def manifest_from(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or data.get("format") != "octos-cfd-case-v1":
        raise ValueError("Expected octos-cfd-case-v1 manifest from Aero")
    geom, sim = data.get("geometry", {}), data.get("simulation", {})
    if not isinstance(geom, dict) or not isinstance(sim, dict):
        raise ValueError("Incomplete CFD case")
    name, speed = geom.get("stl"), sim.get("velocityMps")
    if (not isinstance(name, str) or Path(name).name != name or
            not name.lower().endswith(".stl")):
        raise ValueError("Invalid STL filename in manifest")
    if not isinstance(speed, (int, float)) or not math.isfinite(speed) or not 0.1 <= speed <= 100:
        raise ValueError("Invalid inlet speed")
    return data


def check_file(path, description):
    if not path.is_file():
        raise FileNotFoundError(f"Missing {description}: {path}")


def run_fixed(case, args, label):
    """No shell, no dynamic commands; log stdout/stderr per processing stage."""
    logs = case / ".octos-cfd" / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    print(f"Executing: {' '.join(args)}")
    with (logs / f"{label}.log").open("w", encoding="utf-8") as stream:
        done = subprocess.run(args, cwd=case, stdout=stream, stderr=subprocess.STDOUT,
                              check=False)
    if done.returncode:
        raise RuntimeError(f"{label} failed ({done.returncode}). Inspect {logs / (label + '.log')}")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--case", required=True, type=Path, help="Existing OpenFOAM case directory in WSL")
    p.add_argument("--manifest", required=True, type=Path, help="Case JSON exported by OcToS Aero")
    p.add_argument("--stage", required=True, choices=["prepare", "mesh", "solve", "convert"])
    p.add_argument("--stl", type=Path, help="STL exported by Aero (required for prepare)")
    p.add_argument("--csv", type=Path, help="Uniform velocity CSV exported with ParaView (required for convert)")
    p.add_argument("--output", type=Path, help="Output octos-cfd-v1 JSON (required for convert)")
    opts = p.parse_args()
    try:
        case = opts.case.expanduser().resolve()
        manifest_path = opts.manifest.expanduser().resolve()
        data = manifest_from(manifest_path)
        if not case.is_dir():
            raise ValueError(f"OpenFOAM case directory does not exist: {case}")
        if opts.stage == "prepare":
            if opts.stl is None:
                raise ValueError("--stl required")
            check_file(opts.stl, "STL")
            dst = case / "constant" / "geometry" / data["geometry"]["stl"]
            dst.parent.mkdir(parents=True, exist_ok=True)
            if dst.exists():
                raise FileExistsError(f"STL already exists; refusing overwrite: {dst}")
            shutil.copyfile(opts.stl, dst)
            print(f"Geometry copied to {dst}. Mesh dictionary and physical boundary conditions must be configured.")
        elif opts.stage == "mesh":
            for name in ("system/blockMeshDict", "system/snappyHexMeshDict"):
                check_file(case / name, name)
            run_fixed(case, ["blockMesh"], "blockMesh")
            run_fixed(case, ["snappyHexMesh", "-overwrite"], "snappyHexMesh")
            run_fixed(case, ["checkMesh", "-allTopology", "-allGeometry"], "checkMesh")
            print("Mesh commands finished. Review checkMesh.log for warnings and mesh-quality metrics.")
        elif opts.stage == "solve":
            check_file(case / "system" / "controlDict", "controlDict")
            check_file(case / "system" / "fvSolution", "fvSolution")
            check_file(case / "system" / "fvSchemes", "fvSchemes")
            run_fixed(case, ["foamRun", "-solver", "incompressibleFluid"], "foamRun")
            print("Solver process exited successfully. Review residuals and convergence; this exit code is NOT a CFD quality certification.")
        elif opts.stage == "convert":
            if opts.csv is None or opts.output is None:
                raise ValueError("--csv and --output required")
            check_file(opts.csv, "ParaView CSV")
            script = Path(__file__).resolve().parent / "cfd_csv_to_json.py"
            run_fixed(case, [sys.executable, str(script), str(opts.csv.resolve()),
                             str(opts.output.resolve()), "--case-manifest", str(manifest_path)],
                      "csv_to_json")
            print(f"Converted CFD grid: {opts.output.resolve()}. Import it manually in OcToS Aero.")
        return 0
    except (ValueError, FileNotFoundError, FileExistsError, OSError, RuntimeError, json.JSONDecodeError) as exc:
        p.exit(2, f"Error: {exc}\n")


if __name__ == "__main__":
    sys.exit(main())
