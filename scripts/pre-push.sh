#!/usr/bin/env bash
# pre-push.sh — Fast local checks before pushing to GitHub
# Install: ln -sf ../../scripts/pre-push.sh .git/hooks/pre-push

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}▶ Pre-push checks...${NC}"

# TypeScript type check
echo -e "${YELLOW}  tsc --noEmit...${NC}"
if npx tsc --noEmit 2>&1; then
  echo -e "${GREEN}  ✓ TypeScript OK${NC}"
else
  echo -e "${RED}  ✗ TypeScript errors — fix before pushing${NC}"
  exit 1
fi

# Vite build
echo -e "${YELLOW}  vite build...${NC}"
if npm run build 2>&1; then
  echo -e "${GREEN}  ✓ Build OK${NC}"
else
  echo -e "${RED}  ✗ Build failed — fix before pushing${NC}"
  exit 1
fi

# Validate build output
echo -e "${YELLOW}  Checking dist/index.html...${NC}"
if test -f dist/index.html && grep -q 'src="' dist/index.html; then
  echo -e "${GREEN}  ✓ Build output valid${NC}"
else
  echo -e "${RED}  ✗ dist/index.html missing or invalid${NC}"
  exit 1
fi

# ESLint (non-blocking — just warn)
echo -e "${YELLOW}  eslint (warnings only)...${NC}"
npm run lint 2>&1 || echo -e "${YELLOW}  ⚠ Lint issues found (non-blocking)${NC}"

echo -e "${GREEN}▶ Pre-push checks passed!${NC}"
