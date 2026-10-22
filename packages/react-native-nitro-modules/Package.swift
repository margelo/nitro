// swift-tools-version: 6.4

import PackageDescription

// React Native links this package at ios/build/generated/autolinking/libs/NitroModules.
// Its generated framework and codegen packages are relative to that location.
let reactHeaders: [Target.Dependency] = [
  .product(name: "ReactHeaders", package: "ReactNative"),
  .product(name: "ReactNativeHeaders", package: "ReactNative"),
  .product(name: "ReactNativeDependenciesHeaders", package: "ReactNative"),
]
let cxxSettings: [CXXSetting] = [
  .define("DEBUG", .when(configuration: .debug)),
  .define("NDEBUG", .when(configuration: .release)),
  .define("NITRO_JSI_HAS_FAST_UTF16", to: "false"),
  .enableWarning("all"),
  .enableWarning("extra"),
  .enableWarning("pedantic"),
  .disableWarning("nullability-extension"),
]

let package = Package(
  name: "NitroModules",
  platforms: [.iOS(.v16), .macOS(.v13), .tvOS(.v16), .visionOS(.v1)],
  products: [
    .library(
      name: "NitroModules",
      targets: [
        "NitroModulesCxx",
        "NitroModulesAppleCxx",
        "NitroModules",
        "NitroModulesSwiftBridge",
        "NitroModulesReactNative",
      ]
    )
  ],
  dependencies: [
    .package(name: "ReactNative", path: "../../../../xcframeworks"),
    .package(name: "React-GeneratedCode", path: "../../../ios"),
    .package(
      url: "https://github.com/margelo/simdutf-swift.git",
      from: "1.0.1",
      traits: ["UTF8", "UTF16", "ASCII"]
    ),
  ],
  targets: [
    .target(
      name: "NitroModulesCxx",
      dependencies: reactHeaders,
      path: "cpp/core",
      sources: ["src"],
      publicHeadersPath: "include",
      cxxSettings: cxxSettings
    ),
    .target(
      name: "NitroModulesAppleCxx",
      dependencies: ["NitroModulesCxx"] + reactHeaders,
      path: "apple/core",
      sources: ["src"],
      publicHeadersPath: "include",
      cxxSettings: cxxSettings
    ),
    .target(
      name: "NitroModules",
      dependencies: [
        "NitroModulesCxx",
        "NitroModulesAppleCxx",
        .product(name: "SimdUTF", package: "simdutf-swift"),
      ],
      path: "apple",
      sources: ["core/core", "core/utils", "views"],
      cxxSettings: cxxSettings,
      swiftSettings: [
        .enableUpcomingFeature("InternalImportsByDefault"),
        .enableUpcomingFeature("MemberImportVisibility"),
        .swiftLanguageMode(.v6),
        .enableUpcomingFeature("ApproachableConcurrency"),
        .interoperabilityMode(.Cxx),
        .unsafeFlags(["-Xfrontend", "-clang-header-expose-decls=has-expose-attr-or-stdlib"]),
      ]
    ),
    .target(
      name: "NitroModulesSwiftBridge",
      dependencies: ["NitroModules", "NitroModulesAppleCxx", "NitroModulesCxx"],
      path: "apple/core/swift-bridge",
      sources: ["src"],
      publicHeadersPath: "include",
      cxxSettings: cxxSettings + [
        .unsafeFlags(["-I${GENERATED_MODULEMAP_DIR}", "-fno-modules"])
      ]
    ),
    .target(
      name: "NitroModulesReactNative",
      dependencies: [
        "NitroModulesCxx",
        "NitroModulesAppleCxx",
        .product(name: "ReactAppHeaders", package: "React-GeneratedCode"),
      ] + reactHeaders,
      path: ".",
      sources: ["apple/src", "cpp/src"],
      publicHeadersPath: "include",
      cxxSettings: cxxSettings + [
        .define("RCT_NEW_ARCH_ENABLED", to: "1")
      ]
    ),
  ],
  cxxLanguageStandard: .cxx20
)
