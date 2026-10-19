cmake_minimum_required(VERSION 3.22.1)
project(NitroTestExternal LANGUAGES C CXX)

set(GENERATED "${CMAKE_CURRENT_LIST_DIR}/../nitrogen/generated")
find_package(fbjni REQUIRED CONFIG)
find_package(hermes REQUIRED CONFIG)
find_package(nitro-core REQUIRED CONFIG)

file(GLOB_RECURSE GENERATED_CPP CONFIGURE_DEPENDS
  "${GENERATED}/shared/c++/*.cpp"
  "${GENERATED}/android/c++/*.cpp")
add_library(NitroTestExternal SHARED
  ${GENERATED_CPP}
  "${GENERATED}/android/NitroTestExternalOnLoad.cpp"
  src/main/cpp/JNIOnLoad.cpp)
target_compile_features(NitroTestExternal PRIVATE cxx_std_20)
target_compile_options(NitroTestExternal PRIVATE -frtti -fexceptions -Wall -Wextra)
target_compile_definitions(NitroTestExternal PRIVATE BUILDING_NITROTESTEXTERNAL_WITH_GENERATED_CMAKE_PROJECT)
target_include_directories(NitroTestExternal PRIVATE
  "${GENERATED}/shared/c++"
  "${GENERATED}/android/c++"
  "${GENERATED}/android")
target_link_libraries(NitroTestExternal PUBLIC nitro-core::NitroModules hermes::hermesvm fbjni::fbjni android log)

include("${CMAKE_CURRENT_LIST_DIR}/../../test-runner/android/sanitizer.cmake")
nitro_apply_test_sanitizer(NitroTestExternal)
