cmake_minimum_required(VERSION 3.22.1)
project(NitroCore LANGUAGES C CXX)

set_property(GLOBAL PROPERTY JOB_POOLS nitro_compile=2)
set(CMAKE_JOB_POOL_COMPILE nitro_compile)

get_filename_component(NITRO_NATIVE "../../../../packages/nitro-core/native" ABSOLUTE)
find_package(fbjni REQUIRED CONFIG)
find_package(hermes REQUIRED CONFIG)

# Build every source in Nitro Core directly from the package.
file(GLOB_RECURSE NITRO_CPP CONFIGURE_DEPENDS "${NITRO_NATIVE}/cpp/*.cpp")
file(GLOB_RECURSE NITRO_ANDROID CONFIGURE_DEPENDS "${NITRO_NATIVE}/android/src/main/cpp/*.cpp")
file(GLOB_RECURSE NITRO_HEADERS CONFIGURE_DEPENDS
  "${NITRO_NATIVE}/cpp/*.hpp"
  "${NITRO_NATIVE}/android/src/main/cpp/*.hpp")
foreach(HEADER IN LISTS NITRO_HEADERS)
  get_filename_component(DIRECTORY "${HEADER}" DIRECTORY)
  list(APPEND NITRO_INCLUDE_DIRECTORIES "${DIRECTORY}")
endforeach()
list(REMOVE_DUPLICATES NITRO_INCLUDE_DIRECTORIES)

add_library(NitroModules SHARED
  ${NITRO_CPP}
  ${NITRO_ANDROID}
  src/main/cpp/JNIOnLoad.cpp)
target_compile_features(NitroModules PUBLIC cxx_std_20)
target_compile_options(NitroModules PRIVATE -frtti -fexceptions -Wall -Wextra)
target_include_directories(NitroModules PRIVATE ${NITRO_INCLUDE_DIRECTORIES})
target_link_libraries(NitroModules PUBLIC hermes::hermesvm fbjni::fbjni android log)

include("${CMAKE_CURRENT_LIST_DIR}/../../test-runner/android/sanitizer.cmake")
nitro_apply_test_sanitizer(NitroModules)
