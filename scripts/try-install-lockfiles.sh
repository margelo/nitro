#!/bin/bash

# Do not exit on errors
set +e

cd "$(pwd)" || exit 0

# Run commands and ignore any errors
{
  # Install JS lockfiles
  bun i
  bun run build

  # Refresh both apps' Ruby and CocoaPods lockfiles
  for app in apps/example apps/benchmark; do
    bun --cwd "$app" bundle-install
    bun --cwd "$app" pods
    git add "$app/Gemfile.lock" "$app/ios/Podfile.lock"
  done

  git add bun.lock
} || true

# No errors - whatever.
exit 0
