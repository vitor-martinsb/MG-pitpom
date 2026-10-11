#ifndef GOLF_I18N_H
#define GOLF_I18N_H
const char *golf_i18n_t(const char *key);
const char *golf_i18n_translate(const char *source);
const char *golf_get_language(void);
void golf_set_language(const char *language);
/* Decode one UTF-8 codepoint, using '?' for invalid/unsupported characters. */
int golf_utf8_next(const char **text);
#endif
