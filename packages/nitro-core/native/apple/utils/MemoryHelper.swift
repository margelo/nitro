//
//  MemoryHelper.swift
//  NitroModules
//
//  Created by Marc Rousavy on 17.12.2024.
//

public final class MemoryHelper {
  /**
   * Get the amount of memory that was allocated using a `malloc`-like allocator
   * for the given instance, in bytes.
   * When allocating resources differently (e.g. GPU buffers, or `UIImage`) you
   * should add their byte sizes to the result of this function to get an object's
   * total memory footprint.
   */
  public static func getSizeOf(_ instance: AnyObject) -> Int {
    return malloc_size(Unmanaged.passUnretained(instance).toOpaque())
  }
}
