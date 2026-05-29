#!/usr/bin/env sh
# Copy CLIP vectorize files into a cloned HF Space repo and push.
# Usage:
#   ./scripts/deploy-hf-vectorize-space.sh /path/to/fitandsleek-ai-vectorize
#
# Clone first (use HF token as password when prompted):
#   git clone https://huggingface.co/spaces/norng007/fitandsleek-ai-vectorize
set -e

DEST="${1:-}"
SRC="$(cd "$(dirname "$0")/../huggingface/vectorize" && pwd)"

if [ -z "$DEST" ] || [ ! -d "$DEST/.git" ]; then
  echo "Usage: $0 /path/to/cloned-hf-space"
  echo ""
  echo "Clone:"
  echo "  git clone https://huggingface.co/spaces/norng007/fitandsleek-ai-vectorize"
  echo "  $0 ./fitandsleek-ai-vectorize"
  exit 1
fi

echo "Copying from $SRC to $DEST"
cp "$SRC/app.py" "$SRC/Dockerfile" "$SRC/requirements.txt" "$SRC/README.md" "$DEST/"

cd "$DEST"
# Remove HF default hello-world files if present
rm -f app.py.bak 2>/dev/null || true

git add app.py Dockerfile requirements.txt README.md
git status

echo ""
echo "Commit and push (HF token = password when git asks):"
echo "  git commit -m \"CLIP vectorize API for Fitandsleek image search\""
echo "  git push"
echo ""
echo "Then set on Render backend:"
echo "  IMAGE_VECTORIZE_URL=https://norng007-fitandsleek-ai-vectorize.hf.space/vectorize"
