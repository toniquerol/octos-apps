"""Contract tests for OcToS CFD CSV / manifest interface; no real solver implied."""
import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


BASE = Path(__file__).resolve().parents[1]
CONVERTER = BASE / "tools" / "cfd_csv_to_json.py"
RUNNER = BASE / "tools" / "openfoam_local.py"


class TestLocalCFD(unittest.TestCase):
    def test_grid_and_case_association(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, output, manifest = root / "input.csv", root / "out.json", root / "case.json"
            with source.open("w", newline="", encoding="utf-8") as file:
                writer = csv.writer(file)
                writer.writerow(["Points:0", "Points:1", "Points:2", "U:0", "U:1", "U:2"])
                # Deliberately shuffled input: converter must store X fastest.
                for z in reversed(range(2)):
                    for x in reversed(range(2)):
                        for y in reversed(range(2)):
                            writer.writerow([x, y, z, 15 + x, y, z])
            manifest.write_text(json.dumps({
                "format": "octos-cfd-case-v1", "createdAt": "2026-11-16T00:00:00Z",
                "project": {"vehicle": {"name": "Prueba", "fileRef": "prueba.glb"}},
                "geometry": {"stl": "prueba-aero.stl"},
                "simulation": {"velocityMps": 15},
            }), encoding="utf-8")
            subprocess.run([sys.executable, str(CONVERTER), str(source), str(output),
                            "--case-manifest", str(manifest)], check=True, capture_output=True)
            result = json.loads(output.read_text())
            self.assertEqual(result["format"], "octos-cfd-v1")
            self.assertEqual(result["dimensions"], [2, 2, 2])
            self.assertEqual(result["referenceSpeed"], 15)
            self.assertEqual(result["case"]["vehicleFile"], "prueba.glb")
            self.assertEqual(result["velocity"][:6], [15, 0, 0, 16, 0, 0])
            self.assertEqual(len(result["velocity"]), 24)

    def test_local_prepare_and_invalid_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            case = root / "case"
            case.mkdir()
            manifest = root / "case.json"
            manifest.write_text(json.dumps({
                "format": "octos-cfd-case-v1", "geometry": {"stl": "modelo-aero.stl"},
                "simulation": {"velocityMps": 22},
            }), encoding="utf-8")
            stl = root / "modelo.stl"
            stl.write_bytes(b"test STL bytes")
            cmd = [sys.executable, str(RUNNER), "--case", str(case),
                   "--manifest", str(manifest), "--stage", "prepare", "--stl", str(stl)]
            subprocess.run(cmd, check=True, capture_output=True)
            self.assertEqual((case / "constant/geometry/modelo-aero.stl").read_bytes(), stl.read_bytes())
            again = subprocess.run(cmd, capture_output=True)
            self.assertNotEqual(again.returncode, 0, "refuse accidental overwrite")
            manifest.write_text('{"format":"not-cfd"}', encoding="utf-8")
            invalid = subprocess.run(cmd, capture_output=True)
            self.assertNotEqual(invalid.returncode, 0)


if __name__ == "__main__":
    unittest.main()
