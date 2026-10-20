// swift-tools-version: 6.4

import Foundation
import PackageDescription

let cxxSettings: [CXXSetting] = [
  .define("DEBUG", .when(configuration: .debug)),
  .define("NDEBUG", .when(configuration: .release)),
  .define("NITRO_JSI_HAS_FAST_UTF16", to: "true"),
  .disableWarning("nullability-extension"),
]
let swiftSettings: [SwiftSetting] = [
  .swiftLanguageMode(.v5),
  .enableUpcomingFeature("InternalImportsByDefault"),
  .enableUpcomingFeature("MemberImportVisibility"),
  .interoperabilityMode(.Cxx),
  .unsafeFlags(["-strict-concurrency=minimal"]),
  .unsafeFlags(["-Xfrontend", "-clang-header-expose-decls=has-expose-attr-or-stdlib"]),
]
let bridgeSettings: [CXXSetting] = [
  .unsafeFlags(["-I${GENERATED_MODULEMAP_DIR}", "-fno-modules"]),
]

let package = Package(
  name: "NitroRuntimeTests",
  platforms: [.iOS(.v16)],
  products: [
    .library(name: "NitroTestRunnerBridge", targets: ["NitroTestRunnerBridge"])
  ],
  dependencies: [
    .package(
      url: "https://github.com/margelo/simdutf-swift.git",
      from: "1.0.1",
      traits: ["UTF8", "UTF16", "ASCII"]
    )
  ],
  targets: [
    .binaryTarget(
      name: "NitroTestHermes",
      path: "tests/standalone/.build/hermes/NitroTestHermes.xcframework"
    ),
    .target(
      name: "Hermes",
      dependencies: ["NitroTestHermes"],
      path: "tests/standalone/hermes/Sources/Hermes",
      linkerSettings: [.linkedFramework("Foundation"), .linkedFramework("CoreFoundation")]
    ),
    .target(
      name: "NitroModulesCxx",
      dependencies: ["Hermes"],
      path: "packages/nitro-core/native/cpp",
      sources: ["src"],
      publicHeadersPath: "include",
      cxxSettings: cxxSettings
    ),
    .target(
      name: "NitroModulesAppleCxx",
      dependencies: ["NitroModulesCxx"],
      path: "packages/nitro-core/native/apple",
      sources: ["src"],
      publicHeadersPath: "include",
      cxxSettings: cxxSettings
    ),
    .target(
      name: "NitroModules",
      dependencies: [
        "NitroModulesCxx", "NitroModulesAppleCxx",
        .product(name: "SimdUTF", package: "simdutf-swift"),
      ],
      path: "packages/nitro-core/native/apple",
      sources: ["core", "utils"],
      cxxSettings: cxxSettings,
      swiftSettings: swiftSettings
    ),
    .target(
      name: "NitroModulesSwiftBridge",
      dependencies: ["NitroModules", "NitroModulesAppleCxx"],
      path: "packages/nitro-core/native/apple/swift-bridge",
      sources: ["src"],
      publicHeadersPath: "include",
      cxxSettings: cxxSettings + bridgeSettings
    ),
  ],
  cxxLanguageStandard: .cxx20
)

addFixtureTargets(to: package, name: "NitroTestExternal", directory: "tests/standalone/nitro-test-external")
addFixtureTargets(
  to: package, name: "NitroTest", directory: "tests/standalone/nitro-test",
  dependencies: ["NitroTestExternalCxx", "NitroTestExternal", "NitroTestExternalSwiftBridge"],
  swiftModules: ["NitroTestExternal"]
)

package.targets += [
  .target(
    name: "NitroTestRunnerCxx",
    dependencies: [
      "Hermes", "NitroModulesCxx", "NitroModulesSwiftBridge",
      "NitroTestSwiftBridge", "NitroTestExternalSwiftBridge",
    ],
    path: "tests/standalone/test-runner/cpp",
    publicHeadersPath: ".",
    cxxSettings: cxxSettings
  ),
  .target(
    name: "NitroTestRunnerBridge",
    dependencies: ["NitroTestRunnerCxx"],
    path: "tests/standalone/test-runner/ios/Tests",
    exclude: ["RuntimeTests.swift"],
    sources: ["NitroTestBridge.mm"],
    publicHeadersPath: ".",
    cxxSettings: cxxSettings
  ),
  .testTarget(
    name: "NitroRuntimeTests",
    dependencies: ["NitroTestRunnerBridge"],
    path: "tests/standalone/test-runner",
    exclude: ["android", "cpp", "js", "scripts"],
    sources: ["ios/Tests/RuntimeTests.swift"],
    resources: [
      .copy("build/runtime-tests.js"),
      .copy("build/runtime-tests.json"),
      .copy("build/runtime-test-skips.json"),
    ],
    swiftSettings: [.swiftLanguageMode(.v5)]
  ),
]

// Each fixture uses the same split between public C++, Swift and private bridge
// targets as a generated module. A root package keeps all canonical sources inside
// the package boundary, including the shared core and the local Hermes framework.
func addFixtureTargets(
  to package: Package,
  name: String,
  directory: String,
  dependencies: [Target.Dependency] = [],
  swiftModules: [String] = []
) {
  let generated = "\(directory)/nitrogen/generated"
  let ios = "\(generated)/ios"
  let userCxxSources = ["\(directory)/cpp"].filter(exists)
  let cxxSources = ["\(generated)/shared/c++"] + userCxxSources
  let swiftSources = ["\(directory)/ios", "\(ios)/swift"]
  let exposedModules = ["NitroModules"] + swiftModules
  let exposedFlags = exposedModules.flatMap {
    ["-Xfrontend", "-clang-header-expose-module", "-Xfrontend", "\($0)=\($0)-Swift.h"]
  }
  let userHeaderFlags = userCxxSources.map {
    "-I" + URL(fileURLWithPath: Context.packageDirectory).appendingPathComponent($0).path
  }
  let bridgeSources = [
    "c++", "\(name)-Swift-Cxx-Bridge.cpp", "\(name)Autolinking.cpp",
  ]

  package.targets += [
    .target(
      name: "\(name)Cxx",
      dependencies: ["NitroModulesCxx"] + dependencies,
      path: ".",
      exclude: excludes(keeping: cxxSources),
      sources: cxxSources,
      publicHeadersPath: "\(generated)/shared/c++/include",
      cxxSettings: cxxSettings + [.unsafeFlags(userHeaderFlags)]
    ),
    .target(
      name: "\(name)AppleCxx",
      dependencies: [.target(name: "\(name)Cxx"), "NitroModulesAppleCxx"] + dependencies,
      path: "\(ios)/\(name)AppleCxx",
      cxxSettings: cxxSettings
    ),
    .target(
      name: name,
      dependencies: [.target(name: "\(name)AppleCxx"), "NitroModules"] + dependencies,
      path: ".",
      exclude: excludes(keeping: swiftSources),
      sources: swiftSources,
      cxxSettings: cxxSettings,
      swiftSettings: swiftSettings + [.unsafeFlags(exposedFlags)]
    ),
    .target(
      name: "\(name)SwiftBridge",
      dependencies: [.target(name: name), .target(name: "\(name)AppleCxx"), "NitroModulesSwiftBridge"] + dependencies,
      path: ios,
      sources: bridgeSources,
      publicHeadersPath: "c++/include",
      cxxSettings: cxxSettings + bridgeSettings + [
        .unsafeFlags(userHeaderFlags),
      ]
    ),
  ]
}

func exists(_ path: String) -> Bool {
  FileManager.default.fileExists(
    atPath: URL(fileURLWithPath: Context.packageDirectory).appendingPathComponent(path).path
  )
}

func excludes(keeping sources: [String]) -> [String] {
  var parents: Set<String> = [""]
  for source in sources {
    var components = source.split(separator: "/").dropLast()
    while !components.isEmpty {
      parents.insert(components.joined(separator: "/"))
      components = components.dropLast()
    }
  }
  let root = URL(fileURLWithPath: Context.packageDirectory)
  var result: [String] = []
  for parent in parents.sorted() {
    let directory = root.appendingPathComponent(parent)
    let entries = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
    for entry in entries.sorted() where !entry.hasPrefix(".") {
      let path = parent.isEmpty ? entry : "\(parent)/\(entry)"
      if !sources.contains(path) && !parents.contains(path) {
        result.append(path)
      }
    }
  }
  return result
}
