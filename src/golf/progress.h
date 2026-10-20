#ifndef GOLF_PROGRESS_H
#define GOLF_PROGRESS_H
#include <stdio.h>
#include "common/data.h"
#include "golf/i18n.h"
/* Keep the original twenty-course records; the new campaign has its own saves. */
static inline void golf_progress_key(char *key,size_t size,golf_config_t *config,int level) {
    if(CFG_NUM(config,"family_campaign_version")>0){
        if(level%4==0)snprintf(key,size,"stroke_count_level_%d",level/4);
        else snprintf(key,size,"pitpom80_best_%d_%d",level/4+1,level%4);
        return;
    }
    snprintf(key,size,CFG_NUM(config,"campaign_version")>0?"pitpom100_best_%d":"stroke_count_level_%d",level);
}
static inline void golf_course_label(char *label,size_t size,golf_config_t *config,int level){
    if(CFG_NUM(config,"family_campaign_version")>0){
        char key[32];snprintf(key,sizeof(key),"family.%d",level/4+1);
        snprintf(label,size,"%s - %s %d",golf_i18n_t(key),golf_i18n_t("courseWord"),level%4+1);
    }else snprintf(label,size,"%d",level+1);
}
#endif
