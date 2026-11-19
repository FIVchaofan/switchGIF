"""Insert classes.dex into an APK produced by aapt2 link."""
import shutil
import sys
import zipfile


def main(base_apk: str, dex_path: str, output_apk: str) -> None:
    with zipfile.ZipFile(base_apk, "r") as source, zipfile.ZipFile(output_apk, "w") as target:
        for item in source.infolist():
            data = source.read(item.filename)
            target.writestr(item, data)
        with open(dex_path, "rb") as dex:
            target.writestr("classes.dex", dex.read(), compress_type=zipfile.ZIP_DEFLATED)
    print(f"packaged {output_apk}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: add_dex.py base.apk classes.dex output.apk")
    main(sys.argv[1], sys.argv[2], sys.argv[3])
