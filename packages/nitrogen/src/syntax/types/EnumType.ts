import { EnumDeclaration } from 'ts-morph'
import { Type as TSMorphType, type ts } from 'ts-morph'
import type { Language } from '../../getPlatformSpecs.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'
import { createCppEnum } from '../c++/CppEnum.js'
import { escapeCppName } from '../helpers.js'
import { createCppUnion } from '../c++/CppUnion.js'
import { NitroConfig } from '../../config/NitroConfig.js'

export interface EnumMember {
  name: string
  value: number
  stringValue: string
}

export class EnumType implements Type {
  readonly enumName: string
  readonly enumMembers: EnumMember[]
  readonly jsType: 'enum' | 'union'
  readonly declarationFile: SourceFile

  constructor(enumName: string, enumDeclaration: EnumDeclaration)
  constructor(enumName: string, union: TSMorphType<ts.UnionType>)
  constructor(type: EnumType)
  constructor(
    ...args:
      | [
          enumName: string,
          declaration: EnumDeclaration | TSMorphType<ts.UnionType>,
        ]
      | [type: EnumType]
  ) {
    if (args.length === 1) {
      const [type] = args
      this.enumName = type.enumName
      this.enumMembers = type.enumMembers
      this.jsType = type.jsType
      this.declarationFile = type.declarationFile
    } else {
      const [enumName, declaration] = args
      this.enumName = enumName
      if (declaration instanceof EnumDeclaration) {
        // It's a JS enum { ... }
        this.jsType = 'enum'
        this.enumMembers = declaration.getMembers().map<EnumMember>((m) => {
          const name = m.getSymbolOrThrow().getEscapedName()
          const value = m.getValue()
          if (typeof value !== 'number') {
            throw new Error(
              `Enum member ${enumName}.${name} is ${value} (${typeof value}), which cannot be represented in C++ enums.\n` +
                `Each enum member must be a number! If you want to use strings, use TypeScript unions ("a" | "b") instead!`
            )
          }
          return {
            name: escapeCppName(name).toUpperCase(),
            value: value,
            stringValue: name,
          }
        })
        this.declarationFile = createCppEnum(enumName, this.enumMembers)
      } else {
        // It's a TS union '..' | '..'
        this.jsType = 'union'
        this.enumMembers = declaration
          .getNonNullableType()
          .getUnionTypes()
          .map((t, i) => {
            if (t.isStringLiteral()) {
              const literalValue = t.getLiteralValueOrThrow()
              if (typeof literalValue !== 'string')
                throw new Error(
                  `${enumName}: Value "${literalValue}" is not a string - it is ${typeof literalValue}!`
                )
              return {
                name: escapeCppName(literalValue).toUpperCase(),
                value: i,
                stringValue: literalValue,
              }
            } else {
              throw new Error(
                `${enumName}: Value "${t.getText()}" is not a string literal - it cannot be represented in a C++ enum!`
              )
            }
          })
        this.declarationFile = createCppUnion(enumName, this.enumMembers)
      }
      if (this.enumName.startsWith('__')) {
        throw new Error(
          `Enum name cannot start with two underscores (__) as this is reserved syntax for Nitrogen! (In ${this.enumName}: ${this.enumMembers.map((m) => m.name).join(' | ')})`
        )
      }
    }
  }

  get kind(): TypeKind {
    return 'enum'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, { fullyQualified }: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        if (fullyQualified) {
          return NitroConfig.current.getCxxNamespace('c++', this.enumName)
        } else {
          return this.enumName
        }
      case 'swift':
        return this.enumName
      case 'kotlin':
        return this.enumName
      default:
        throw new Error(
          `Language ${language} is not yet supported for NumberType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return [this.declarationFile]
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: NitroConfig.current.getCxxHeader(
            this.declarationFile.name
          ),
        })
        break
    }
    return imports
  }
}
