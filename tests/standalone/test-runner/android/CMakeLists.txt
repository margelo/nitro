cmake_minimum_required(VERSION 3.22.1)
project(NitroTestRunner LANGUAGES C CXX)

set_property(GLOBAL PROPERTY JOB_POOLS nitro_compile=2)
set(CMAKE_JOB_POOL_COMPILE nitro_compile)

find_package(fbjni REQUIRED CONFIG)
find_package(hermes REQUIRED CONFIG)
find_package(nitro-core REQUIRED CONFIG)
find_package(nitro-test REQUIRED CONFIG)

add_library(NitroTestRunner SHARED
  ../cpp/TestRuntime.cpp
  src/main/cpp/JNIOnLoad.cpp)
target_compile_features(NitroTestRunner PRIVATE cxx_std_20)
target_compile_options(NitroTestRunner PRIVATE -frtti -fexceptions -Wall -Wextra)
target_include_directories(NitroTestRunner PRIVATE ../cpp)
target_link_libraries(NitroTestRunner PRIVATE
  nitro-test::NitroTest nitro-core::NitroModules hermes::hermesvm fbjni::fbjni android log)

include("${CMAKE_CURRENT_LIST_DIR}/sanitizer.cmake")
nitro_apply_test_sanitizer(NitroTestRunner)
