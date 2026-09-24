FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifest files first for layer caching
COPY package*.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package*.json ./apps/api/

RUN npm install --workspaces --include-workspace-root

# Copy source code
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

WORKDIR /app/apps/api
RUN npx prisma generate --schema=src/prisma/schema.prisma
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/src/prisma ./prisma
EXPOSE 4000
CMD ["node", "dist/index.js"]
