#!/usr/bin/env bash
# Explicit pinned releases. No arguments show help; nothing installs or starts.
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/factory_release.py" "$@"
