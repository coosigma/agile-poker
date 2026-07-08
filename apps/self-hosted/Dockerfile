FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/self-hosted/package.json apps/self-hosted/package.json
COPY packages/app-core/package.json packages/app-core/package.json
RUN corepack enable && pnpm install --no-frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @agile-poker/self-hosted build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 8788
CMD ["pnpm", "--filter", "@agile-poker/self-hosted", "start"]
