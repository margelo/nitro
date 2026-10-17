#!/bin/sh
set -eu

# Nitrogen uses flat <Module/Header.hpp> imports. Keep that include layout
# without copying or maintaining a second list of the native source headers.
prepare_headers() {
  module="$1"
  shift
  headers="${BUILT_PRODUCTS_DIR:?}/include/$module"
  staging=$(mktemp -d "${BUILT_PRODUCTS_DIR}/$module-headers.XXXXXX")
  trap 'rm -rf "$staging"' EXIT HUP INT TERM

  find "$@" -type f \
    \( -name '*.hpp' -o -name '*.h' \) \
    ! -path '*/cpp/views/*' ! -path '*/apple/turbomodule/*' \
    ! -name 'CallInvokerDispatcher.hpp' | sort | while IFS= read -r header; do
    destination="$staging/$(basename "$header")"
    if [ -L "$destination" ]; then
      echo "error: Duplicate $module header name: $(basename "$header")" >&2
      exit 1
    fi
    ln -s "$header" "$destination"
  done

  mkdir -p "$(dirname "$headers")"
  rm -rf "$headers"
  mv "$staging" "$headers"
}

prepare_headers NitroModules "${NITRO_NATIVE:?}/cpp" "${NITRO_NATIVE}/apple"
prepare_headers NitroTestExternal \
  "${NITRO_EXTERNAL_GENERATED:?}/shared" "${NITRO_EXTERNAL_GENERATED}/ios"
