# nlohmann/json

Private test dependency: [nlohmann/json 3.12.0](https://github.com/nlohmann/json/releases/tag/v3.12.0), commit `55f93686c01528224f448c19128836e7df245f72`.

- [Original single header](https://github.com/nlohmann/json/blob/55f93686c01528224f448c19128836e7df245f72/single_include/nlohmann/json.hpp)
- SHA-256: `aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63`
- License: [MIT](LICENSE.MIT)

The standalone C++ fixture uses this header to test JSON parsing and serialization. It is outside Nitro's published packages.

The parser requires well-formed Unicode and rejects lone surrogate escapes. Tests cover this boundary in the object helpers and verify that raw `AnyJSON` copies and JSI conversion preserve those strings.

The upstream SwiftPM product contains only headers. Our Xcode toolchain fails to link an XCTest bundle against it because `json.o` is missing, even through a C++ library target. Keeping the header private to the existing fixture target avoids that linker failure without another build step.
