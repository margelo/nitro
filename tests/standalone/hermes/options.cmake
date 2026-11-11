# Keep the runtime and JSI API, including source evaluation. The test host does
# not use the engine's CLI, Node API, or optional Web-style extensions.
set(HERMES_ENABLE_TOOLS OFF CACHE BOOL "" FORCE)
set(HERMES_ENABLE_TEST_SUITE OFF CACHE BOOL "" FORCE)
set(HERMES_ENABLE_NAPI OFF CACHE BOOL "" FORCE)
set(HERMES_ENABLE_CORE_EXTENSIONS OFF CACHE BOOL "" FORCE)
set(HERMES_ENABLE_CONTRIB_EXTENSIONS OFF CACHE BOOL "" FORCE)
set(HERMES_ALLOW_BOOST_CONTEXT 0 CACHE STRING "" FORCE)
set(HERMES_BUILD_SHARED_JSI OFF CACHE BOOL "" FORCE)
# Runtime tests use Debug builds, which enable assertions. Keep the additional
# consistency checks enabled as well; the Release host compiler ignores this.
set(HERMES_SLOW_DEBUG ON CACHE BOOL "" FORCE)
