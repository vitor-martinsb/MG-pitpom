#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
: "${EMSDK:?Activate the Emscripten SDK before building}"
cmake -S . -B out/web -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake" \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
  -DGOLF_SANITIZE_ADDRESS=OFF
cmake --build out/web --target golf --parallel 2
