FROM node:20-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY . .

ARG AUTODASH_BASE_PATH=/auto-dashboard
ARG NEXT_PUBLIC_API_BASE_URL=/api/auto-dashboard
ENV AUTODASH_BASE_PATH=${AUTODASH_BASE_PATH}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

RUN npm run build

EXPOSE 8020

CMD ["npm", "run", "start", "--", "-p", "8020"]
