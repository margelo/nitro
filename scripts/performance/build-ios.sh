#!/usr/bin/env bash
set -euo pipefail
cd "${1:?Usage: build-ios.sh <checkout-root>}"
bun install --frozen-lockfile
cd apps/benchmark
bundle install
bun pods
cd ios
xcodebuild \
  CC=clang CPLUSPLUS=clang++ LD=clang LDPLUSPLUS=clang++ \
  -derivedDataPath build-benchmark \
  -workspace NitroBenchmark.xcworkspace \
  -scheme NitroBenchmark \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build
