#!/usr/bin/env bash
set -eo pipefail

case "${1:-}" in
  "") options=(--in-place) ;;
  --check) options=(lint --strict) ;;
  *) echo "Usage: $0 [--check]" >&2; exit 1 ;;
esac
source "$(dirname "$0")/format-files.sh" '*.swift'
[[ ${#files[@]} -eq 0 ]] && exit 0
swift format "${options[@]}" --configuration config/.swift-format "${files[@]}"
