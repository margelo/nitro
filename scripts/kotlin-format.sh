#!/bin/bash

set -e

KOTLIN_DIRS=(
  "packages/nitro-core/native/android/src/main/java"
  "packages/react-native-nitro-modules/android/src"
  "tests/standalone/nitro-core/android/src"
  "tests/standalone/runtime/android/src"
  "tests/standalone/external/android/src"
  "tests/react-native/packages/react-native-nitro-test/android/src/main/java"
  "tests/react-native/packages/react-native-nitro-test-external/android/src/main/java"
)

if which ktlint >/dev/null; then
  ktlint --editorconfig=./config/.editorconfig --format "${KOTLIN_DIRS[@]}"
  echo "Kotlin Format done!"
else
  echo "error: ktlint not installed, install with 'brew install ktlint' (see https://github.com/pinterest/ktlint )"
  exit 1
fi
