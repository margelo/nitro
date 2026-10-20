// swift-tools-version: 6.2

import PackageDescription

let package = Package(
  name: "$$iosModuleName$$",
  platforms: [.iOS(.v16)]
)

// Nitrogen generates the native targets below when you run npm run specs.
addNitrogenTargets(to: package)
