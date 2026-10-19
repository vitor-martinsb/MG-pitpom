# Toolchains are pinned; runtime contains no SDK, compiler or development packages.
FROM emscripten/emsdk:6.0.11 AS web
RUN apt-get update && apt-get install -y --no-install-recommends cmake ninja-build python3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN cmake -S . -B out/web -G Ninja \
    -DCMAKE_TOOLCHAIN_FILE=/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
    && cmake --build out/web --target golf --parallel 2

FROM node:22.23.3-bookworm AS native
RUN apt-get update && apt-get install -y --no-install-recommends cmake build-essential python3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN cmake -S server/native -B out/server-native -DCMAKE_BUILD_TYPE=Release \
    && cmake --build out/server-native --parallel 2 \
    && ctest --test-dir out/server-native --output-on-failure \
    && cmake -S tests -B out/unit-tests \
    && cmake --build out/unit-tests --parallel 2 \
    && ctest --test-dir out/unit-tests --output-on-failure

FROM node:22.23.3-bookworm AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22.23.3-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=10000
WORKDIR /app
COPY --chown=node:node --from=server /app/server /app/server
COPY --chown=node:node --from=native /app/out/server-native/golf_physics_worker /app/out/server-native/golf_physics_worker
COPY --chown=node:node --from=web /app/out/web/golf.html /app/out/web/golf.js /app/out/web/golf.wasm /app/out/web/golf.wasm.gz /app/out/web/
COPY --chown=node:node --from=web /app/out/web/multiplayer.js /app/out/web/multiplayer.css /app/out/web/course.js /app/out/web/adventure.js /app/out/web/music.js /app/out/web/i18n.js /app/out/web/i18n-data.js /app/out/web/
COPY --chown=node:node --from=web /app/out/web/campaign-data.js /app/out/web/
COPY --chown=node:node --from=web /app/out/web/art/ /app/out/web/art/
COPY --chown=node:node data/ /app/data/
USER node
EXPOSE 10000
CMD ["node", "server/dist/index.js"]
