// swift-tools-version: 6.2

import PackageDescription

let package = Package(
  name: "$$appleModuleName$$",
  platforms: [.iOS(.v16), .macOS(.v13), .tvOS(.v16), .visionOS(.v1)]
)

// Nitrogen generates the native targets below when you run npm run specs.
addNitrogenTargets(to: package)
