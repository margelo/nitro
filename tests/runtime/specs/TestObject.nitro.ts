import type { HybridObject, Int64 } from "nitro-core";

export interface TestObject extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  bounceBoolean(value: boolean): boolean;
  calculateFibonacciAsync(value: number): Promise<Int64>;
}
