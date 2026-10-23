#include "NitroOnLoad.hpp"
#include "JArrayBuffer.hpp"
#include "JGlobalErrorHandler.hpp"
#include "JHardwareBufferUtils.hpp"
#include "JHybridObject.hpp"
#include "JNativeRunnable.hpp"
#include "JPromise.hpp"

namespace margelo::nitro {

void registerNatives() {
  facebook::jni::ThreadScope::OnLoad();
  JArrayBuffer::registerNatives();
  JGlobalErrorHandler::registerNatives();
  JHardwareBufferUtils::registerNatives();
  JPromise::registerNatives();
  JNativeRunnable::registerNatives();
  JHybridObject::CxxPart::registerNatives();
}

} // namespace margelo::nitro
