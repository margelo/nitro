import type { Language } from '../../getPlatformSpecs.js'
import type { HybridObjectSpec } from '../../syntax/HybridObjectSpec.js'
import type { KotlinCppConverter } from '../../syntax/kotlin/KotlinConverter.js'
import { KotlinHybridObjectType } from '../../syntax/kotlin/types/KotlinHybridObjectType.js'
import type { JNINativeRegistration, KotlinConversion, KotlinType } from '../../syntax/kotlin/types/KotlinType.js'
import type { SourceFile, SourceImport } from '../../syntax/SourceFile.js'
import { HybridObjectType } from '../../syntax/types/HybridObjectType.js'
import type { GetCodeOptions, Type } from '../../syntax/types/Type.js'
import { getViewComponentNames } from '../CppHybridViewComponent.js'

/** A Kotlin HybridView also owns the JNI entry point that applies Fabric props. */
export class KotlinHybridViewType implements KotlinType {
  readonly type: KotlinHybridObjectType
  readonly stateUpdaterName: string
  readonly jniValueKind = 'object'

  constructor(spec: HybridObjectSpec<'kotlin'>) {
    this.type = new KotlinHybridObjectType(new HybridObjectType(spec))
    const { stateClassName } = getViewComponentNames(spec)
    this.stateUpdaterName = `${stateClassName}Updater`
  }

  get kind() {
    return this.type.kind
  }
  get isEquatable(): boolean {
    return this.type.isEquatable
  }
  getCode(language: Language, options: GetCodeOptions): string {
    return this.type.getCode(language, options)
  }
  getRequiredImports(language: Language): SourceImport[] {
    return this.type.getRequiredImports(language)
  }
  getExtraFiles(): SourceFile[] {
    return this.type.getExtraFiles()
  }
  getCppConverter(cppType: Type): KotlinCppConverter {
    return this.type.getCppConverter(cppType)
  }
  convert(value: string, conversion: KotlinConversion): string {
    return this.type.convert(value, conversion)
  }

  getJniNativeRegistrations(): readonly JNINativeRegistration[] {
    const config = this.type.sourceConfig
    if (config.isExternalConfig) return []
    return [
      ...this.type.getJniNativeRegistrations(),
      {
        namespace: config.getCxxNamespace('c++', 'views').split('::'),
        className: `J${this.stateUpdaterName}`,
        import: {
          language: 'c++',
          declaration: config.getCxxHeader(`views/J${this.stateUpdaterName}.hpp`, 'private'),
        },
      },
    ]
  }
}
