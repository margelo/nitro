project(NitroModules)
cmake_minimum_required(VERSION 3.9.0)

set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# Find all C++ files (shared and platform specifics)
file(GLOB_RECURSE shared_files RELATIVE ${CMAKE_SOURCE_DIR}
     "../cpp/**.cpp"
)
file(GLOB_RECURSE android_files RELATIVE ${CMAKE_SOURCE_DIR}
     "src/main/cpp/**.cpp"
     "core/main/cpp/**.cpp"
)

# Create library "NitroModules" and add all C++ files to it
add_library(NitroModules SHARED
            ${shared_files}
            ${android_files}
)

# Specifies a path to native header files.
include_directories(
  # Shared Nitro Core C++ includes
  ../cpp/core/core
  ../cpp/core/entrypoint
  ../cpp/core/jsi
  ../cpp/core/platform
  ../cpp/core/registry
  ../cpp/core/prototype
  ../cpp/core/test-object
  ../cpp/core/templates
  ../cpp/core/threading
  ../cpp/core/utils
  # React Native C++ includes
  ../cpp/threading
  ../cpp/views
  src/main/cpp/turbomodule
  src/main/cpp/views
  # Android-specific Nitro Core C++ includes
  core/main/cpp
  core/main/cpp/core
  core/main/cpp/registry
  core/main/cpp/platform
  core/main/cpp/threading
  core/main/cpp/utils
)

# Find required libraries
find_library(LOG_LIB log)
find_package(fbjni REQUIRED NitroConfig)
find_package(ReactAndroid REQUIRED NitroConfig)

# Link all libraries together
target_link_libraries(
        NitroModules
        ${LOG_LIB}                                # <-- Logcat logger
        android                                   # <-- Android JNI core
        fbjni::fbjni                              # <-- Facebook C++ JNI helpers
        ReactAndroid::jsi                         # <-- RN: JSI
        ReactAndroid::reactnative                 # <-- RN: TurboModules
)
