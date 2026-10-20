---
---

# Entry Point

Nitro is built on top of JSI - while the primary target is React Native, Nitro even works on any other target that provides JSI.

## React Native's Entry Point

In React Native apps, Nitro makes use of the [autolinking functionality](https://github.com/react-native-community/cli/blob/main/docs/autolinking.md) provided by RN CLI.

Nitro V1 requires React Native 0.88 or newer with the New Architecture. Importing `react-native-nitro-modules` resolves its TurboModule. React Native then calls the native JSI bindings hook with the runtime and CallInvoker, which Nitro uses to install its proxy and dispatcher before initializing the JavaScript API.

## Manually registering Nitro

If you are not within a typical React Native environment (e.g. a brownfield app, an out-of-tree platform, or simply a pure JSI environment), you can also use Nitro Modules by just installing Nitro manually.

After creating your `jsi::Runtime` and an instance of `Dispatcher`, simply call `margelo::nitro::install()`:

```cpp
#include <jsi/jsi.h>
#include <NitroModules/InstallNitro.hpp>
#include <NitroModules/Dispatcher.hpp>

jsi::Runtime& runtime = ...
std::shared_ptr<Dispatcher> dispatcher = ...
margelo::nitro::install(runtime, dispatcher);
```

Your `Dispatcher` must implement `runAsync` and `runSync` to schedule calls on the runtime's thread, and `isOnDispatcher` to report whether the current thread can access that runtime.

:::tip
If your Runtime can be accessed from any Thread, you can also skip Thread-hops here and just call the functions directly in your Dispatcher.
:::

### No Dispatcher

Nitro can also be installed without a `Dispatcher`:

```cpp
#include <jsi/jsi.h>
#include <NitroModules/InstallNitro.hpp>

jsi::Runtime& runtime = ...
margelo::nitro::install(runtime);
```

Synchronous methods, properties, and borrowed `Inline` callbacks still work. Passing an owning JavaScript `Callback` to native or returning a pending native `Promise` requires a `Dispatcher`. Already-settled native promises can be converted immediately.
