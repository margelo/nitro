require "json"
require Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-nitro-modules/cocoapods.rb", { paths: [process.argv[1]] })', __dir__]).strip

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroTest"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "16.0", :visionos => 1.0 }
  s.source       = { :git => "https://github.com/margelo/nitro.git", :tag => "#{s.version}" }

  # TODO: Remove CocoaPods support once React Native defaults to Swift Package Manager.
  Nitro::CocoaPods.configure_library(s, generated_directory: 'nitrogen/generated')
end
