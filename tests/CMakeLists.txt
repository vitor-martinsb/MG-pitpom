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
