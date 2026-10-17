require "json"
require_relative "./apple/nitro_pod_utils"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

if ENV["RCT_NEW_ARCH_ENABLED"] == "0"
  raise "[NitroModules] Nitro requires React Native's New Architecture. Remove RCT_NEW_ARCH_ENABLED=0 and reinstall Pods."
end

Pod::UI.puts "[NitroModules] 🔥 Your app is boosted by nitro modules!"

Pod::Spec.new do |s|
  s.name         = "NitroModules"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.source       = { :git => "https://github.com/margelo/nitro.git", :tag => "v#{s.version}" }
  s.platforms    = {
    :ios => min_ios_version_supported,
    :visionos => 1.0,
    :macos => 10.13,
    :osx => 10.13,
    :tvos => 13.4,
  }

  s.source_files = [
    # Shared C++ codebase
    "cpp/**/*.{h,hpp}",
    "cpp/**/*.{c,cpp}",
    # iOS codebase
    "ios/**/*.{h,hpp}",
    "ios/**/*.{c,cpp}",
    "ios/**/*.{m,mm}",
    "ios/**/*.swift",
  ]
  s.public_header_files = [
    # Public C++ headers will be exposed in modulemap (for Swift)
    "cpp/core/core/AnyMap.hpp",
    "cpp/core/core/ArrayBuffer.hpp",
    "cpp/core/core/HybridObject.hpp",
    "cpp/core/core/Null.hpp",
    "cpp/core/core/Promise.hpp",
    "cpp/core/entrypoint/HybridNitroModulesProxy.hpp",
    "cpp/core/entrypoint/InstallNitro.hpp",
    "cpp/core/registry/HybridObjectRegistry.hpp",
    "cpp/core/jsi/JSIConverter.hpp",
    "cpp/core/jsi/JSIHelpers.hpp",
    "cpp/core/platform/NitroLogger.hpp",
    "cpp/core/threading/Dispatcher.hpp",
    "cpp/core/threading/ThreadPool.hpp",
    "cpp/core/utils/JSCallback.hpp",
    "cpp/core/utils/FastVectorCopy.hpp",
    "cpp/core/utils/NitroHash.hpp",
    "cpp/core/utils/NitroDefines.hpp",
    "cpp/core/utils/PropNameIDCache.hpp",
    "cpp/views/CachedProp.hpp",
    "cpp/views/RawPropsCompat.hpp",
    "cpp/views/ReactProp.hpp",
    "cpp/views/ViewComponentDescriptor.hpp",
    "cpp/views/ViewPropsHolderState.hpp",
    # Public iOS-specific headers that will be exposed in modulemap (for Swift)
    "ios/core/core/ArrayBufferHolder.hpp",
    "ios/core/core/PromiseHolder.hpp",
    "ios/core/utils/AnyMapUtils.hpp",
    "ios/core/utils/Result.hpp",
    "ios/core/utils/DateToChronoDate.hpp",
    "ios/core/utils/RuntimeError.hpp",
    "ios/core/utils/SwiftClosure.hpp",
  ]

  xcconfig = {
    # Use C++ 20
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    # Enables C++ <-> Swift interop (by default its only ObjC)
    "SWIFT_OBJC_INTEROP_MODE" => "objcxx",
    # Enables stricter modular headers
    "DEFINES_MODULE" => "YES",
  }

  if has_react_native()
    react_native_version = get_react_native_version()
    if (react_native_version < 80)
      # C++ compiler flags, for folly when building as static framework:
      current_header_search_paths = Array(xcconfig["HEADER_SEARCH_PATHS"])
      xcconfig["HEADER_SEARCH_PATHS"] = current_header_search_paths + ["${PODS_ROOT}/RCT-Folly"]
      xcconfig["GCC_PREPROCESSOR_DEFINITIONS"] = "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES"
      xcconfig["OTHER_CPLUSPLUSFLAGS"] = "$(inherited) -DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1"
    end
  end

  s.pod_target_xcconfig = xcconfig

  # Nitro depends on JSI.
  s.dependency 'React-jsi'
  # For React Native, we implement nitro::Dispatcher using react::CallInvoker
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
