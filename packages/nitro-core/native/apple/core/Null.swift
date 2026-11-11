//
//  Null.swift
//  NitroModules
//
//  Created by Marc Rousavy on 10.11.25
//

@frozen
public enum NullType: Sendable, Equatable, Hashable {
  /**
   * Represents an explicit `null` from JS.
   */
  case null
}
