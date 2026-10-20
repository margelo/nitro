---
---

# Other Hybrid Objects (`HybridObject`)

Since Nitro Modules are object-oriented, a `HybridObject` itself is a first-class citizen.
This means you can pass around instances of native `HybridObject`s between JS and native, allowing for safe interface-level abstractions:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Camera.nitro.ts"
import { type HybridObject, iOS } from 'nitro-core'

@iOS({ allowMultipleImplementations: true })
export declare class Image extends HybridObject {
  readonly width: number
  readonly height: number
}
export * from '#nitro/Image'

@iOS(...)
export declare class Camera extends HybridObject {
  takePhoto(): Image
}
export * from '#nitro/Camera'
```

</div>
<div className="side-by-side-block">

```swift title="HybridCamera.swift"
class HybridImage: HybridImageSpec {
  let uiImage: UIImage
  var width: Double { uiImage.size.width }
  var height: Double { uiImage.size.height }
}

class HybridCamera: HybridCameraSpec {
  func takePhoto() throws -> any HybridImageSpec {
    return HybridImage(uiImage: …)
  }
}
```

</div>
</div>

## Interface-level abstraction

With [`allowMultipleImplementations: true`](../concepts/platform-decorators#multiple-implementations), `Image` can have different native implementations:

```swift
class HybridUIImage: HybridImageSpec {
  // ...
  var uiImage: UIImage
}
class HybridCGImage: HybridImageSpec {
  // ...
  var cgImage: CGImage
}
class HybridBufferImage: HybridImageSpec {
  // ...
  var gpuBuffer: CMSampleBuffer
}
```

...but still be used exactly the same in other places, as it is all an `any HybridImageSpec`.
Even if they use different implementations under the hood, they all share a common interface with properties like `width`, `height` and more:

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Cropper.nitro.ts"
import { type HybridObject, iOS } from 'nitro-core'

@iOS(...)
export declare class Cropper
  extends HybridObject {
  crop(image: Image, size: Size): Image
}
export * from '#nitro/Cropper'
```

</div>
<div className="side-by-side-block">

```swift title="Cropper.swift"
class HybridCropper: HybridCropperSpec {
  func crop(image: any HybridImageSpec,
            size: Size) throws -> any HybridImageSpec {
    let data = image.data
    let croppedData = cropFunc(data, size)
    return HybridCGImage(data: croppedData)
  }
}
```

</div>
</div>

## `AnyHybridObject`

If you don't need a specific type of `HybridObject` but instead just want any `HybridObject`, you can use Nitro's `AnyHybridObject` type.
This type only works in C++.

<div className="side-by-side-container">
<div className="side-by-side-block">

```ts title="Some.nitro.ts"
import {
  type HybridObject,
  type AnyHybridObject,
  iOS
} from 'nitro-core'

@iOS(...)
export declare class Some
  extends HybridObject {
  something(obj: AnyHybridObject): void
}
export * from '#nitro/Some'
```

</div>
<div className="side-by-side-block">

```cpp title="HybridSome.hpp"
class HybridSome: public HybridSomeSpec {
public:
  void something(
    const std::shared_ptr<HybridObject>& obj
  ) override;
};
```

</div>
</div>
