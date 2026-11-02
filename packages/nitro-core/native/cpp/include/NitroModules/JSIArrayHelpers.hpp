#pragma once

#include <jsi/jsi.h>

namespace margelo::nitro {

namespace jsi = facebook::jsi;

/** Convert each element directly into a pre-sized JS array. */
template <typename Convert>
jsi::Array createJSIArray(jsi::Runtime& runtime, size_t size, Convert convert) {
  jsi::Array result(runtime, size);
  for (size_t i = 0; i < size; ++i) {
    result.setValueAtIndex(runtime, i, convert(i));
  }
  return result;
}

/** Accept empty arrays; check only the first element to keep union selection inexpensive. */
template <typename CanConvertElement>
bool canConvertJSIArray(jsi::Runtime& runtime, const jsi::Value& value, CanConvertElement canConvertElement) {
  if (!value.isObject()) {
    return false;
  }
  auto object = value.getObject(runtime);
  if (!object.isArray(runtime)) {
    return false;
  }
  auto array = object.getArray(runtime);
  return array.size(runtime) == 0 || canConvertElement(array.getValueAtIndex(runtime, 0));
}

} // namespace margelo::nitro
