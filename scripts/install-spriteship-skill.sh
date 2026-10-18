#!/usr/bin/env bash
set -euo pipefail

# SpriteShip 0.7.9 installer for Codex.
# Installs only the two SpriteShip-owned skill trees; never replaces root AGENTS.md.
# Run from the repository root. Existing skill files are preserved: installer aborts if any target exists.

VERSION="0.7.9"
BASE_URL="https://spriteship.com/agent-skill"
MANIFEST_URL="${BASE_URL}/manifest.json"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v curl >/dev/null || { echo "ERROR: curl is required." >&2; exit 1; }
command -v python3 >/dev/null || { echo "ERROR: python3 is required." >&2; exit 1; }

curl -fsSL "$MANIFEST_URL" -o "$TMP_DIR/manifest.json"

python3 - "$TMP_DIR/manifest.json" "$VERSION" <<'PY'
import json, sys
manifest = json.load(open(sys.argv[1], encoding="utf-8"))
if manifest.get("currentVersion") != sys.argv[2]:
    raise SystemExit(f"ERROR: expected SpriteShip {sys.argv[2]}, got {manifest.get('currentVersion')!r}")
print(f"Verified manifest identifies SpriteShip {manifest['currentVersion']}")
PY

# Only install the skills and their references, not the package's root AGENTS.md,
# plugin files, or commands that could conflict with repository conventions.
python3 - "$TMP_DIR/manifest.json" <<'PY' > "$TMP_DIR/files.tsv"
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
allowed = ("skills/spriteship/", "skills/spriteship-maps/")
for f in m.get("files", []):
    p = f.get("path", "")
    if p.startswith(allowed):
        print("\t".join((p, f["sha256"], str(f["sizeBytes"]))))
PY

while IFS="$(printf '\t')" read -r rel expected_sha expected_size; do
  [ -n "$rel" ] || continue
  target=".agents/$rel"
  if [ -e "$target" ] || [ -L "$target" ]; then
    echo "ERROR: target already exists; preserving it and stopping: $target" >&2
    echo "Review the existing installation and use the official update guide before updating." >&2
    exit 2
  fi
done < "$TMP_DIR/files.tsv"

while IFS="$(printf '\t')" read -r rel expected_sha expected_size; do
  [ -n "$rel" ] || continue
  mkdir -p "$(dirname ".agents/$rel")"
  curl -fsSL "${BASE_URL}/releases/${VERSION}/$rel" -o "$TMP_DIR/file"
  actual_sha="$(python3 - "$TMP_DIR/file" <<'PY'
import hashlib, sys
print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())
PY
)"
  actual_size="$(wc -c < "$TMP_DIR/file" | tr -d ' ')"
  if [ "$actual_sha" != "$expected_sha" ] || [ "$actual_size" != "$expected_size" ]; then
    echo "ERROR: checksum/size mismatch for $rel; refusing to install." >&2
    exit 3
  fi
  cp "$TMP_DIR/file" ".agents/$rel"
  echo "Installed and verified: .agents/$rel"
done < "$TMP_DIR/files.tsv"

echo "SpriteShip $VERSION skill files installed and verified."
echo "Restart/reload Codex, then configure the private MCP connection using the official Codex guide:"
echo "https://spriteship.com/agents/codex"
