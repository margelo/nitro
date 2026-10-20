import { iOS } from "nitro-core";
import type { HybridObject } from "nitro-core";

export * from "#nitro/Base";

export enum SizeUnit {
  Points = 1,
  Pixels = 2,
}

export interface Size {
  width: number;
  height: number;
  unit: SizeUnit;
}

@iOS({
  language: "swift",
  implementation: { className: "HybridBase" },
  allowMultipleImplementations: true,
  allowInheritance: true,
})
export declare class Base extends HybridObject {
  constructor();
  readonly baseValue: number;
  bounceSize(size: Size): Size;
  bounceSizeUnit(unit: SizeUnit): SizeUnit;
  mapSize(size: Size, callback: (size: Size) => Size): Promise<Size>;
}
