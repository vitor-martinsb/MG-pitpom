# Toolchains are pinned; runtime contains no SDK, compiler or development packages.
FROM emscripten/emsdk:6.0.11 AS web
RUN apt-get update && apt-get install -y --no-install-recommends cmake ninja-build python3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY CMakeLists.txt config.yml ./
COPY src/ src/
COPY build/ build/
COPY tools/ tools/
COPY data/ data/
RUN cmake -S . -B out/web -G Ninja \
    -DCMAKE_TOOLCHAIN_FILE=/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake \
    -DCMAKE_BUILD_TYPE=Release -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
    && cmake --build out/web --target golf --parallel 2 \
    && mkdir -p /ci/out/web \
    && cp out/web/golf.html out/web/golf.js out/web/golf.wasm out/web/golf.wasm.gz \
       out/web/multiplayer.js out/web/multiplayer.css out/web/course.js \
       out/web/adventure.js out/web/home.js out/web/menu-clock.js out/web/menu-scene.js \
       out/web/music.js out/web/lofi.js out/web/i18n.js out/web/i18n-data.js \
       out/web/campaign-data.js /ci/out/web/ \
    && cp -r out/web/art /ci/out/web/art

FROM node:22.23.3-bookworm AS native-build
RUN apt-get update && apt-get install -y --no-install-recommends cmake build-essential python3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY src/ src/
COPY server/native/ server/native/
COPY tests/ tests/
COPY build/generate-i18n.py build/generate-i18n.py
COPY data/ data/
RUN cmake -S server/native -B out/server-native -DCMAKE_BUILD_TYPE=Release \
    && cmake --build out/server-native --parallel 2 \
    && cmake -S tests -B out/unit-tests \
    && cmake --build out/unit-tests --parallel 2 \
    && mkdir -p /ci/out/server-native /ci/out/unit-tests \
    && cp out/server-native/golf_* /ci/out/server-native/ \
    && cp out/unit-tests/golf_* /ci/out/unit-tests/

# Export executable files only. CI regenerates CTest paths in its own checkout.
FROM scratch AS ci-native-artifacts
COPY --from=native-build /ci/ /

FROM scratch AS ci-web-artifacts
COPY --from=web /ci/ /

# A normal production build still runs every native test. CI runs the same
# tests in required shards, independently of the container smoke check.
FROM native-build AS native-checked
RUN ctest --test-dir out/server-native --output-on-failure --parallel 2 \
    && ctest --test-dir out/unit-tests --output-on-failure \
    && touch /ci/native-tests-passed

FROM node:22.23.3-bookworm AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22.23.3-bookworm-slim AS ci-runtime
ENV NODE_ENV=production PORT=10000
WORKDIR /app
COPY --chown=node:node --from=server /app/server /app/server
COPY --chown=node:node --from=native-build /app/out/server-native/golf_physics_worker /app/out/server-native/golf_physics_worker
COPY --chown=node:node --from=web /ci/out/web/ /app/out/web/
COPY --chown=node:node data/ /app/data/
USER node
EXPOSE 10000
CMD ["node", "server/dist/index.js"]

# Keep runtime last: Render and `docker build .` require the full native suite.
FROM ci-runtime AS runtime
COPY --from=native-checked /ci/native-tests-passed /app/native-tests-passed
