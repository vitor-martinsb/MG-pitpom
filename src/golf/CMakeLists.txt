
set(GOLF_LIBRARIES
    common
    cimgui
    fast_obj
    mattiasgustavsson_libs
    miniz
    parson
    sokol
    stb
    xatlas)

if(CMAKE_SYSTEM_NAME STREQUAL Android)
    set(GOLF_LIBRARIES
        ${GOLF_LIBRARIES}
        GLESv3
        EGL 
        log 
        android
        OpenSLES)
    add_library(golf SHARED
        draw.c
        game.c
        golf.c
        main.c
        online.c
        physics.c
        player.c
        player_labels.c
        ui.c)
    target_link_libraries(golf PRIVATE ${GOLF_LIBRARIES})
else()
    if(CMAKE_SYSTEM_NAME STREQUAL iOS)
        set(IOS_ICON "${CMAKE_SOURCE_DIR}/build/ios/icon.jpg")
    else()
        set(IOS_ICON "")
    endif()

    add_executable(golf
        draw.c
        game.c
        golf.c
        main.c
        online.c
        physics.c
        player.c
        player_labels.c
        ui.c
        "${IOS_ICON}")
    if(CMAKE_SYSTEM_NAME STREQUAL Linux)
        set(GOLF_LIBRARIES 
            ${GOLF_LIBRARIES}
            -lX11
            -lXcursor
            -lXi
            -lGL
            -ldl
            -lpthread
            -lm
            -lasound)
    elseif(CMAKE_SYSTEM_NAME STREQUAL Darwin)
        set(GOLF_LIBRARIES 
            ${GOLF_LIBRARIES}
            "-framework AudioToolbox"
            "-framework Cocoa"
            "-framework QuartzCore"
            "-framework OpenGL")
    elseif(CMAKE_SYSTEM_NAME STREQUAL iOS)
        set(GOLF_LIBRARIES
            -lc++
            ${GOLF_LIBRARIES}
            "-framework Foundation"
            "-framework UIKit"
            "-framework OpenGLES"
            "-framework GLKit"
            "-framework AudioToolbox"
            "-framework AvFoundation")
        set_target_properties(golf PROPERTIES
            MACOSX_BUNDLE_INFO_PLIST "${CMAKE_SOURCE_DIR}/build/ios/plist.in"
            RESOURCE "${CMAKE_SOURCE_DIR}/build/ios/LaunchScreen.storyboard;${CMAKE_SOURCE_DIR}/build/ios/icon.jpg")
    elseif(CMAKE_SYSTEM_NAME STREQUAL Emscripten)
        set_target_properties( golf PROPERTIES 
            SUFFIX ".html")
        set_property(TARGET golf APPEND PROPERTY LINK_DEPENDS
            "${CMAKE_SOURCE_DIR}/build/emscripten/multiplayer.html")
        find_package(Python3 REQUIRED COMPONENTS Interpreter)
        add_custom_command(TARGET golf POST_BUILD
            COMMAND ${Python3_EXECUTABLE} "${CMAKE_SOURCE_DIR}/build/gzip-web.py" "${CMAKE_BINARY_DIR}/golf.wasm"
            VERBATIM)
    else()
    endif()
    target_link_libraries(golf PRIVATE ${GOLF_LIBRARIES})
endif()

if(MSVC)
    target_compile_options(golf PRIVATE /W3)
else()
    target_compile_options(golf PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(GOLF_EXECUTABLE_NAME)
    set_target_properties(golf PROPERTIES OUTPUT_NAME "${GOLF_EXECUTABLE_NAME}")
endif()
