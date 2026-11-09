# Repository preferences

- Default to static methods and properties for Nitro APIs without per-instance state or lifetime requirements. Use instance members for
  object-specific state, identity, resources, or polymorphism. Do not create a singleton HybridObject just to expose stateless functions.
- Benchmark the recommended static API for stateless operations. Keep instance calls as explicitly labeled controls; a cached JNI method ID
  declared with `static const` does not exercise a Nitro static method. Read [Performance Tips](docs/docs/guides/performance-tips.md) before
  designing or comparing Nitro APIs.
- Include a real caller with a new API when practical. A narrow throwing stub is fine when another part is not implemented yet; keep
  prerequisite PRs buildable.
- Apply review feedback to equivalent code throughout the affected PR stack.
- Workarounds for upstream bugs must have an upstream issue report, ideally also a PR fixing the issue. Add a nearby `// TODO:` comment
  linking the issue and any fix PR, and stating when to remove the workaround after the fix is released. For Swift compiler or Swift/C++
  interop bugs, use `swiftlang/swift`.
- Weigh recovery complexity against practical benefit. Propagation or a runtime assertion can be acceptable for unexpected failures with no
  useful recovery, e.g. allocation failures in otherwise valid conversions. Check failure modes and caller behavior first; preserve errors
  for normal fallible calls instead of forcing success.
- Put extra diagnostics for programming mistakes behind `NITRO_DEBUG`, including helpful assertions and early checks. Keep validation and
  error handling needed for release correctness or normal invalid input.
- Keep new tests, fixtures, and benchmarks outside the repo unless requested otherwise. Do not remove existing tests.
- Use the user's Git identity; no AI author or co-author.
- Use Humanizer for public prose when available. Keep PR descriptions short and concrete. Never use em dashes.

Use the relevant skill:

- [TypeScript](.agents/skills/nitro-typescript/SKILL.md) for all TypeScript and TSX changes, including Nitrogen and generated TypeScript.
- [Nitrogen](.agents/skills/nitro-nitrogen/SKILL.md) for generator changes.
- [Swift/C++](.agents/skills/nitro-swift-cxx/SKILL.md) for converters and bridge changes.
- [JNI](.agents/skills/nitro-jni/SKILL.md) for Android converters, reference ownership, callbacks, and Promise bridges.
