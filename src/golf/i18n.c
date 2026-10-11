#include "golf/i18n.h"
#include <string.h>
#include "i18n_tables.h"
#ifdef GOLF_PLATFORM_EMSCRIPTEN
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
static int language;
static const char *languages[] = {"en", "pt-BR", "es"};
EMSCRIPTEN_KEEPALIVE void golf_set_language(const char *value) {
    language = 0;
    if (value) for (int i = 0; i < 3; i++) if (!strcmp(value, languages[i])) language = i;
}
EMSCRIPTEN_KEEPALIVE const char *golf_get_language(void) { return languages[language]; }
EMSCRIPTEN_KEEPALIVE const char *golf_i18n_t(const char *key) {
    if (!key) return "";
    for (unsigned i = 0; i < sizeof(golf_translations)/sizeof(golf_translations[0]); i++)
        if (!strcmp(key, golf_translations[i].key)) return golf_translations[i].text[language];
    return key;
}
const char *golf_i18n_translate(const char *source) {
    for (unsigned i = 0; i < sizeof(golf_translations)/sizeof(golf_translations[0]); i++)
        if (!strncmp(golf_translations[i].key, "c.", 2) && !strcmp(source, golf_translations[i].text[0]))
            return golf_translations[i].text[language];
    return source;
}
int golf_utf8_next(const char **text) {
    const unsigned char *p = (const unsigned char *)*text;
    unsigned c = *p++, n = 0, minimum = 0;
    if (!c) return 0;
    if (c >= 0xc2 && c <= 0xdf) { c &= 0x1f; n = 1; minimum = 0x80; }
    else if (c >= 0xe0 && c <= 0xef) { c &= 0x0f; n = 2; minimum = 0x800; }
    else if (c >= 0xf0 && c <= 0xf4) { c &= 7; n = 3; minimum = 0x10000; }
    else if (c >= 0x80) { *text = (const char *)p; return '?'; }
    for (unsigned i = 0; i < n; i++) {
        if ((*p & 0xc0) != 0x80) { *text = (const char *)p; return '?'; }
        c = (c << 6) | (*p++ & 0x3f);
    }
    *text = (const char *)p;
    if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return '?';
    return (c >= 32 && c <= 126) || (c >= 160 && c <= 255) ? (int)c : '?';
}
