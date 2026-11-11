import { indent } from '../../utils.js'
import { createKotlinHybridViewManager } from '../../views/kotlin/KotlinHybridViewManager.js'
import { getAllTypes } from '../getAllTypes.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { Method } from '../Method.js'
import { Property } from '../Property.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { createFbjniHybridObject } from './FbjniHybridObject.js'
import { KotlinCxxBridgedType } from './KotlinCxxBridgedType.js'

export function createKotlinHybridObject(spec: HybridObjectSpec): SourceFile[] {
  const name = getHybridObjectName(spec.name)
  const properties = spec.properties
    .map((p) => getPropertyForwardImplementation(p))
    .join('\n\n')
  const methods = spec.methods
    .map((m) => getMethodForwardImplementation(m))
    .join('\n\n')

  const extraImports: SourceImport[] = [
    ...spec.properties.flatMap((p) => p.getRequiredImports('kotlin')),
    ...spec.methods.flatMap((m) => m.getRequiredImports('kotlin')),
    ...spec.baseTypes.flatMap((b) =>
      new HybridObjectType(b).getRequiredImports('kotlin')
    ),
    {
      name: 'com.margelo.nitro.core.HybridObject',
      space: 'system',
      language: 'kotlin',
    },
  ]
  if (spec.isHybridView) {
    extraImports.push({
      name: 'com.margelo.nitro.views.HybridView',
      space: 'system',
      language: 'kotlin',
    })
  }

  let kotlinBase = spec.isHybridView ? 'HybridView' : 'HybridObject'
  let cxxPartBase = 'HybridObject.CxxPart'
  if (spec.baseTypes.length > 0) {
    if (spec.baseTypes.length > 1) {
      throw new Error(
        `${name.T}: Inheriting from multiple HybridObject bases is not yet supported in Kotlin!`
      )
    }
    const base = spec.baseTypes[0]!
    const baseHybrid = new HybridObjectType(base)
    kotlinBase = baseHybrid.getCode('kotlin')
    cxxPartBase = `${kotlinBase}.CxxPart`
  }

  const imports = extraImports
    .map((i) => `import ${i.name}`)
    .filter(isNotDuplicate)

  const javaPackage = spec.config.getAndroidPackage('java/kotlin')

  // 1. Create Kotlin abstract class definition
  const abstractClassCode = `
${createFileMetadataString(`${name.HybridTSpec}.kt`)}

package ${javaPackage}

import androidx.annotation.Keep
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
import dalvik.annotation.optimization.FastNative
${imports.join('\n')}

/**
 * A Kotlin class representing the ${spec.name} HybridObject.
 * Implement this abstract class to create Kotlin-based instances of ${spec.name}.
 */
@DoNotStrip
@Keep
@Suppress(
  "KotlinJniMissingFunction", "unused",
  "RedundantSuppression", "RedundantUnitReturnType", "SimpleRedundantLet",
  "LocalVariableName", "PropertyName", "PrivatePropertyName", "FunctionName"
)
abstract class ${name.HybridTSpec}: ${kotlinBase}() {
  // Properties
  ${indent(properties, '  ')}

  // Methods
  ${indent(methods, '  ')}

  // Default implementation of \`HybridObject.toString()\`
  override fun toString(): String {
    return "[HybridObject ${name.T}]"
  }

  // C++ backing class
  @DoNotStrip
  @Keep
  protected open class CxxPart(javaPart: ${name.HybridTSpec}): ${cxxPartBase}(javaPart) {
    // C++ ${name.JHybridTSpec}::CxxPart::initHybrid(...)
    @FastNative
    external override fun initHybrid(): HybridData
  }
  override fun createCxxPart(): CxxPart {
    return CxxPart(this)
  }

  companion object {
    protected const val TAG = "${name.HybridTSpec}"
  }
}
  `.trim()

  // 2. Create C++ (fbjni) bindings
  const cppFiles = createFbjniHybridObject(spec)

  // 3. Create enums or structs in Kotlin
  const extraFiles = getAllTypes(spec)
    .map((t) => new KotlinCxxBridgedType(t))
    .flatMap((b) => b.getExtraFiles())

  const files: SourceFile[] = []
  files.push({
    content: abstractClassCode,
    language: 'kotlin',
    name: `${name.HybridTSpec}.kt`,
    subdirectory: spec.config.getAndroidPackageDirectory(),
    platform: 'android',
  })
  files.push(...cppFiles)
  files.push(...extraFiles)

  if (spec.isHybridView) {
    const viewFiles = createKotlinHybridViewManager(spec)
    files.push(...viewFiles)
  }

  return files
}

function getMethodForwardImplementation(method: Method): string {
  const bridgedReturn = new KotlinCxxBridgedType(method.returnType)
  const requiresBridge =
    bridgedReturn.needsSpecialHandling ||
    method.parameters.some((p) => {
      const bridged = new KotlinCxxBridgedType(p.type)
      return bridged.needsSpecialHandling
    })

  if (requiresBridge) {
    const paramsSignature = method.parameters.map((p) => {
      const bridge = new KotlinCxxBridgedType(p.type)
      return `${p.name}: ${bridge.getTypeCode('kotlin')}`
    })
    const paramsForward = method.parameters.map((p) => {
      const bridge = new KotlinCxxBridgedType(p.type)
      return bridge.parseFromCppToKotlin(p.name, 'kotlin')
    })
    const returnForward = bridgedReturn.parseFromKotlinToCpp(
      '__result',
      'kotlin'
    )
    const code = method.getCode('kotlin', { virtual: true })
    return `
${code}

@DoNotStrip
@Keep
private fun ${method.name}_cxx(${paramsSignature.join(', ')}): ${bridgedReturn.getTypeCode('kotlin')} {
  val __result = ${method.name}(${paramsForward.join(', ')})
  return ${returnForward}
}
    `.trim()
  } else {
    const code = method.getCode('kotlin', { doNotStrip: true, virtual: true })
    return code
  }
}

function getPropertyForwardImplementation(property: Property): string {
  const bridged = new KotlinCxxBridgedType(property.type)
  if (bridged.needsSpecialHandling) {
    let keyword = property.isReadonly ? 'val' : 'var'
    let lines: string[] = []
    lines.push(
      `
@Keep
@DoNotStrip
get() {
  return ${indent(bridged.parseFromKotlinToCpp(property.name, 'kotlin'), '  ')}
}
    `.trim()
    )
    if (!property.isReadonly) {
      lines.push(
        `
@Keep
@DoNotStrip
set(value) {
  ${property.name} = ${indent(bridged.parseFromCppToKotlin('value', 'kotlin'), '  ')}
}
      `.trim()
      )
    }
    const code = property.getCode('kotlin', {
      virtual: true,
    })
    return `
${code}

private ${keyword} ${property.name}_cxx: ${bridged.getTypeCode('kotlin')}
  ${indent(lines.join('\n'), '  ')}
    `.trim()
  } else {
    const code = property.getCode('kotlin', {
      doNotStrip: true,
      virtual: true,
    })
    return code
  }
}
