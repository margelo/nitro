require "json"

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

  # The React Native CLI reads this metadata for discovery. Package.swift builds the module.
end
