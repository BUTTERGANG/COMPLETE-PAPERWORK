#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

export CI=1

# Keep dependencies and compiled output in sync with merged source.
npm install --no-audit --no-fund --no-progress
npm run build

# Database migrations are intentionally not run here. This app uses a shared
# external Neon database whose live schema may not be represented by a Drizzle
# migration ledger; migrations must be checked against the live schema first.