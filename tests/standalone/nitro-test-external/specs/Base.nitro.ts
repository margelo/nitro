import { iOS } from "nitro-core";
import type { HybridObject } from "nitro-core";

export * from "#nitro/Base";

export enum SizeUnit {
  Pixels = 10,
  Normalized = 20,
}

export interface Size {
  width: number;
  height: number;
  unit: SizeUnit;
  scale: number;
}

@iOS({
  language: "swift",
  implementation: { className: "HybridBase" },
})
export declare class Base extends HybridObject {
  constructor();
  readonly baseValue: number;
  bounceSize(size: Size): Size;
  bounceSizeUnit(unit: SizeUnit): SizeUnit;
  mapSize(size: Size, callback: (size: Size) => Size): Promise<Size>;
}
