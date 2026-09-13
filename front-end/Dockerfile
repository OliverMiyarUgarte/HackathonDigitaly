FROM node:22-alpine AS contracts
WORKDIR /app
COPY service-contracts/package.json service-contracts/package-lock.json ./service-contracts/
RUN cd service-contracts && npm ci --ignore-scripts
COPY service-contracts ./service-contracts
RUN cd service-contracts && npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY --from=contracts /app/service-contracts ./service-contracts
COPY front-end/package.json front-end/package-lock.json ./front-end/
RUN cd front-end && npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/service-contracts ./service-contracts
COPY --from=deps /app/front-end/node_modules ./front-end/node_modules
COPY front-end ./front-end
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd front-end && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/front-end/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/front-end/.next/static ./front-end/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/front-end/public ./front-end/public

WORKDIR /app/front-end

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
