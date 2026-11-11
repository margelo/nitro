---
---

# Custom Enums (`A | B`)

There's two different types of enums - [enums](#typescript-enums) and [unions](#typescript-union).

## TypeScript enums

A [TypeScript enum](https://www.typescriptlang.org/docs/handbook/enums.html) is essentially just an object where each key is backed by ascending integer values. Nitrogen will generate a C++ enum natively, which bridges to JS as a simple integer:

```ts
enum Gender {
  MALE,
  FEMALE
}
interface Person extends HybridObject<{ … }> {
  getGender(): Gender
}
```

This is efficient because `MALE` is the number `0`, `FEMALE` is the number `1`, and all other values are invalid.

## TypeScript union

A [TypeScript union](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#intersection-types) is essentially just a variant of literal strings, which is only "typed" via TypeScript.

```ts
type Gender = 'male' | 'female'
interface Person extends HybridObject<{ … }> {
  getGender(): Gender
}
```

Nitrogen statically generates hashes for the strings `"male"` and `"female"` at compile-time, allowing for very efficient conversions between JS `string`s and native `enum`s.

### Unions need a name

A TypeScript union consisting of only literal strings needs to be aliased to a separate type so that nitrogen can generate the native `enum` accordingly.

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"

interface Person extends HybridObject<{ … }> {
  getGender(): 'male' | 'female'
}
```

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
type Gender = 'male' | 'female'
interface Person extends HybridObject<{ … }> {
  getGender(): Gender
}
```

</div>
</div>
