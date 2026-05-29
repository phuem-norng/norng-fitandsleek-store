#!/usr/bin/env bash
# Push CLIP files to HF Space (no git credentials needed).
# Usage: ./scripts/push-hf-space.sh hf_YOUR_WRITE_TOKEN
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 hf_YOUR_WRITE_TOKEN"
  echo "Create token: https://huggingface.co/settings/tokens (Write)"
  exit 1
fi

export HF_TOKEN="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$ROOT/scripts/push-hf-space-upload.py"
