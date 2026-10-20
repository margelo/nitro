import { iOS } from "nitro-core";
import type { HybridObject } from "nitro-core";

export * from "#nitro/PlatformObject";

// This object is implemented in Swift and Kotlin
@iOS({
  language: "swift",
  implementation: { className: "HybridPlatformObject" },
})
export declare class PlatformObject extends HybridObject {
  constructor();
  getOSVersion(): string;
}
