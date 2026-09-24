FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package*.json ./apps/web/

RUN npm install --workspaces --include-workspace-root

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
