require "json"
require "./nitro_pod_utils"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::UI.puts "[NitroModules] 🔥 Your app is boosted by nitro modules!"

Pod::Spec.new do |s|
  s.name         = "NitroModules"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.source       = { :git => "https://github.com/margelo/nitro.git", :tag => "#{s.version}" }
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
    "cpp/core/AnyMap.hpp",
    "cpp/core/ArrayBuffer.hpp",
    "cpp/core/HybridObject.hpp",
    "cpp/core/Null.hpp",
    "cpp/core/Promise.hpp",
    "cpp/entrypoint/HybridNitroModulesProxy.hpp",
    "cpp/entrypoint/InstallNitro.hpp",
    "cpp/registry/HybridObjectRegistry.hpp",
    "cpp/jsi/JSIConverter.hpp",
    "cpp/jsi/JSIHelpers.hpp",
    "cpp/platform/NitroLogger.hpp",
    "cpp/threading/Dispatcher.hpp",
    "cpp/threading/ThreadPool.hpp",
    "cpp/utils/JSCallback.hpp",
    "cpp/utils/FastVectorCopy.hpp",
    "cpp/utils/NitroHash.hpp",
    "cpp/utils/NitroDefines.hpp",
    "cpp/utils/PropNameIDCache.hpp",
    "cpp/views/CachedProp.hpp",
    "cpp/views/RawPropsCompat.hpp",
    "cpp/views/ReactProp.hpp",
    "cpp/views/ViewComponentDescriptor.hpp",
    "cpp/views/ViewPropsHolderState.hpp",
    # Public iOS-specific headers that will be exposed in modulemap (for Swift)
    "ios/core/ArrayBufferHolder.hpp",
    "ios/core/PromiseHolder.hpp",
    "ios/utils/AnyMapUtils.hpp",
    "ios/utils/Result.hpp",
    "ios/utils/DateToChronoDate.hpp",
    "ios/utils/RuntimeError.hpp",
    "ios/utils/SwiftClosure.hpp",
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
