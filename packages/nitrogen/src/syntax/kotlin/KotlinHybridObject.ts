import { createKotlinHybridViewManager } from '../../views/kotlin/KotlinHybridViewManager.js'
import type { KotlinImplementedInterface } from 'nitro-core'
import { indent } from '../../utils.js'
import { getAllTypes } from '../getAllTypes.js'
import { getHybridObjectName } from '../getHybridObjectName.js'
import { createFileMetadataString, isNotDuplicate } from '../helpers.js'
import type { HybridObjectSpec } from '../HybridObjectSpec.js'
import { InstanceMethod } from '../InstanceMethod.js'
import { Property } from '../Property.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import { HybridObjectType } from '../types/HybridObjectType.js'
import { createFbjniHybridObject } from './FbjniHybridObject.js'
import type { KotlinConstructor } from './KotlinConstructor.js'
import { getKotlinClassMembers, getKotlinDirectCode } from './KotlinHybridClassBindings.js'
import { getKotlinPropertyAccessors, KotlinInstanceMethod } from './KotlinInstanceMethod.js'
import { getKotlinImplementation } from './KotlinMethodHelpers.js'
import type { KotlinStaticMethod } from './KotlinStaticMethod.js'
import type { KotlinStaticProperty } from './KotlinStaticProperty.js'
import { wrapKotlinType } from './wrapKotlinType.js'
import { getImportCode } from '../getImportCode.js'
import { KotlinHybridObjectType } from './types/KotlinHybridObjectType.js'

export function createKotlinHybridObject(spec: HybridObjectSpec<'kotlin'>): SourceFile[] {
  const hybridObject = new KotlinHybridObjectType(new HybridObjectType(spec))
  const name = getHybridObjectName(spec.name)
  const properties = spec.properties.map(getKotlinPropertyCode).join('\n\n')
  const methods = spec.methods.map(getKotlinMethodCode).join('\n\n')
  const companionProperties = spec.staticProperties.map((property) => property.getCode('kotlin')).join('\n\n')
  const companionMethodRequirements = spec.staticMethods.map((method) => {
    const requirement = new InstanceMethod(method.name, method.returnType, method.parameters)
    return requirement.getDeclaration('kotlin')
  })
  if (spec.constructor != null) {
    const constructorRequirement = getKotlinConstructorRequirement(spec)
    companionMethodRequirements.unshift(constructorRequirement)
  }
  const companionMethods = companionMethodRequirements.join('\n\n')
  const bridgeCompanion = getKotlinCompanion(spec)
  const cxxPartMembers = getKotlinCxxPartMembers({ spec: spec, hybridObject: hybridObject })

  const jniTypes = getAllTypes(spec).map((type) => wrapKotlinType(type, { config: spec.config }))
  const jniImports = jniTypes.flatMap((type) => type.getRequiredImports('kotlin'))
  const extraImports: SourceImport[] = [
    ...jniImports,
    ...spec.properties.flatMap((p) => p.getRequiredImports('kotlin')),
    ...spec.staticProperties.flatMap((p) => p.getRequiredImports('kotlin')),
    ...spec.methods.flatMap((m) => m.getRequiredImports('kotlin')),
    ...spec.staticMethods.flatMap((m) => m.getRequiredImports('kotlin')),
    ...(spec.constructor?.getRequiredImports('kotlin') ?? []),
    ...bridgeCompanion.imports,
    ...cxxPartMembers.imports,
    ...spec.baseTypes.flatMap((b) => new HybridObjectType(b).getRequiredImports('kotlin')),
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
      throw new Error(`${name.T}: Inheriting from multiple HybridObject bases is not yet supported in Kotlin!`)
    }
    const base = spec.baseTypes[0]
    if (base == null) {
      throw new Error(`${name.T}: Expected a Kotlin base class.`)
    }
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
  const interfaceNames = spec.implementedInterfaces.map((implementedInterface) => implementedInterface.interface)
  const supertypes = [`${kotlinBase}()`, ...interfaceNames].join(', ')

  const imports = extraImports.map((i) => getImportCode(i)).filter(isNotDuplicate)

  const javaPackage = spec.config.getAndroidPackage('java/kotlin')

  const directCode = getKotlinDirectCode(spec)
  const directKotlinCode = directCode != null ? `\n${directCode.kotlinCode}` : ''

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
    ${indent(cxxPartMembers.code, '    ')}
  }
  override fun createCxxPart(): CxxPart {
    return CxxPart(this)
  }

  interface Companion {
    // Static Properties
    ${indent(companionProperties, '    ')}

    // Static Methods
    ${indent(companionMethods, '    ')}
  }

  protected companion object Bridge {
    ${indent(bridgeCompanion.code, '    ')}
  }
}
${directKotlinCode}
  `.trim()

  // 2. Create C++ (fbjni) bindings
  const cppFiles = createFbjniHybridObject({ spec: spec, hybridObject: hybridObject })

  // 3. Create enums or structs in Kotlin
  const nativeTypes = getAllTypes(spec)
  const kotlinTypes = nativeTypes.map((type) => wrapKotlinType(type))
  const extraFiles = kotlinTypes.flatMap((type) => type.getExtraFiles())

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

interface KotlinCxxPartMembersOptions {
  spec: HybridObjectSpec<'kotlin'>
  hybridObject: KotlinHybridObjectType
}

function getKotlinConstructorRequirement(spec: HybridObjectSpec<'kotlin'>): string {
  if (spec.constructor == null) return ''
  const constructor = spec.constructor
  const parameters = constructor.parameters.map((parameter) => parameter.getCode('kotlin'))
  const implementation = getKotlinImplementation(spec)
  let returnType: string
  if (spec.allowMultipleImplementations) {
    returnType = constructor.returnType.getCode('kotlin', { context: 'return' })
  } else {
    returnType = implementation.className
  }
  const requirement = `
fun constructor(${parameters.join(', ')}): ${returnType}
`.trim()
  return `
/** Creates an instance for JavaScript's \`new ${spec.name}(...)\`. */
${requirement}
`.trim()
}

function getKotlinCxxPartMembers({ spec, hybridObject }: KotlinCxxPartMembersOptions): KotlinCompanion {
  const name = getHybridObjectName(spec.name)
  const initHybridCode = `
// C++ ${name.JHybridTSpec}::CxxPart::initHybrid(...)
@FastNative
external override fun initHybrid(): HybridData
`.trim()
  const sections = [initHybridCode]
  const imports: SourceImport[] = []
  if (hybridObject.canUseNonvirtualJniCalls) {
    const implementation = getKotlinImplementation(spec)
    imports.push(implementation.kotlinImport)
    // A class literal keeps the implementation reachable after R8 renaming.
    const implementationClassCode = `
companion object {
  @DoNotStrip
  @Keep
  @JvmField
  val implementationClass_cxx: Class<out ${name.HybridTSpec}> = ${implementation.className}::class.java
}
`.trim()
    sections.push(implementationClassCode)
  }
  return { code: sections.join('\n\n'), imports: imports }
}

/**
 * The companion object holds the bridges JNI calls to construct the class or call its static methods.
 * They let Kotlin check the implementation at compile time, keep it from being stripped by R8,
 * and expose actual JVM static methods through `@JvmStatic`.
 * TODO: Remove the Kotlin-side conversions (`convert(..., { in: 'kotlin' })`, for `UInt64`
 * and callback lambdas) once those types cross JNI unchanged.
 */
function getKotlinCompanion(spec: HybridObjectSpec<'kotlin'>): KotlinCompanion {
  const name = getHybridObjectName(spec.name)
  const tagCode = `
protected const val TAG = "${name.HybridTSpec}"
`.trim()
  const { constructor, staticMethods, staticProperties } = getKotlinClassMembers(spec)
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
  const imports: SourceImport[] = []
  if (spec.implementation != null) {
    const implementation = getKotlinImplementation(spec)
    // Every configured implementation must declare its companion contract.
    const companionRequirement = `
private val implementationCompanion: Companion
  get() = ${implementation.className}
`.trim()
    sections.push(companionRequirement)
    imports.push(implementation.kotlinImport)
  }
  for (const group of groups) {
    const bridges = group.callables
      .flatMap((callable) => callable.createBridge().kotlinMethods)
      .map(({ method, body }) => method.getDefinition('kotlin', { body: body }))
    const groupCode = `
// ${group.comment}
${bridges.join('\n\n')}
`.trim()
    sections.push(groupCode)
  }
  return { code: sections.join('\n\n'), imports: imports }
}

function getKotlinMethodCode(method: InstanceMethod): string {
  const kotlinMethod = new KotlinInstanceMethod({ method: method })
  // Without a bridge, JNI calls the abstract member directly.
  const declaration = new InstanceMethod(method.name, method.returnType, method.parameters, {
    doNotStrip: !kotlinMethod.needsKotlinBridge,
    pureVirtual: true,
  })
  const bridges = kotlinMethod
    .createBridge()
    .kotlinMethods.map(({ method: bridge, body }) => bridge.getDefinition('kotlin', { body: body }))
  return [declaration.getDeclaration('kotlin'), ...bridges].join('\n\n')
}

function getKotlinPropertyCode(property: Property): string {
  const accessors = getKotlinPropertyAccessors(property)
  // Without bridges, JNI calls the abstract accessors directly.
  const isCalledFromJni = accessors.every((accessor) => !accessor.needsKotlinBridge)
  const declaration = property.getCode('kotlin', {
    doNotStrip: isCalledFromJni,
    virtual: true,
  })
  const bridges = accessors
    .flatMap((accessor) => accessor.createBridge().kotlinMethods)
    .map(({ method, body }) => method.getDefinition('kotlin', { body: body }))
  return [declaration, ...bridges].join('\n\n')
}

function getImplementedInterfaceImport(implementedInterface: KotlinImplementedInterface): SourceImport<'kotlin'> {
  return {
    name: `${implementedInterface.package}.${implementedInterface.interface}`,
    language: 'kotlin',
  }
}
