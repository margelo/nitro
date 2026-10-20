---
---

# Raw `jsi::Value` / `jsi::Runtime`

Even though Nitro supports virtually any JS type, there are certain use cases where you might want to work with a raw `jsi::Value` or a `jsi::Runtime` directly - and Nitro provides an escape hatch for this.

Use `HybridClass::registerRawHybridMethod` when a C++ method needs direct access to JSI. Register it while creating your class descriptor:

```cpp
#include <NitroModules/HybridObject.hpp>

using namespace margelo::nitro;
using namespace facebook;

class HybridMath : public HybridObject {
public:
  struct Class {
    using Base = HybridObject::Class;
    static constexpr const char* name = "Math";
    static const std::shared_ptr<const HybridClass>& get();
  };

  const std::shared_ptr<const HybridClass>& getHybridClass() override {
    return Class::get();
  }

  jsi::Value myRawMethod(jsi::Runtime& runtime,
                        const jsi::Value& thisValue,
                        const jsi::Value* args,
                        size_t count);
};

const std::shared_ptr<const HybridClass>& HybridMath::Class::get() {
  static const auto clazz = HybridClass::create<Class>([](HybridClass& clazz) {
    clazz.registerRawHybridMethod("myRawMethod", 2, &HybridMath::myRawMethod);
  });
  return clazz;
}
```

`Class::Base` supplies the inherited methods and properties. To extend a Nitrogen-generated spec, inherit from `HybridMathSpec` and set `Class::Base` to `HybridMathSpec::Class`. Override `getHybridClass()` as above so instances use your extended descriptor. Register that descriptor with `HybridClassRegistry` if JavaScript needs to look it up by name.

A raw method has the same arguments and result as a `jsi::HostFunctionType`. Validate arguments before accessing them:

```cpp
jsi::Value HybridMath::myRawMethod(jsi::Runtime& runtime,
                                   const jsi::Value& thisValue,
                                   const jsi::Value* args,
                                   size_t count) {
  if (count != 2 || !args[0].isNumber() || !args[1].isNumber()) {
    throw jsi::JSError(runtime, "myRawMethod expects two numbers");
  }
  return jsi::Value(args[0].asNumber() + args[1].asNumber());
}
```

:::note
The syntax of a raw JSI method is always the same as the one of a `jsi::HostFunctionType`.
:::

:::tip
You can use Nitro's converters by including `#include <NitroModules/JSIConverter.hpp>`, then using it:
```cpp
#include <NitroModules/JSIConverter.hpp>

double a = JSIConverter<double>::fromJSI(runtime, args[0]);
```
:::
