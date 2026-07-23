FROM node:20-alpine

WORKDIR /app

COPY apps/portfolio-website/package*.json ./
RUN npm ci

COPY apps/portfolio-website/ ./
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
