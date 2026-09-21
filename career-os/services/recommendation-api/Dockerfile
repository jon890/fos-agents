# 추천 Backend 운영 image.
#
# build context 는 이 파일이 있는 `career-os/services/recommendation-api` 디렉터리다.
# 이 package 는 모노레포 루트와 분리된 npm package 라 루트의 파일을 읽지 않는다.
FROM node:22.18.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npm run build

FROM node:22.18.0-bookworm-slim AS runtime

# 시각 컬럼이 `DATETIME(3)` 이라 시간대를 저장하지 않는다.
# 프로세스가 UTC 가 아니면 다시 읽은 시각이 저장한 값과 어긋난다.
ENV TZ=UTC
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=8080

WORKDIR /app

# Prisma CLI 가 libssl 을 찾지 못하면 openssl-1.1.x 를 가정하고 경고를 낸다.
# `migrate` 가 그 CLI 로 도므로 base image 에 없는 openssl 을 넣는다.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# `prisma.config.ts` 와 `prisma/schema.prisma` 는 ENTRYPOINT 의 `migrate` 가 읽는다.
# `prisma/migrations/` 는 `GET /health/ready` 도 읽어 적용되어야 할 migration 이름을 만든다.
# 담지 않으면 준비 확인이 통과하지 못한다.
COPY prisma.config.ts ./
COPY prisma ./prisma

COPY --from=build /app/dist ./dist

EXPOSE 8080
USER node

# 배포 스크립트가 `serve` 와 `migrate` 두 명령을 그대로 넘긴다.
ENTRYPOINT ["node", "dist/src/entrypoint.js"]
CMD ["serve"]
