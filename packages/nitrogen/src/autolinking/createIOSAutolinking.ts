import type { Autolinking } from './Autolinking.js'
import { createHybridObjectIntializer } from './ios/createHybridObjectInitializer.js'
import { createPodspecRubyExtension } from './ios/createPodspecRubyExtension.js'
import { createSwiftCxxBridge } from './ios/createSwiftCxxBridge.js'
import { createSwiftUmbrellaHeader } from './ios/createSwiftUmbrellaHeader.js'

interface IOSAutolinking extends Autolinking {}

export function createIOSAutolinking(
  hybridViewNames: ReadonlySet<string>
): IOSAutolinking {
  const podspecExtension = createPodspecRubyExtension()
  const swiftCxxBridge = createSwiftCxxBridge()
  const swiftUmbrellaHeader = createSwiftUmbrellaHeader()
  const hybridObjectInitializer = createHybridObjectIntializer(hybridViewNames)

  return {
    platform: 'ios',
    sourceFiles: [
      podspecExtension,
      ...swiftCxxBridge,
      swiftUmbrellaHeader,
      ...hybridObjectInitializer,
    ],
  }
}
