cmake_minimum_required(VERSION 3.22.1)
project(NitroTest LANGUAGES C CXX)

set_property(GLOBAL PROPERTY JOB_POOLS nitro_compile=2)
set(CMAKE_JOB_POOL_COMPILE nitro_compile)

set(GENERATED "${CMAKE_CURRENT_LIST_DIR}/../nitrogen/generated")

find_package(fbjni REQUIRED CONFIG)
find_package(hermes REQUIRED CONFIG)
find_package(nitro-core REQUIRED CONFIG)
find_package(nitro-test-external REQUIRED CONFIG)

file(GLOB_RECURSE GENERATED_CPP CONFIGURE_DEPENDS
  "${GENERATED}/shared/c++/*.cpp"
  "${GENERATED}/android/c++/*.cpp")

add_library(NitroTest SHARED
  ${GENERATED_CPP}
  ../cpp/HybridTestObjectCpp.cpp
  "${GENERATED}/android/NitroTestOnLoad.cpp"
  src/main/cpp/JNIOnLoad.cpp)
target_compile_features(NitroTest PUBLIC cxx_std_20)
target_compile_options(NitroTest PRIVATE -frtti -fexceptions -Wall -Wextra)
target_compile_definitions(NitroTest PRIVATE BUILDING_NITROTEST_WITH_GENERATED_CMAKE_PROJECT)
target_include_directories(NitroTest PRIVATE
  "${GENERATED}/shared/c++"
  "${GENERATED}/android/c++"
  "${GENERATED}/android"
  ../cpp)
target_link_libraries(NitroTest PUBLIC
  nitro-core::NitroModules nitro-test-external::NitroTestExternal hermes::hermesvm fbjni::fbjni android log)

include("${CMAKE_CURRENT_LIST_DIR}/../../test-runner/android/sanitizer.cmake")
nitro_apply_test_sanitizer(NitroTest)
