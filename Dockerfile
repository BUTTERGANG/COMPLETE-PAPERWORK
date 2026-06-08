# Mirrors Replit's Nix stable-25_05 / nodejs_22 environment
# Build + serve sequence matches .replit exactly

FROM node:22-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-fund --no-audit

COPY . .
RUN npm run build

# --- Production image ---
FROM node:22-bookworm-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig*.json ./

# Replit maps localPort 5000 → externalPort 80 (Vite proxies /api to :3000)
# In production the Express server serves both API and static files on :3000
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Matches Replit: Express serves built PWA from dist/ + API routes
CMD ["npx", "tsx", "server/index.ts"]
