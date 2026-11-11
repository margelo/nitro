---
---

# Entry Point

Nitro is built on top of JSI - while the primary target is React Native, Nitro even works on any other target that provides JSI.

## React Native's Entry Point

In React Native apps, Nitro makes use of the [autolinking functionality](https://github.com/react-native-community/cli/blob/main/docs/autolinking.md) provided by RN CLI.

Nitro itself is a react-native library - either a Native Module (old arch) or a Turbo Module (new arch) - with a single native method: `install()`.
This native method will be called from JS when importing `react-native-nitro-modules`, so it will always happen before trying to use the `NitroModules` JS object.

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

Your `Dispatcher` implementation must properly implement `runAsync` and `runSync` to schedule calls on a Thread that can safely access the `jsi::Runtime`.

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

In this case, all synchronous methods and properties remain in-tact, but any asynchronous hybrid methods (`Promise`) or callbacks will throw an error that Nitro does not have a `Dispatcher` to get back to the JS Thread.
