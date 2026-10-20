---
---

# Tuples (`[A, B, ...]`)

A Tuple is a fixed-length set of items of the given types. Example:

```ts
type Point = [number, number]
interface Math extends HybridObject<{ … }> {
  distance(a: Point, b: Point): number
}
```

Tuples can also have different types per value:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Bad ❌"
type Values = (number | string | Person)[]
interface Math extends HybridObject<{ … }> {
  calculate(values: Values): void
}
```
The type in the **Bad ❌** example generates an [array](arrays) of [variants](variants), where its size is unknown and each value could be a `number`, a `string` or a `Person`. It is less efficient than a **tuple** because of the variant allocation.

</div>
<div className="side-by-side-block">

```ts title="Good ✅"
type Values = [number, string, Person]
interface Math extends HybridObject<{ … }> {
  calculate(values: Values): void
}
```
The type in the **Good ✅** example generates a **tuple**, where its size is guaranteed to be **3** and each value is known at compile-time: `values[0]: number`, `values[1]: string`, `values[2]: Person`.

</div>
</div>
