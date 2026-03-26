FROM node:20-alpine

WORKDIR /app

# Puppeteer를 위한 Chromium 및 의존성 설치
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tzdata

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install --only=production

COPY . .

ENV TZ=Asia/Seoul
ENV NODE_ENV=production
ENV PORT=3004

EXPOSE 3004

CMD ["node", "src/server.js"]
