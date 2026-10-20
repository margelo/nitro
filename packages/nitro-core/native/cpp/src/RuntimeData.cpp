//
//  RuntimeData.cpp
//  NitroModules
//
//  Created by Marc Rousavy on 15.10.26.
//

#include <NitroModules/detail/RuntimeData.hpp>

namespace margelo::nitro::detail {

#ifdef NITRO_DEBUG
// Its address identifies this copy of Nitro Modules. It is writable, so the linker never merges it with another copy's.
static char nitroModulesCopy;

const void* RuntimeData::getNitroModulesCopyIdentifier() {
  return &nitroModulesCopy;
}
#endif

} // namespace margelo::nitro::detail
