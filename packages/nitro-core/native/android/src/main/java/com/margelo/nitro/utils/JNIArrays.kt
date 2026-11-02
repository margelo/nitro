package com.margelo.nitro.utils

/** Maps object array elements without an intermediate List. */
inline fun <Element, reified Result> Array<Element>.mapToArray(transform: (Element) -> Result): Array<Result> =
  Array(size) { transform(this[it]) }
