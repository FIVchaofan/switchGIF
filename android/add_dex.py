"""Insert classes.dex and optional native libraries into an APK produced by aapt2 link."""
import os
import sys
import zipfile


def main(base_apk: str, dex_path: str, output_apk: str, jni_root: str | None = None) -> None:
    with zipfile.ZipFile(base_apk, "r") as source, zipfile.ZipFile(output_apk, "w") as target:
        for item in source.infolist():
            data = source.read(item.filename)
            target.writestr(item, data)
        with open(dex_path, "rb") as dex:
            target.writestr("classes.dex", dex.read(), compress_type=zipfile.ZIP_DEFLATED)
        if jni_root and os.path.isdir(jni_root):
            for abi in sorted(os.listdir(jni_root)):
                abi_dir = os.path.join(jni_root, abi)
                if not os.path.isdir(abi_dir):
                    continue
                for name in sorted(os.listdir(abi_dir)):
                    if not name.endswith(".so"):
                        continue
                    path = os.path.join(abi_dir, name)
                    with open(path, "rb") as library:
                        target.writestr(
                            f"lib/{abi}/{name}",
                            library.read(),
                            compress_type=zipfile.ZIP_DEFLATED,
                        )
    print(f"packaged {output_apk}")


if __name__ == "__main__":
    if len(sys.argv) not in (4, 5):
        raise SystemExit("usage: add_dex.py base.apk classes.dex output.apk [jniLibs]")
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) == 5 else None)
