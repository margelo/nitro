require "json"
require Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-nitro-modules/cocoapods.rb", { paths: [process.argv[1]] })', __dir__]).strip

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# TODO: Remove CocoaPods support once Swift Package Manager is established across React Native apps.
Pod::Spec.new do |s|
  s.name = "$$appleModuleName$$"
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

  Nitro::CocoaPods.configure_library(s,
    generated_directory: 'nitrogen/generated',
    swift_sources: ['apple'],
    cxx_sources: ['cpp'])
end
