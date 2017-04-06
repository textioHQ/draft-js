#!/usr/bin/env bash
set -e
set -o pipefail
set -u

PACKAGE_VERSION=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Beta-ify the version if it's a prod version
sed -i "" -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\",/\"version\": \"$PACKAGE_VERSION-$GIT_BRANCH\",/g" ./package.json

# This will fail if no files changed
git commit -a -m "Cutting beta version $PACKAGE_VERSION-$GIT_BRANCH" || true