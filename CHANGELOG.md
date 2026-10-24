# Changelog

All notable changes to COMPLETE-PAPERWORK. Newest first.

## 2026-10-23 — Security: dependency vulnerability fixes

Known advisories (OSV) in lockfiles: **2 critical, 37 high, 17 moderate, 7 low → 1 moderate**.

- `package-lock.json` resolved packages through `package-firewall.replit.internal` (unreachable off Replit, which also blocked audit fixes); rewritten to `registry.npmjs.org`
- `npm audit fix` — clears criticals in `proxy-addr`, `shell-quote` and highs in `body-parser`, `react-router`, `form-data`, `vite`, `zod` and others
- `pnpm-lock.yaml` regenerated from `package-lock.json` (`pnpm import`)
- Critical/high advisories cleared in: `proxy-addr`, `shell-quote`, `body-parser`, `brace-expansion`, `browserslist`, `fast-uri`, `form-data`, `nanoid`, `postcss`, `react-router`, `source-map-js`, `vite`, `zod`
- Verified: `npm run build` fails on a pre-existing TypeScript error (`ceremony_pre_time` missing in `EventForm.tsx` / `eventMapper.ts`), identical before these changes
