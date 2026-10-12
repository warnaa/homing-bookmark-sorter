"""Create a validated Chrome Web Store ZIP with manifest.json at its root."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent


def package():
    dist = ROOT / "dist"
    version = json.loads((dist / "manifest.json").read_text(encoding="utf-8"))["version"]
    versions = [json.loads((ROOT / name).read_text(encoding="utf-8"))["version"]
                for name in ("package.json", "package-lock.json", "public/manifest.json")]
    if any(value != version for value in versions):
        raise ValueError("Package, lockfile, and manifest versions must match")
    output = ROOT / "build" / f"homing-{version}.zip"
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for file in sorted(dist.rglob("*")):
            if file.is_file():
                archive.write(file, file.relative_to(dist).as_posix())
    with ZipFile(output) as archive:
        if archive.testzip() or "manifest.json" not in archive.namelist():
            raise ValueError("Invalid extension archive")
    print(output)


if __name__ == "__main__":
    package()
