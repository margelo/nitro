#!/bin/bash

set -e

CPP_DIRS=(
  "packages/nitro-core/native/android/src/main/cpp"
  "packages/nitro-core/native/cpp"
  "packages/nitro-core/native/apple"
  "packages/react-native-nitro-modules/android/src/main/cpp"
  "packages/react-native-nitro-modules/include"
  "packages/react-native-nitro-modules/cpp/src"
  "packages/react-native-nitro-modules/apple/src"
  "tests/standalone/hermes/Sources"
  "tests/standalone/nitro-core/android/src/main/cpp"
  "tests/standalone/nitro-test/cpp"
  "tests/standalone/test-runner/cpp"
  "tests/standalone/nitro-test/ios/Support"
  "tests/standalone/test-runner/ios"
  "tests/standalone/nitro-test/android/src/main/cpp"
  "tests/standalone/test-runner/android/src/main/cpp"
  "tests/standalone/nitro-test-external/android/src/main/cpp"
  "tests/standalone/nitro-test-external/ios/Support"
  "tests/react-native/packages/react-native-nitro-test/cpp"
  "tests/react-native/packages/react-native-nitro-test/ios"
  "tests/react-native/packages/react-native-nitro-test/android/src/main/cpp"
)

if which clang-format >/dev/null; then
  DIRS=$(printf "%s " "${CPP_DIRS[@]}")
  find $DIRS -type f \( -name "*.h" -o -name "*.hpp" -o -name "*.cpp" -o -name "*.m" -o -name "*.mm" -o -name "*.c" \) -print0 | while read -d $'\0' file; do
    clang-format -style=file:./config/.clang-format -i "$file"
  done
  echo "C++ Format done!"
else
  echo "error: clang-format not installed, install with 'brew install clang-format' (or manually from https://clang.llvm.org/docs/ClangFormat.html )"
  exit 1
fi
