---
---

import Tabs from '@theme/Tabs'; import TabItem from '@theme/TabItem';

# Custom Types (manually written `T`)

The `JSIConverter<T>` is Nitro's implementation for converting JS values to native values, and back. It's implemented as a C++ template,
which allows it to be extended with any custom type.

For example, wrap a numeric temperature in a C++ struct:

```cpp title="Temperature.hpp"
#pragma once
#include <NitroModules/JSIConverter.hpp>

namespace margelo::nitro::weather {
  struct Temperature {
    double celsius;
  };
}

namespace margelo::nitro {
  template <>
  struct JSIConverter<weather::Temperature> {
    static weather::Temperature fromJSI(jsi::Runtime& runtime,
                                        const jsi::Value& value) {
      return {.celsius = JSIConverter<double>::fromJSI(runtime, value)};
    }

    static jsi::Value toJSI(jsi::Runtime& runtime, weather::Temperature value) {
      return JSIConverter<double>::toJSI(runtime, value.celsius);
    }

    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
      return JSIConverter<double>::canConvert(runtime, value);
    }
  };
}
```

The specialization belongs in `margelo::nitro`, even if the type itself belongs to another namespace. Make the header visible to the
compiler wherever methods using this type are registered.

## Foreign types (e.g. `react::ShadowNodeWrapper`)

Since you have full control over the conversion part, you can even safely use foreign types like React Native's core types. For example,
let's use `react::ShadowNodeWrapper`, which is stored as a `jsi::NativeState` on a `jsi::Object`:

```cpp title="JSIConverter+ShadowNode.hpp"
#pragma once
#include <react/...>
// ...
namespace margelo::nitro {
  template <>
  struct JSIConverter<std::shared_ptr<react::ShadowNodeWrapper>> {
    static std::shared_ptr<react::ShadowNodeWrapper> fromJSI(jsi::Runtime& runtime,
                                                             const jsi::Value& arg) {
      jsi::Object obj = arg.asObject(runtime);
      return obj.getNativeState<react::ShadowNodeWrapper>(runtime);
    }
    static jsi::Value toJSI(jsi::Runtime& runtime,
                            std::shared_ptr<react::ShadowNodeWrapper> arg) {
      jsi::Object obj(runtime);
      obj.setNativeState(runtime, arg);
      return obj;
    }
    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
      if (!value.isObject())
        return false;
      jsi::Object obj = value.getObject(runtime);
      return obj.hasNativeState<react::ShadowNodeWrapper>(runtime);
    }
  };
}
```

Then just use the type in your methods:

<Tabs groupId="nitrogen-or-not">
  <TabItem value="nitrogen" label="With Nitrogen ✨" default>

    <div className="side-by-side-container">
    <div className="side-by-side-block">

    ```ts title="MyHybrid.nitro.ts"
    type ShadowNode = CustomType<
      React.Component['state'],
      'std::shared_ptr<react::ShadowNodeWrapper>',
      { include: 'JSIConverter+ShadowNode.hpp' }
    >

    @Apple(...)
    export declare class MyHybrid
      extends HybridObject {
      doSomething(view: ShadowNode): void
    }
    export * from '#nitro/MyHybrid'
    ```

    </div>
    <div className="side-by-side-block">

    ```cpp title="MyHybrid.hpp"
    class MyHybrid: public MyHybridSpec {
    public:
      void doSomething(std::shared_ptr<react::ShadowNodeWrapper> view) override {
        // ...
      }
    };
    ```

    </div>
    </div>

    :::info

    Make sure the `JSIConverter+ShadowNode.hpp` header is included in your project's user-search-path so it can be included.

    :::

  </TabItem>
  <TabItem value="manually" label="Manually">

    ```cpp title="MyHybrid.hpp"
    #pragma once
    #include "JSIConverter+ShadowNode.hpp"
    // ...

    class MyHybrid: public HybridObject {
    public:
      void doSomething(std::shared_ptr<react::ShadowNodeWrapper> view) override {
        // ...
      }

      void loadHybridMethods() {
        HybridObject::loadHybridMethods();
        registerHybrids(this, [](Prototype& prototype) {
          prototype.registerHybridMethod("doSomething", &MyHybrid::doSomething);
        });
      }
    };
    ```

    :::info

    Make sure the compiler knows about `JSIConverter<ShadowNode>` at the time when `MyHybrid` is declared, so import your `JSIConverter+ShadowNode.hpp` in your Hybrid Object's header file as well!

    :::

  </TabItem>

</Tabs>

And lastly you'd pass the JS value that maps to this native type - in our case, `react::ShadowNodeWrapper` is stored on a View ref's `state`
property:

```tsx
function App() {
  const ref = useRef<View>(null)

  const call = () => {
    myHybrid.doSomething(ref.current.state)
  }

  return <View ref={ref} />
}
```
