#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-patch}"
cd packages/cli
npm version "$BUMP" --no-git-tag-version
cd ../..

VERSION=$(jq -r .version packages/cli/package.json)
TAG="v${VERSION}"
TARBALL="vercel-vercel-extensions-${VERSION}.tgz"

echo "Building CLI v${VERSION}..."
pnpm turbo build --filter=@vercel/vercel-extensions...

echo "Packing..."
pnpm pack --pack-destination /tmp -C packages/cli
TARBALL_PATH="/tmp/${TARBALL}"

if gh release view "$TAG" --repo samcx/vercel-extensions &>/dev/null; then
  echo "Release ${TAG} exists, replacing..."
  gh release delete "$TAG" --repo samcx/vercel-extensions --yes
fi

echo "Creating release ${TAG}..."
gh release create "$TAG" "$TARBALL_PATH" \
  --repo samcx/vercel-extensions \
  --title "$TAG" \
  --notes "Vercel CLI fork build"

echo ""
echo "Published: https://github.com/samcx/vercel-extensions/releases/download/${TAG}/${TARBALL}"
