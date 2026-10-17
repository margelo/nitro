#!/bin/bash

set -e

NITRO_CPP="packages/react-native-nitro-modules/cpp"

CPP_DIRS=(
  # react-native-nitro-modules
  "$NITRO_CPP"
  # react-native-nitro-test
  "packages/react-native-nitro-test/cpp"
)

# Include paths needed to resolve all #includes.
# In a real build (CocoaPods/CMake) these are set by the build system,
# but for standalone clang-tidy we need to supply them manually.
INCLUDE_DIRS=(
  "$NITRO_CPP/core"
  "$NITRO_CPP/entrypoint"
  "$NITRO_CPP/jsi"
  "$NITRO_CPP/platform"
  "$NITRO_CPP/prototype"
  "$NITRO_CPP/registry"
  "$NITRO_CPP/templates"
  "$NITRO_CPP/threading"
  "$NITRO_CPP/utils"
  "$NITRO_CPP/views"
  # JSI headers from react-native
  "node_modules/react-native/ReactCommon/jsi"
)

INCLUDE_FLAGS=""
for dir in "${INCLUDE_DIRS[@]}"; do
  INCLUDE_FLAGS="$INCLUDE_FLAGS -I$dir"
done

if which clang-tidy >/dev/null; then
  DIRS=$(printf "%s " "${CPP_DIRS[@]}")
  FILES=$(find $DIRS -type f \( -name "*.h" -o -name "*.hpp" -o -name "*.cpp" \))

  if [ -z "$FILES" ]; then
    echo "No C++ files found!"
    exit 1
  fi

  echo "Running clang-tidy on $(echo "$FILES" | wc -l | tr -d ' ') files..."

  FAILED=0
  while IFS= read -r file; do
    if ! clang-tidy --config-file=./config/.clang-tidy -p=. --quiet "$file" -- -std=c++20 -x c++ $INCLUDE_FLAGS 2>/dev/null; then
      FAILED=1
    fi
  done <<< "$FILES"

  if [ $FAILED -ne 0 ]; then
    echo "clang-tidy found issues!"
    exit 1
  fi

  echo "clang-tidy done!"
else
  echo "error: clang-tidy not installed, install with 'brew install llvm' (or manually from https://clang.llvm.org/extra/clang-tidy/ )"
  exit 1
fi
