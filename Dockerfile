# Development environment
FROM node:24-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

# Production environment
FROM node:24-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

# Build environment
FROM node:24-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

# Build production image
FROM node:24-alpine

ENV DATABASE_FILENAME="sqlite.db"
ENV DATABASE_PATH="/data/$DATABASE_FILENAME"
ENV DATABASE_URL="file:$DATABASE_PATH"
ENV QUEUE_DATABASE_FILENAME="queue.db"
ENV QUEUE_DATABASE_PATH="/data/$QUEUE_DATABASE_FILENAME"
ENV PORT="3000"
ENV NODE_ENV="production"
# For WAL support: https://github.com/prisma/prisma-engines/issues/4675#issuecomment-1914383246
ENV PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"

# Add shortcut for connecting to the database CLI.
RUN printf '%s\n' '#!/bin/sh' 'exec sqlite3 "$DATABASE_PATH" "$@"' > /usr/local/bin/dbcli && chmod +x /usr/local/bin/dbcli

RUN apk add ca-certificates sqlite
RUN mkdir -p /data

# Copy application files
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/prisma /app/prisma
COPY --from=build-env /app/prisma.config.js /app/prisma.config.js
COPY --from=build-env /app/build /app/build
WORKDIR /app

EXPOSE 3000
CMD ["npm", "start"]
