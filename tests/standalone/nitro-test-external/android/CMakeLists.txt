cmake_minimum_required(VERSION 3.22.1)
project(NitroTestExternal LANGUAGES C CXX)

set(GENERATED "${CMAKE_CURRENT_LIST_DIR}/../nitrogen/generated")
find_package(hermes REQUIRED CONFIG)

add_library(NitroTestExternal SHARED
  ../cpp/HybridSharedSpecializationsCpp.cpp
  src/main/cpp/JNIOnLoad.cpp)
include("${GENERATED}/android/NitroTestExternal+autolinking.cmake")
target_compile_options(NitroTestExternal PRIVATE -frtti -fexceptions -Wall -Wextra)
target_include_directories(NitroTestExternal PRIVATE
  ../cpp)
target_link_libraries(NitroTestExternal hermes::hermesvm android log)

include("${CMAKE_CURRENT_LIST_DIR}/../../test-runner/android/sanitizer.cmake")
nitro_apply_test_sanitizer(NitroTestExternal)
