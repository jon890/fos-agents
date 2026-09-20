FROM oven/bun:1.3.5-alpine AS runtime

WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production
COPY career-os/services/recommendation-api ./career-os/services/recommendation-api
COPY career-os/scripts/position-recommender/live-postings/contracts.ts ./career-os/scripts/position-recommender/live-postings/contracts.ts

ENV API_HOST=0.0.0.0
ENV API_PORT=8080
EXPOSE 8080
USER bun
ENTRYPOINT ["bun", "career-os/services/recommendation-api/container.ts"]
CMD ["serve"]
