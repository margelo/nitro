---
---

# Custom Structs (`interface`)

Any custom `interface` or `type` that does **not** extend `HybridObject` will be represented as a fully type-safe `struct` in C++/Swift/Kotlin. Simply define the type in your `.nitro.ts` spec:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Nitro.nitro.ts"
interface Person {
  name: string
  age: number
}

interface Nitro
  extends HybridObject<{ ios: 'swift' }> {
  getAuthor(): Person
}
```

</div>
<div className="side-by-side-block">

```swift title="HybridNitro.swift"
class HybridNitro: HybridNitroSpec {
  func getAuthor() -> Person {
    return Person(name: "Marc", age: 24)
  }
}
```

</div>
</div>

Nitro enforces full type-safety to avoid passing or returning wrong types.
Both `name` and `age` are always part of `Person`, they are never a different type than a `string`/`number`, and never null or undefined.

This makes the TypeScript definition the **single source of truth**, allowing you to rely on types! 🤩

## Prefer `interface` over `type`

Since TypeScript flattens types (`type`), their symbols or declarations might get lost. Unfortunately Nitro cannot find a struct name for a flattened type, so it is generally recommended to use `interface` instead of `type`:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
type Person = {
  name: string
  age: number
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
interface Person {
  name: string
  age: number
}
```

</div>
</div>

## Combined types (e.g. `Partial`)

In TypeScript, it is a common practice to modify and combine types using [utility types like `Partial`](https://www.typescriptlang.org/docs/handbook/utility-types.html).

As mentioned in ["Prefer `interface` over `type`"](#prefer-interface-over-type), you should prefer to use `interface` over `type` for those types too:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
interface Person {
  name: string
  age: number
}
type PartialPerson = Partial<Person>
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
interface Person {
  name: string
  age: number
}
interface PartialPerson
  extends Partial<Person> {}
```

</div>
</div>

This way TypeScript always keeps the `interface` in-tact, allowing Nitrogen to properly process it.

## Structs are eagerly converted

Since structs are just flat value types, each key/value is eagerly converted from a JS value to a native value (and vice-versa) when passing them between JS and native.

This is fine for small structs and benefits from low allocation cost, but contains an overhead when your structs growing larger.
Use [Hybrid Objects](hybrid-objects) to implement a way to lazily convert each key/value instead.
