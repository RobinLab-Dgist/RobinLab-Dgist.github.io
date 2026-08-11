#!/usr/bin/env bash
set -euo pipefail

pnpm install --no-frozen-lockfile
mkdir -p .hugo-bin .go
curl -fsSL https://go.dev/dl/go1.23.5.linux-amd64.tar.gz | tar -xz -C .go
curl -fsSL https://github.com/gohugoio/hugo/releases/download/v0.162.0/hugo_extended_0.162.0_Linux-64bit.tar.gz | tar -xz -C .hugo-bin hugo
