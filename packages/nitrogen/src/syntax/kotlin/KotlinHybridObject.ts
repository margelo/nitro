import { createKotlinHybridViewManager } from '../../views/kotlin/KotlinHybridViewManager.js'
import type { KotlinImplementedInterface } from 'nitro-core'
import { indent } from '../../utils.js'
import { getAllTypes } from '../getAllTypes.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { InstanceMethod } from '../InstanceMethod.js'
import type { Property } from '../Property.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { createFbjniHybridObject } from './FbjniHybridObject.js'
import type { KotlinConstructor } from './KotlinConstructor.js'
import { getKotlinClassMembers } from './KotlinHybridClassBindings.js'
import {
  getKotlinPropertyAccessors,
  KotlinInstanceMethod,
} from './KotlinInstanceMethod.js'
import { getKotlinImplementation } from './KotlinMethodHelpers.js'
import type { KotlinStaticMethod } from './KotlinStaticMethod.js'
import type { KotlinStaticProperty } from './KotlinStaticProperty.js'
import { wrapKotlinType } from './wrapKotlinType.js'
import { getImportCode } from '../getImportCode.js'

export function createKotlinHybridObject(
  spec: HybridObjectSpec<'kotlin'>
): SourceFile[] {
  const name = getHybridObjectName(spec.name)
  const properties = spec.properties.map(getKotlinPropertyCode).join('\n\n')
  const methods = spec.methods.map(getKotlinMethodCode).join('\n\n')
  const companion = getKotlinCompanion(spec)

  const extraImports: SourceImport[] = [
    ...spec.properties.flatMap((p) => p.getRequiredImports('kotlin')),
    ...spec.staticProperties.flatMap((p) => p.getRequiredImports('kotlin')),
    ...spec.methods.flatMap((m) => m.getRequiredImports('kotlin')),
    ...spec.staticMethods.flatMap((m) => m.getRequiredImports('kotlin')),
    ...(spec.constructor?.getRequiredImports('kotlin') ?? []),
    ...companion.imports,
    ...spec.baseTypes.flatMap((b) =>
      new HybridObjectType(b).getRequiredImports('kotlin')
    ),
    {
      name: 'com.margelo.nitro.core.HybridObject',
      language: 'kotlin',
    },
    ...spec.implementedInterfaces.map(getImplementedInterfaceImport),
  ]
  let kotlinBase: string
  let cxxPartBase: string
  if (spec.baseTypes.length > 0) {
    if (spec.baseTypes.length > 1) {
      throw new Error(
        `${name.T}: Inheriting from multiple HybridObject bases is not yet supported in Kotlin!`
      )
    }
    const base = spec.baseTypes[0]!
    const baseHybrid = new HybridObjectType(base)
    kotlinBase = baseHybrid.getCode('kotlin', { context: 'value' })
    cxxPartBase = `${kotlinBase}.CxxPart`
  } else {
    kotlinBase = spec.isHybridView ? 'HybridView' : 'HybridObject'
    if (spec.isHybridView) {
      extraImports.push({
        language: 'kotlin',
        name: 'com.margelo.nitro.views.HybridView',
      })
    }
    cxxPartBase = 'HybridObject.CxxPart'
  }
  const interfaceNames = spec.implementedInterfaces.map(
    (implementedInterface) => implementedInterface.interface
  )
  const supertypes = [`${kotlinBase}()`, ...interfaceNames].join(', ')

  const imports = extraImports
    .map((i) => getImportCode(i))
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
abstract class ${name.HybridTSpec}: ${supertypes} {
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
    ${indent(companion.code, '    ')}
  }
}
  `.trim()

  // 2. Create C++ (fbjni) bindings
  const cppFiles = createFbjniHybridObject(spec)

  // 3. Create enums or structs in Kotlin
  const extraFiles = getAllTypes(spec)
    .map((type) => wrapKotlinType(type))
    .flatMap((t) => t.getExtraFiles())

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
    files.push(...createKotlinHybridViewManager(spec))
  }

  return files
}

interface KotlinCompanion {
  code: string
  imports: SourceImport[]
}

interface KotlinCompanionGroup {
  comment: string
  callables: (KotlinConstructor | KotlinStaticMethod | KotlinStaticProperty)[]
}

/**
 * The companion object holds the forwarders JNI calls to construct the class or call its static methods.
 * They let Kotlin check the implementation at compile time, keep it from being stripped by R8,
 * and call companion statics without `@JvmStatic`.
 * TODO: Remove the Kotlin-side conversions (`convert(..., { in: 'kotlin' })`, for `UInt64`
 * and callback lambdas) once those types cross JNI unchanged.
 */
function getKotlinCompanion(spec: HybridObjectSpec<'kotlin'>): KotlinCompanion {
  const name = getHybridObjectName(spec.name)
  const tagCode = `
protected const val TAG = "${name.HybridTSpec}"
`.trim()
  const { constructor, staticMethods, staticProperties } =
    getKotlinClassMembers(spec)
  const groups: KotlinCompanionGroup[] = []
  if (constructor != null) {
    groups.push({ comment: 'Constructor', callables: [constructor] })
  }
  if (staticMethods.length > 0) {
    groups.push({ comment: 'Static methods', callables: staticMethods })
  }
  if (staticProperties.length > 0) {
    groups.push({
      comment: 'Static properties',
      callables: staticProperties,
    })
  }
  const sections = [tagCode]
  for (const group of groups) {
    const forwarders = group.callables
      .flatMap((callable) => callable.createBridge().kotlinMethods)
      .map(({ method, body }) => method.getDefinition('kotlin', { body: body }))
    const groupCode = `
// ${group.comment}
${forwarders.join('\n\n')}
`.trim()
    sections.push(groupCode)
  }
  const imports: SourceImport[] = []
  if (groups.length > 0) {
    // The forwarders call the implementation by its class name.
    imports.push(getKotlinImplementation(spec).kotlinImport)
  }
  return { code: sections.join('\n\n'), imports: imports }
}

function getKotlinMethodCode(method: InstanceMethod): string {
  const kotlinMethod = new KotlinInstanceMethod({ method: method })
  // Without a forwarder, JNI calls the abstract member directly.
  const declaration = new InstanceMethod(
    method.name,
    method.returnType,
    method.parameters,
    {
      doNotStrip: !kotlinMethod.needsKotlinForwarder,
      pureVirtual: true,
    }
  )
  const forwarders = kotlinMethod
    .createBridge()
    .kotlinMethods.map(({ method: forwarder, body }) =>
      forwarder.getDefinition('kotlin', { body: body })
    )
  return [declaration.getDeclaration('kotlin'), ...forwarders].join('\n\n')
}

function getKotlinPropertyCode(property: Property): string {
  const accessors = getKotlinPropertyAccessors(property)
  // Without forwarders, JNI calls the abstract accessors directly.
  const isCalledFromJni = accessors.every(
    (accessor) => !accessor.needsKotlinForwarder
  )
  const declaration = property.getCode('kotlin', {
    doNotStrip: isCalledFromJni,
    virtual: true,
  })
  const forwarders = accessors
    .flatMap((accessor) => accessor.createBridge().kotlinMethods)
    .map(({ method, body }) => method.getDefinition('kotlin', { body: body }))
  return [declaration, ...forwarders].join('\n\n')
}

function getImplementedInterfaceImport(
  implementedInterface: KotlinImplementedInterface
): SourceImport<'kotlin'> {
  return {
    name: `${implementedInterface.package}.${implementedInterface.interface}`,
    language: 'kotlin',
  }
}
