cmake_minimum_required(VERSION 3.22.1)
project(NitroTestHermes LANGUAGES C CXX)

set_property(GLOBAL PROPERTY JOB_POOLS hermes_compile=2)
set(CMAKE_JOB_POOL_COMPILE hermes_compile)

find_package(fbjni REQUIRED CONFIG)
include("${CMAKE_CURRENT_LIST_DIR}/../Hermes.cmake")
# Upstream's shared target contains the engine and JSI once. Prefab consumers
# link this DSO instead of embedding either static library in their own DSOs.
nitro_add_test_hermes()
