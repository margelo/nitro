#!/bin/bash

# Do not exit on errors
set +e

cd "$(pwd)" || exit 0

# Run commands and ignore any errors
{
  # Install JS lockfiles
  bun i
  bun run build

  # Resolve app Swift packages
  bun example spm
  xcodebuild -resolvePackageDependencies -project tests/react-native/apps/example/ios/NitroExample.xcodeproj -scheme NitroExample
  bun benchmark spm
  xcodebuild -resolvePackageDependencies -project tests/react-native/apps/benchmark/ios/NitroBenchmark.xcodeproj -scheme NitroBenchmark

  # Add everything to git
  git add bun.lock Package.resolved tests/react-native/apps/*/ios/*.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
} || true

# No errors - whatever.
exit 0
