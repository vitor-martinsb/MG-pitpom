#include <stdbool.h>
#include <stdio.h>

#include "sokol/sokol_app.h"
#include "sokol/sokol_gfx.h"
#include "sokol/sokol_glue.h"
#include "sokol/sokol_imgui.h"
#include "sokol/sokol_time.h"
#include "common/audio.h"
#include "common/common.h"
#include "common/data.h"
#include "common/debug_console.h"
#include "common/graphics.h"
#include "common/inputs.h"
#include "common/log.h"
#include "common/storage.h"
#include "golf/draw.h"
#include "golf/game.h"
#include "golf/golf.h"
#include "golf/ui.h"
#ifdef GOLF_PLATFORM_EMSCRIPTEN
#include <emscripten.h>
#if defined(__has_feature)
#if __has_feature(address_sanitizer)
/* The browser event loop owns allocations after main returns. */
const char *__asan_default_options(void) { return "detect_leaks=0"; }
#endif
#endif
#endif

static void init(void) {
    stm_setup();
    sg_setup(&(sg_desc){ 
            .buffer_pool_size = 2048, 
            .image_pool_size = 2048,
            .context = sapp_sgcontext(),
            });
    simgui_setup(&(simgui_desc_t) {
            .dpi_scale = sapp_dpi_scale() 
            });
}

static void cleanup(void) {
    sg_shutdown();
}

static void frame(void) {
    static bool storage_inited = false;
    static bool inited = false;
    static uint64_t last_time = 0;

    float dt = (float) stm_sec(stm_laptime(&last_time));
    if (!inited) {
#ifdef GOLF_PLATFORM_EMSCRIPTEN
        /* Return to the browser while the loader's filesystem proxies run. */
        static bool assets_started = false;
        static const char *boot_assets[] = {
            "data/static_data.static_data", "data/config/game.cfg", "data/ui/ui.ui",
            "data/audio/confirmation_002.ogg", "data/audio/drop_001.ogg", "data/audio/drop_003.ogg",
            "data/audio/error_008.ogg", "data/audio/footstep_grass_004.ogg", "data/audio/impactPlank_medium_000.ogg", "data/audio/in_water.ogg",
            "data/shaders/diffuse_color_material.glsl", "data/shaders/environment_material.glsl", "data/shaders/pass_through.glsl",
            "data/shaders/solid_color_material.glsl", "data/shaders/texture_material.glsl", "data/shaders/render_image.glsl",
            "data/shaders/fxaa.glsl", "data/shaders/ui.glsl", "data/shaders/aim_line.glsl", "data/shaders/ball.glsl",
            "data/shaders/editor_water.glsl", "data/shaders/water.glsl", "data/shaders/water_around_ball.glsl", "data/shaders/water_ripple.glsl", "data/shaders/ball_hidden.glsl"
        };
        if (!assets_started) {
            golf_data_init();
            for (size_t i = 0; i < sizeof(boot_assets)/sizeof(boot_assets[0]); i++) golf_data_load(boot_assets[i], true);
            assets_started = true;
        }
        golf_data_update(0);
        for (size_t i = 0; i < sizeof(boot_assets)/sizeof(boot_assets[0]); i++) if (golf_data_get_load_state(boot_assets[i]) != GOLF_DATA_LOADED) return;
#else
        golf_data_init();
        golf_data_load("data/static_data.static_data", false);
#endif

        golf_storage_init();
        golf_audio_init();
        golf_debug_console_init();
        golf_inputs_init();
        golf_graphics_init();
        golf_draw_init();
        golf_init();
        inited = true;
    }

    if (!storage_inited && !golf_storage_finish_init()) {
        return;
    }
    storage_inited = true;
#ifdef GOLF_PLATFORM_EMSCRIPTEN
    static bool online_notified = false;
    if (!online_notified) {
        online_notified = true;
        EM_ASM({ if (window.GolfOnline) window.GolfOnline.initialized(); });
    }
#endif

    golf_data_update(dt);

    golf_graphics_begin_frame(dt);
    golf_inputs_begin_frame();

    golf_update(dt);

    golf_draw();

    golf_inputs_end_frame();
    golf_graphics_end_frame();

    fflush(stdout);
}

static void event(const sapp_event *event) {
    simgui_handle_event(event);
    golf_inputs_handle_event(event);
}

sapp_desc sokol_main(int argc, char *argv[]) {
    GOLF_UNUSED(argc);
    GOLF_UNUSED(argv);

    golf_alloc_init();
    golf_log_init();
    return (sapp_desc){
        .init_cb = init,
            .frame_cb = frame,
            .cleanup_cb = cleanup,
            .event_cb = event,
            .width = 375,
            .height = 667,
            .window_title = "PitPom Minigolfe",
            .enable_clipboard = true,
            .clipboard_size = 1024,
            .fullscreen = false,
            .high_dpi = false,
            .html5_canvas_resize = false,
            .win32_console_utf8 = true,
            .win32_console_create = true,
            .swap_interval = 1,
    };
}
