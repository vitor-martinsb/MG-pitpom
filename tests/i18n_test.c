#include <assert.h>
#include <string.h>
#include "golf/i18n.h"
int main(void) {
    assert(!strcmp(golf_get_language(),"en"));
    golf_set_language("pt-BR");assert(!strcmp(golf_i18n_translate("PAUSED"),"PAUSADO"));
    assert(!strcmp(golf_i18n_t("c.you"),"VOC\303\212"));
    golf_set_language("es");assert(!strcmp(golf_i18n_t("c.you"),"T\303\232"));
    assert(!strcmp(golf_i18n_translate("PitPom Minigolfe"),"PitPom Minigolfe"));
    assert(!strcmp(golf_i18n_t("unknown"),"unknown"));
    golf_set_language("invalid");assert(!strcmp(golf_get_language(),"en"));
    const char *text="A\303\252\303\261\360\237\216\257Z";
    int expected[]={65,234,241,'?',90};
    for(int i=0;i<5;i++)assert(golf_utf8_next(&text)==expected[i]);assert(*text==0);
    const char *bad="\303A\300\200\355\240\200\364\220\200\200X";
    int n=0;while(*bad){int c=golf_utf8_next(&bad);assert(c>0&&c<=255);assert(++n<12);}
    const char *truncated="\342\202";assert(golf_utf8_next(&truncated)=='?');assert(*truncated==0);
    return 0;
}
