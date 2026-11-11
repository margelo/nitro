---
---

# Android `Context`

Many Android APIs require a [`Context`](https://developer.android.com/reference/android/content/Context) object, which allows access to application-specific resources and classes, as well as calls to hardware APIs.

## Using `Context` in a `HybridObject`

Unlike in TurboModules, a [Hybrid Object](../concepts/hybrid-objects) does not receive a [`Context`](https://developer.android.com/reference/android/content/Context) via its constructor, as that would make it non-portable.
Instead, Nitro exposes the current `ReactApplicationContext` via the static [`NitroModules.applicationContext`](https://github.com/margelo/nitro/blob/fb1102ca7657665aad3011d7556fcd06f3cc796d/packages/react-native-nitro-modules/android/src/main/java/com/margelo/nitro/NitroModules.kt#L68-L72) getter, which you can access in your [Hybrid Object](../concepts/hybrid-objects) if needed:

```kotlin
class HybridClipboard: HybridClipboardSpec() {
  private val clipboard: ClipboardManager

  init {
    // highlight-next-line
    val context = NitroModules.applicationContext ?: throw Error("No Context available!")
    clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
  }
}
```

## Using `Context` in a `HybridView`

Unlike in a [Hybrid Object](../concepts/hybrid-objects), a [Hybrid View](../concepts/hybrid-views) is platform-specific and always needs a [`Context`](https://developer.android.com/reference/android/content/Context) - e.g. to create Android `View`s.
Therefore all `HybridView`s receive [`Context`](https://developer.android.com/reference/android/content/Context) as a constructor argument:

```kotlin
class HybridCameraView(
  // highlight-next-line
  private val context: ThemedReactContext
): HybridCameraViewSpec() {
  override val view: View = View(context)
}
```
