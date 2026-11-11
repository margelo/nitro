---
---

# Raw `jsi::Value` / `jsi::Runtime`

Even though Nitro supports virtually any JS type, there are certain use cases where you might want to work with a raw `jsi::Value` or a `jsi::Runtime` directly - and Nitro provides an escape hatch for this.

Since JSI is not typed, Nitrogen does not have typing support for a method that takes raw `jsi::Value`s - so you have to define it yourself by **overriding** `loadHybridMethods()` in C++:

```cpp
class HybridMath : public HybridMathSpec {
public:
  HybridMath(): HybridObject(TAG) {}

public:
  jsi::Value myRawMethod(jsi::Runtime& runtime,
                         const jsi::Value& thisValue,
                         const jsi::Value* args,
                         size_t count);

public:
  void loadHybridMethods() override;
}
```

:::warning
In JS, `myRawMethod` is not typed. You are expected to provide type-safety for it by safely checking the arguments and return values yourself.
:::

The implementation of your `loadHybridMethods()` should call the base's `loadHybridMethods()`, and then register your raw JSI methods:

```cpp
void HybridMath::loadHybridMethods() {
  // 1. Load base methods
  HybridMathSpec::loadHybridMethods();
  // 2. Register own methods
  registerHybrids(this, [](Prototype& prototype) {
    prototype.registerRawHybridMethod("myRawMethod",
                                      /* args count */ 2,
                                      &HybridMath::myRawMethod);
  });
}
```

:::important
If you don't have a base spec (here, `HybridMathSpec` is a nitrogenerated spec), you just want to call `HybridObject::loadHybridMethods()`.
:::

And lastly, implement your raw JSI method:

```cpp
jsi::Value HybridMath::myRawMethod(jsi::Runtime& runtime,
                                   const jsi::Value& thisValue,
                                   const jsi::Value* args,
                                   size_t count) {
  double a = args[0].asNumber();
  double b = args[1].asNumber();
  return jsi::Value(a + b);
}
```

:::note
The syntax of a raw JSI method is always the same as the one of a `jsi::HostFunctionType`.
:::

:::tip
You can use Nitro's converters by including `#include <NitroModules/JSIConverter.hpp>`, then using it:
```cpp
double a = JSIConverter<double>::fromJSI(runtime, args[0]);
```
:::
