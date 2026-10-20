#!/usr/bin/env bash
set -euo pipefail
cd "${1:?Usage: build-ios.sh <checkout-root> [application-id]}"
bun install --frozen-lockfile
cd tests/react-native/apps/benchmark
bun spm
cd ios
xcodebuild \
  -derivedDataPath build-benchmark \
  -project NitroBenchmark.xcodeproj \
  -scheme NitroBenchmark \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  "PRODUCT_BUNDLE_IDENTIFIER=${2:-com.margelo.nitrobenchmark}" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build
