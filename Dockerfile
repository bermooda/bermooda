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

ENV LITEFS_DIR="/litefs/data"
ENV DATABASE_FILENAME="sqlite.db"
ENV DATABASE_PATH="$LITEFS_DIR/$DATABASE_FILENAME"
ENV DATABASE_URL="file:$DATABASE_PATH"
ENV QUEUE_DATABASE_FILENAME="queue.db"
ENV QUEUE_DATABASE_PATH="$LITEFS_DIR/$QUEUE_DATABASE_FILENAME"
ENV INTERNAL_PORT="8080"
ENV PORT="8081"
ENV NODE_ENV="production"
# For WAL support: https://github.com/prisma/prisma-engines/issues/4675#issuecomment-1914383246
ENV PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"

# Add shortcut for connecting to database CLI
RUN printf '%s\n' '#!/bin/sh' 'set -x' 'sqlite3 $DATABASE_PATH' > /usr/local/bin/dbconn && chmod +x /usr/local/bin/dbconn

# Install necessary dependencies for LiteFS
RUN apk add ca-certificates fuse3 sqlite

# Create directories for LiteFS and the database
RUN mkdir -p /data ${LITEFS_DIR}
ADD etc/litefs.yml /etc/litefs.yml

# Pull in LiteFS binary
COPY --from=flyio/litefs:0.5.11 /usr/local/bin/litefs /usr/local/bin/litefs

# Copy application files
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/prisma /app/prisma
COPY --from=build-env /app/prisma.config.js /app/prisma.config.js
COPY --from=build-env /app/build /app/build
WORKDIR /app

# Run LiteFS as the entrypoint. After it has connected and sync'd with the
# cluster, it will run the commands listed in the "exec" field of the config.
CMD ["litefs", "mount"]
