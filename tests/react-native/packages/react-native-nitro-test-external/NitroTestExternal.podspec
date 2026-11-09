require "json"
require Pod::Executable.execute_command('node', ['-p',
  'require.resolve("react-native-nitro-modules/cocoapods.rb", { paths: [process.argv[1]] })', __dir__]).strip

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroTestExternal"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/margelo/nitro"
  s.license      = "MIT"
  s.authors      = "Marc Rousavy"
  s.platforms    = { :ios => "16.0" }
  s.source       = { :git => "https://github.com/margelo/nitro.git", :tag => "#{s.version}" }

  # TODO: Remove CocoaPods support once React Native's SwiftPM integration is established.
  Nitro::CocoaPods.configure_library(s, generated_directory: 'nitrogen/generated')
end
