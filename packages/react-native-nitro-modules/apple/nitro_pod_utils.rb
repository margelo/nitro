require "json"

# Gets the path of the react-native/package.json file.
def get_react_native_package_path()
  pod_root = Pod::Config.instance.installation_root.to_s
  return `cd "#{pod_root}" && node --print "require.resolve('react-native/package.json')"`.strip!
end

# Finds out whether react-native is available, or not.
# This works by checking if the react-native node package can be resolved.
def has_react_native()
  react_native_package_path = get_react_native_package_path()
  return File.exist?(react_native_package_path)
end

# Gets the minor react-native version (e.g 76 for 0.76.4)
def get_react_native_version()
  react_native_package_path = get_react_native_package_path()
  if !File.exist?(react_native_package_path)
    raise "[NitroModules] Couldn't find react-native path! File '#{react_native_package_path}' doesn't exist!"
  end
  react_native_package = JSON.parse(File.read(react_native_package_path))
  react_native_version = react_native_package['version']
  react_native_minor_version = react_native_version.split('.')[1].to_i
  Pod::UI.puts "[NitroModules] Found react-native #{react_native_version} (#{react_native_minor_version}) in #{File.dirname(react_native_package_path)}!"
  return react_native_minor_version
end