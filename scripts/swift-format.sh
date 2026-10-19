#!/bin/bash

set -e

SWIFT_DIRS=(
  "packages/nitro-core/native/apple"
  "packages/react-native-nitro-modules/apple/views"
  "tests/standalone/nitro-test/ios"
  "tests/standalone/test-runner/ios"
  "tests/standalone/nitro-test-external/ios"
  "tests/react-native/packages/react-native-nitro-test/ios"
)

if which swift >/dev/null; then
  DIRS=$(printf "%s " "${SWIFT_DIRS[@]}")
  find $DIRS -type f \( -name "*.swift" \) -print0 | while read -d $'\0' file; do
    swift format --in-place "$file"
  done
  echo "Swift Format done!"
else
  echo "error: swift not installed, install the toolchain with Xcode."
  exit 1
fi
