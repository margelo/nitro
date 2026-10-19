include_guard(GLOBAL)

# Build the pinned Hermes sources with their own target definitions and the
# shared test options, without React Native.
function(nitro_add_test_hermes)
  get_filename_component(tests_dir "${CMAKE_CURRENT_FUNCTION_LIST_DIR}/.." ABSOLUTE)
  set(hermes_source "${tests_dir}/hermes/hermes")
  set(host_compilers "${tests_dir}/.build/hermes/host/ImportHostCompilers.cmake")
  if(NOT EXISTS "${hermes_source}/CMakeLists.txt")
    message(FATAL_ERROR "Initialize Hermes with git submodule update --init --recursive")
  endif()
  if(NOT EXISTS "${host_compilers}")
    message(FATAL_ERROR "Build the host compiler first: bun tests/standalone/hermes/build.mjs host")
  endif()

  set(IMPORT_HOST_COMPILERS "${host_compilers}" CACHE FILEPATH "" FORCE)
  include("${CMAKE_CURRENT_FUNCTION_LIST_DIR}/options.cmake")
  set(HERMES_IS_ANDROID ${ANDROID} CACHE BOOL "" FORCE)
  set(CMAKE_POSITION_INDEPENDENT_CODE ON)
  add_subdirectory("${hermes_source}" "${CMAKE_CURRENT_BINARY_DIR}/hermes" EXCLUDE_FROM_ALL)
endfunction()
