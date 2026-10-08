file(GLOB_RECURSE data_files CONFIGURE_DEPENDS "${CMAKE_SOURCE_DIR}/data/*")
if(CMAKE_SYSTEM_NAME STREQUAL Android OR CMAKE_SYSTEM_NAME STREQUAL iOS OR CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    find_package(Python3 REQUIRED COMPONENTS Interpreter)
    add_custom_command(OUTPUT "${CMAKE_SOURCE_DIR}/out/data.zip" "${CMAKE_SOURCE_DIR}/src/common/data_zip.h"
        COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/build/pack-assets.py"
            "${CMAKE_SOURCE_DIR}/data" "${CMAKE_SOURCE_DIR}/out/data.zip"
            --header "${CMAKE_SOURCE_DIR}/src/common/data_zip.h"
        DEPENDS ${data_files} "${CMAKE_SOURCE_DIR}/build/pack-assets.py"
        VERBATIM)
    add_custom_target(embedded_data_zip_header DEPENDS "${CMAKE_SOURCE_DIR}/src/common/data_zip.h")
endif()

add_library(common STATIC
    alloc.c
    audio.c
    base64.c
    bvh.c
    data.c
    debug_console.c
    file.c
    graphics.c
    inputs.c
    json.c
    level.c
    log.c
    level.c
    map.c
    maths.c
    projection.c
    script.c
    storage.c
    string.c
    thread.c
    vec.c)


if(MSVC)
    target_compile_options(common PRIVATE /W3)
elseif(CMAKE_SYSTEM_NAME STREQUAL Windows)
    target_compile_options(common PRIVATE -Wall -Wextra -Wpedantic)
elseif(CMAKE_SYSTEM_NAME STREQUAL Linux)
    target_compile_options(common PRIVATE -Wall -Wextra -Wpedantic)
elseif(CMAKE_SYSTEM_NAME STREQUAL iOS)
    target_compile_options(common PRIVATE -x objective-c)
endif()

if(CMAKE_SYSTEM_NAME STREQUAL Windows)
    # The Windows thread timer uses the multimedia timer API.
    target_link_libraries(common PUBLIC winmm)
endif()

if(CMAKE_SYSTEM_NAME STREQUAL Android OR CMAKE_SYSTEM_NAME STREQUAL iOS OR CMAKE_SYSTEM_NAME STREQUAL Emscripten)
    add_dependencies(common embedded_data_zip_header)
endif()
