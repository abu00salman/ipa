#!/usr/bin/env bash
# Builds zsign (an IPA signer that runs on Linux, macOS and Windows) and prints the path to set as ZSIGN_BIN.
# Requires: git, g++, make, OpenSSL development headers (libssl-dev / openssl-devel).
set -euo pipefail

DEST="${1:-$(pwd)/tools}"
REPO="https://github.com/zhlynn/zsign.git"
mkdir -p "$DEST"
if [ ! -d "$DEST/zsign-src" ]; then
  git clone --depth 1 "$REPO" "$DEST/zsign-src"
fi
make -C "$DEST/zsign-src/build/linux" -j"$(nproc 2>/dev/null || echo 2)"
echo
echo "zsign built at: $DEST/zsign-src/bin/zsign"
echo "Set this in your environment:  ZSIGN_BIN=$DEST/zsign-src/bin/zsign"
