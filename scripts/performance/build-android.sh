#!/usr/bin/env bash
set -euo pipefail
cd "${1:?Usage: build-android.sh <checkout-root>}"
# Keep both revisions on the NDK version recorded by this CI testbed.
grep -Fq 'ndkVersion = "29.0.14206865"' apps/benchmark/android/build.gradle
bun install --frozen-lockfile
cd apps/benchmark/android
./gradlew :app:assembleRelease --no-daemon --build-cache -PreactNativeArchitectures=x86_64
