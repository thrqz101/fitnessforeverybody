"""Build the full, gitignored food library before cloud deployments.

Only public USDA archives are downloaded; no credentials are needed. Pinned
checksums prevent a changed upstream archive from silently changing nutrition.
"""
import hashlib
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVES = [
    ("sr-legacy-2018.zip",
     "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip",
     "b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0"),
    ("foundation-2026.zip",
     "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip",
     "70457ee9d9342f43bda2010318c85f04210c689fdeb9cd2da4c513b0e8dbc655"),
]
EXPECTED_DB_SHA256 = "aceef5bfbe3ce9212f85f592f3a400158452cc280ed11faa48af82700c15875c"


def sha256(file):
    checksum = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def main():
    cache = ROOT / "output/nutrition-sources"
    cache.mkdir(parents=True, exist_ok=True)
    for name, url, checksum in ARCHIVES:
        destination = cache / name
        if not destination.exists() or sha256(destination) != checksum:
            temporary = destination.with_suffix(".download")
            request = urllib.request.Request(url, headers={"User-Agent": "FitnessForEverybody-NutritionBuild/2"})
            with urllib.request.urlopen(request, timeout=30) as response, temporary.open("wb") as stream:
                for chunk in iter(lambda: response.read(1024 * 1024), b""):
                    stream.write(chunk)
            if sha256(temporary) != checksum:
                raise RuntimeError(f"USDA archive checksum mismatch: {name}")
            temporary.replace(destination)
        print(f"Verified nutrition archive: {name}", flush=True)
    for script in ["recipes.py", "build.py"]:
        subprocess.run([sys.executable, str(ROOT / "scripts/nutrition" / script)], cwd=ROOT, check=True)
    library = ROOT / "data/nutrition-100g.json"
    if sha256(library) != EXPECTED_DB_SHA256:
        raise RuntimeError("Generated nutrition library differs from the reviewed release")
    count = len(json.loads(library.read_text())["foods"])
    print(f"Verified full nutrition library: {count} foods", flush=True)


if __name__ == "__main__":
    main()
