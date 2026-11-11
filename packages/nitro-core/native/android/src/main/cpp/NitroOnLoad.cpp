#include "NitroOnLoad.hpp"
#include "JAnyMap.hpp"
#include "JAnyValue.hpp"
#include "JArrayBuffer.hpp"
#include "JHardwareBufferUtils.hpp"
#include "JHybridObject.hpp"
#include "JNativeRunnable.hpp"
#include "JPromise.hpp"

namespace margelo::nitro {

void registerNatives() {
  JArrayBuffer::registerNatives();
  JAnyMap::registerNatives();
  JAnyValue::registerNatives();
  JHardwareBufferUtils::registerNatives();
  JPromise::registerNatives();
  JNativeRunnable::registerNatives();
  JHybridObject::CxxPart::registerNatives();
}

} // namespace margelo::nitro
