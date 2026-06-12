FROM oven/bun:1.3.14-alpine AS base

# Dependencies Stage
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY designSystem/package.json ./designSystem/package.json
RUN bun install --frozen-lockfile

# Builder Stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/designSystem/node_modules ./designSystem/node_modules
COPY . .
# Build both frontend and backend
RUN bun run build
RUN bun install --production --frozen-lockfile

# Runner Stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json ./
# Only production dependencies needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/designSystem/node_modules ./designSystem/node_modules
COPY --from=builder /app/designSystem/package.json ./designSystem/package.json
COPY --from=builder /app/designSystem/dist ./designSystem/dist
COPY --from=builder /app/dist-api ./dist-api
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["bun", "dist-api/index.js"]
