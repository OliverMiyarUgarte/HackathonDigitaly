FROM node:22-alpine AS build
WORKDIR /app

COPY service-contracts/package.json service-contracts/package-lock.json ./service-contracts/
COPY Backend/package.json Backend/package-lock.json ./Backend/

RUN cd ./service-contracts && npm ci --ignore-scripts
RUN cd ./Backend && npm ci --ignore-scripts

COPY service-contracts ./service-contracts
COPY Backend ./Backend

RUN cd ./service-contracts && npm run build

ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/digitaly_build?schema=public"
RUN cd ./Backend && npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=build /app/Backend/package.json /app/Backend/package-lock.json ./
COPY --from=build /app/Backend/prisma.config.ts ./
COPY --from=build /app/Backend/prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/service-contracts/package.json /service-contracts/package.json
COPY --from=build /app/service-contracts/dist /service-contracts/dist

COPY --from=build /app/Backend/dist ./dist
COPY --from=build /app/Backend/src/generated ./src/generated

RUN mkdir -p /app/uploads && chown -R nestjs:nodejs /app/uploads

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main"]
