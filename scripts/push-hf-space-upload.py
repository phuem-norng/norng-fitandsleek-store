#!/usr/bin/env python3
"""Upload CLIP vectorize files to HF Space without git (uses HF_TOKEN env var)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ID = "norng007/fitandsleek-ai-vectorize"
REPO_TYPE = "space"
SRC = Path(__file__).resolve().parents[1] / "huggingface" / "vectorize"
FILES = ("app.py", "Dockerfile", "requirements.txt", "README.md")


def main() -> int:
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if not token:
        print("Set HF_TOKEN first (Write token from https://huggingface.co/settings/tokens):", file=sys.stderr)
        print("  export HF_TOKEN=hf_xxxx", file=sys.stderr)
        return 1

    try:
        from huggingface_hub import HfApi
    except ImportError:
        print("Installing huggingface_hub...", file=sys.stderr)
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "huggingface_hub"])
        from huggingface_hub import HfApi

    api = HfApi(token=token)
    for name in FILES:
        path = SRC / name
        if not path.is_file():
            print(f"Missing {path}", file=sys.stderr)
            return 1
        print(f"Uploading {name}...")
        api.upload_file(
            path_or_fileobj=str(path),
            path_in_repo=name,
            repo_id=REPO_ID,
            repo_type=REPO_TYPE,
            commit_message="CLIP vectorize API for Fitandsleek image search",
        )

    print(f"Done. Space: https://huggingface.co/spaces/{REPO_ID}")
    print("Wait for build, then: curl https://norng007-fitandsleek-ai-vectorize.hf.space/health")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
