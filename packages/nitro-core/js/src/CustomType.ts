export interface CustomTypeConfig {
  /**
   * Represents the name of the C++ header that will be included
   * to support your type.
   *
   * This C++ header should be written by you, and findable within
   * the user-search-paths so it can be included.
   */
  include: string
  /**
   * A flag that enables const-reference passing for heavy types
   * to prevent unnecessary copies.
   * When `true`, the type will be passed to clients as a `const T&` instead of just `T`.
   * @default false
   */
  canBePassedByReference?: boolean
}

/**
 * Represents a custom, manually written native type.
 * - {@linkcode TypeName}: Represents the name of the C++ type (class, struct, alias).
 * - {@linkcode Config}: Configures how the C++ type is included, used, and typed.
 *
 * **You** then need to create a header file that is importable with the filename specified in {@linkcode Config.include}.
 * @example
 * ```ts
 * type MyOwnString = CustomType<string, 'MyOwnString', { include: 'MyOwnString.hpp' }>
 * interface MyHybrid extends HybridObject<{ … }> {
 *   getValue(): MyOwnString
 * }
 * ```
 * The C++ header will always be included by Nitro as a user-search-path header, that is;
 * ```cpp
 * #include "MyOwnString.hpp"
 * ```
 * The C++ header (`MyOwnString.hpp`) then needs to define the type `MyOwnString`
 * within the namespace of your Nitro Module (`namespace margelo::nitro::...`),
 * and an overload for `JSIConverter<MyOwnString>` within the Nitro core namespace
 * (`namespace margelo::nitro`):
 * ```cpp
 * namespace margelo::nitro::test {
 *   using MyOwnString = std::string;
 * }
 * namespace margelo::nitro {
 *   template<>
 *   struct JSIConverter<test::MyOwnString> final {
 *     static test::MyOwnString fromJSI(jsi::Runtime&, const jsi::Value&);
 *     static jsi::Value toJSI(jsi::Runtime&, test::MyOwnString);
 *     static bool canConvert(jsi::Runtime&, const jsi::Value& value);
 *   }
 * }
 * ```
 */
export type CustomType<
  T,
  TypeName extends string,
  Config extends CustomTypeConfig,
> = T & {
  readonly __customTypeName?: TypeName
  readonly __customTypeConfig?: Config
}
