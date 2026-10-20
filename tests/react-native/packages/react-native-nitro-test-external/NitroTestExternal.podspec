require "json"

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

  # The React Native CLI reads this metadata for discovery. Package.swift builds the module.
end
