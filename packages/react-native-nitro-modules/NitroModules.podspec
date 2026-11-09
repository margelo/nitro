require "json"
require_relative "cocoapods"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# TODO: Remove CocoaPods support once React Native SwiftPM integration is established.
Pod::Spec.new do |s|
  s.name = "NitroModules"
  s.version = package["version"]
  s.summary = package["description"]
  s.homepage = package["homepage"]
  s.license = package["license"]
  s.authors = package["author"]
  s.source = { :git => "https://github.com/margelo/nitro.git", :tag => "v#{s.version}" }
  s.ios.deployment_target = "16.0"
  s.osx.deployment_target = "13.0"
  s.tvos.deployment_target = "16.0"
  s.visionos.deployment_target = "1.0"

  Nitro::CocoaPods.configure_runtime(s)
end
