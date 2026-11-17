#!/usr/bin/env python3
"""Copy a pinned model from persistent storage to local SSD, without downloads."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import shutil
import time
import uuid
from vace_motion import MODEL, REVISION, output_root, safe_file, sha, write_json


def stage(source, destination, receipt_path, reserve_bytes=2*1024**3):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    receipt = json.loads(Path(receipt_path).read_text())
    if receipt.get("repository") != MODEL or receipt.get("revision") != REVISION or not receipt.get("files"):
        raise ValueError("Wrong pinned model receipt")
    if source == destination:
        raise ValueError("Persistent source and local cache must be different directories")
    names = [e["file"] for e in receipt["files"]]
    if len(names) != len(set(names)):
        raise ValueError("Duplicate model destination")
    destination = output_root(destination)
    needed = 0
    for entry in receipt["files"]:
        src, dst = safe_file(source, entry["file"]), safe_file(destination, entry["file"])
        if not src.is_file() or src.stat().st_size != entry["bytes"]:
            raise ValueError("Persistent model is missing/incomplete: " + entry["file"])
        if not dst.exists():
            needed += entry["bytes"]
    if shutil.disk_usage(destination).free < needed + reserve_bytes:
        raise ValueError("Insufficient local disk; no model files copied")
    lock = destination / ".stage.lock"
    with lock.open("x") as stream:
        stream.write(str(os.getpid()))
        owned_inode = os.fstat(stream.fileno()).st_ino
    started = time.monotonic()
    def copy(entry):
        src, dst = safe_file(source, entry["file"]), safe_file(destination, entry["file"])
        if dst.exists():
            if sha(dst) != entry["sha256"]:
                raise ValueError("Existing cache is corrupted; choose a fresh cache directory: " + entry["file"])
            return entry["file"]
        dst.parent.mkdir(parents=True, exist_ok=True)
        temporary = dst.with_name(dst.name + ".partial-" + uuid.uuid4().hex)
        try:
            shutil.copyfile(src, temporary)
            if sha(temporary) != entry["sha256"]:
                raise ValueError("Model checksum mismatch: " + entry["file"])
            if dst.exists():
                raise FileExistsError("A different process wrote the cache destination")
            temporary.rename(dst)
        finally:
            if temporary.exists(): temporary.unlink()
        print("MODEL_STAGED", entry["file"], flush=True)
        return entry["file"]
    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            completed = list(pool.map(copy, receipt["files"]))
        status = {"kind":"model-cache-verified","revision":REVISION,"receiptSha256":sha(receipt_path),
                  "files":len(completed),"bytes":sum(e["bytes"] for e in receipt["files"]),
                  "seconds":time.monotonic()-started,"gpuUsed":False}
        write_json(destination / "stage-verified.json", status)
        return status
    finally:
        if lock.exists() and lock.stat().st_ino == owned_inode: lock.unlink()


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source",type=Path,required=True)
    parser.add_argument("--destination",type=Path,required=True)
    parser.add_argument("--receipt",type=Path,required=True)
    args=parser.parse_args()
    print(json.dumps(stage(args.source,args.destination,args.receipt)))
