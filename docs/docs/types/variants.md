---
---

# Variants (`A | B | ...`)

A Variant is a type of either one of the values defined in its declaration. Example:

```ts
import { type HybridObject, Apple } from 'nitro-core'

@Apple(...)
export declare class Math extends HybridObject {
  distance(value: number | Point): number
}
```

:::tip

While variants are still very efficient, they need runtime-checks for type conversions, which comes with a tiny overhead compared to all
other statically defined types. If possible, **avoid variants**.

:::

## No literal values

A variant can only consist of types, not of literal values.

```ts
import { type HybridObject, Apple } from 'nitro-core'

@Apple(...)
export declare class Person extends HybridObject {
  // diff-remove
  getGender(): 'male' | 'female'
}
```

If you need variants of literal values, you probably want to use [an enum (_union_)](custom-enums#typescript-union) instead.

## Custom Alias Names

Each variant is a unique type in Swift/Kotlin - for example: `string | number` becomes `Variant_String_Double`.

Since the generated names are hard to read, it is recommended to declare type-aliases with custom names instead:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
import { type HybridObject, Apple } from 'nitro-core'


@Apple(...)
export declare class Math extends HybridObject {
  calculate(): string | number
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
import { type HybridObject, Apple } from 'nitro-core'

type MathOutput = string | number
@Apple(...)
export declare class Math extends HybridObject {
  calculate(): MathOutput
}
```

</div>
</div>

This will then use the easier-to-read type-alias name instead of `Variant_String_Double`:

```swift title="HybridMath.swift"
class HybridMath: HybridMathSpec {
  // diff-remove
  func calculate() throws -> Variant_String_Double
  // diff-add
  func calculate() throws -> MathOutput
}
```
