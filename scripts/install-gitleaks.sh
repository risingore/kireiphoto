#!/usr/bin/env bash
# =============================================================================
# install-gitleaks.sh — install the gitleaks secret scanner to ~/.local/bin.
#
# Used together with scripts/git-hooks/pre-push (which calls gitleaks before
# any push leaves the local repo).
#
# Behavior:
#   - If gitleaks is already on PATH: print version and exit 0.
#   - Otherwise: detect platform, fetch the latest release tag from GitHub
#     (override with GITLEAKS_VERSION env var, e.g. "8.21.2"), download the
#     matching tarball, extract gitleaks binary into ~/.local/bin.
#   - Warn if ~/.local/bin is not on PATH.
#
# Supported platforms: Linux x86_64 / Linux arm64 / macOS x86_64 / macOS arm64.
# Windows is out of scope — use WSL or scoop install gitleaks.
# =============================================================================

set -euo pipefail

if command -v gitleaks >/dev/null 2>&1; then
  echo "✓ gitleaks already installed: $(gitleaks version 2>&1 | head -n 1)"
  exit 0
fi

INSTALL_DIR="${HOME}/.local/bin"
mkdir -p "$INSTALL_DIR"

OS=$(uname -s)
ARCH=$(uname -m)
case "${OS}-${ARCH}" in
  Linux-x86_64)   ASSET_ARCH="linux_x64"   ;;
  Linux-aarch64)  ASSET_ARCH="linux_arm64" ;;
  Linux-arm64)    ASSET_ARCH="linux_arm64" ;;
  Darwin-x86_64)  ASSET_ARCH="darwin_x64"  ;;
  Darwin-arm64)   ASSET_ARCH="darwin_arm64" ;;
  *)
    echo "❌ install-gitleaks: unsupported platform ${OS}-${ARCH}."
    echo "   Install manually: https://github.com/gitleaks/gitleaks#installing"
    exit 1
    ;;
esac

# Resolve version. Prefer the env override; otherwise ask GitHub.
VERSION="${GITLEAKS_VERSION:-}"
if [ -z "$VERSION" ]; then
  echo "→ Querying latest gitleaks release tag from GitHub..."
  VERSION=$(curl -fsSL https://api.github.com/repos/gitleaks/gitleaks/releases/latest \
    | grep -E '"tag_name":' \
    | head -n 1 \
    | sed -E 's/.*"v?([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')
  if [ -z "$VERSION" ]; then
    echo "❌ install-gitleaks: failed to resolve latest version."
    echo "   Try:  GITLEAKS_VERSION=8.21.2 bash scripts/install-gitleaks.sh"
    exit 1
  fi
fi

URL="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_${ASSET_ARCH}.tar.gz"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "→ Downloading gitleaks ${VERSION} for ${ASSET_ARCH}..."
echo "  $URL"
curl -fsSL "$URL" -o "$TMPDIR/gitleaks.tar.gz"

echo "→ Extracting..."
tar -xzf "$TMPDIR/gitleaks.tar.gz" -C "$TMPDIR" gitleaks

mv "$TMPDIR/gitleaks" "$INSTALL_DIR/gitleaks"
chmod +x "$INSTALL_DIR/gitleaks"

echo "✓ gitleaks ${VERSION} installed to $INSTALL_DIR/gitleaks"

# PATH check.
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo ""
    echo "⚠  $INSTALL_DIR is not on PATH."
    echo "   Add this line to ~/.bashrc or ~/.zshrc:"
    echo "     export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac
