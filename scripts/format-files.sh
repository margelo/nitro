#!/usr/bin/env bash

# Sourced by the native formatters with their file patterns as arguments.
cd "$(dirname "${BASH_SOURCE[0]}")/.."
files=()
while IFS= read -r -d '' file; do
  if [[ -f "$file" ]]; then
    files+=("$file")
  fi
done < <(
  git ls-files --cached --others --exclude-standard --deduplicate -z -- "$@" \
    ':(exclude,glob)**/nitrogen/generated/**' \
    ':(exclude,glob)**/node_modules/**' \
    ':(exclude,glob)**/.build/**' \
    ':(exclude,glob)**/.harness/**' \
    ':(exclude,glob)**/build/**' \
    ':(exclude,glob)**/dist/**' \
    ':(exclude,glob)**/lib/**' \
    ':(exclude,glob)**/Pods/**' \
    ':(exclude,glob)**/vendor/**' \
    ':(exclude)tests/standalone/hermes/hermes/**'
)
