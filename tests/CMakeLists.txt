cmake_minimum_required(VERSION 3.12)
project(open_golf_player_tests C)

enable_testing()
add_executable(golf_player_tests
    player_test.c
    ../src/golf/player.c
    ../src/common/maths.c)
target_include_directories(golf_player_tests PRIVATE ../src)
if(NOT WIN32)
    target_link_libraries(golf_player_tests PRIVATE m)
endif()
add_test(NAME player_lifecycle COMMAND golf_player_tests)

add_executable(golf_player_labels_tests
    player_labels_test.c
    ../src/golf/player_labels.c
    ../src/common/projection.c
    ../src/common/maths.c)
target_include_directories(golf_player_labels_tests PRIVATE ../src)
if(NOT WIN32)
    target_link_libraries(golf_player_labels_tests PRIVATE m)
endif()
add_test(NAME player_labels COMMAND golf_player_labels_tests)

find_package(Python3 REQUIRED COMPONENTS Interpreter)
execute_process(COMMAND ${Python3_EXECUTABLE} "${CMAKE_CURRENT_SOURCE_DIR}/../build/generate-i18n.py" "${CMAKE_BINARY_DIR}/generated" COMMAND_ERROR_IS_FATAL ANY)
add_executable(golf_i18n_tests i18n_test.c ../src/golf/i18n.c)
target_include_directories(golf_i18n_tests PRIVATE ../src "${CMAKE_BINARY_DIR}/generated")
add_test(NAME language_and_utf8 COMMAND golf_i18n_tests)
