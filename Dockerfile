# Shared base: DB / LiteFS env used at generate, build, and runtime.
FROM node:24-alpine AS base
ENV LITEFS_DIR="/data"
ENV DATABASE_FILENAME="sqlite.db"
ENV DATABASE_PATH="$LITEFS_DIR/$DATABASE_FILENAME"
ENV DATABASE_URL="file:$DATABASE_PATH"
ENV QUEUE_DATABASE_FILENAME="queue.db"
ENV QUEUE_DATABASE_PATH="$LITEFS_DIR/$QUEUE_DATABASE_FILENAME"
# For WAL support: https://github.com/prisma/prisma-engines/issues/4675#issuecomment-1914383246
ENV PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK="1"

# Development environment
FROM base AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

# Production environment
FROM base AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

# Build environment
# Themes/plugins under app/themes and app/plugins (when present in the build
# context) keep their own package.json dependencies. `prebuild` runs
# `install-extension-deps` so nested node_modules exist for Vite resolution;
# vite.config.js lists those deps in ssr.noExternal so they are bundled into
# build/server and do not need nested node_modules at runtime.
FROM base AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run prisma:generate
RUN npm run build

# Build production image
FROM base

ENV PORT="3000"
ENV NODE_ENV="production"

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
# Theme/plugin i18n overlays are read from disk at runtime (core + email
# catalogs are bundled into build/server). Nested extension node_modules are
# not required — SSR already inlined those deps via ssr.noExternal.
COPY --from=build-env /app/app/themes /app/app/themes
COPY --from=build-env /app/app/plugins /app/app/plugins
WORKDIR /app

EXPOSE 3000
CMD ["npm", "start"]
