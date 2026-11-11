// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "Hermes",
  platforms: [.iOS(.v16)],
  products: [
    .library(name: "Hermes", targets: ["Hermes"])
  ],
  targets: [
    .binaryTarget(
      name: "NitroTestHermes",
      path: "../.build/hermes/NitroTestHermes.xcframework"
    ),
    .target(
      name: "Hermes",
      dependencies: ["NitroTestHermes"],
      linkerSettings: [
        .linkedFramework("Foundation"),
        .linkedFramework("CoreFoundation"),
      ]
    ),
  ],
  cxxLanguageStandard: .cxx20
)
