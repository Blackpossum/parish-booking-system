# Multi-stage build for the NestJS API.
#
# Deliberately explicit rather than relying on a buildpack: the auto-detected
# builders kept producing runtime images that were missing the compiled `dist`
# output when a custom build command was used.

# ---- build stage -------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

# Prisma's query engine needs openssl.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# --include=dev because the build needs typescript and @nestjs/cli, which are
# devDependencies and would otherwise be skipped under NODE_ENV=production.
RUN npm ci --include=dev

COPY . .
RUN npx prisma generate && npm run build

# ---- runtime stage -----------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package.json package-lock.json ./
# `prisma` is a runtime dependency (the container runs `migrate deploy` on boot),
# so it survives --omit=dev.
RUN npm ci --omit=dev

# Regenerate the client against the production dependency tree.
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Railway/Render inject PORT; the app binds 0.0.0.0 and falls back to 3000.
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
