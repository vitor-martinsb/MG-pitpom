#ifndef GOLF_PROGRESS_H
#define GOLF_PROGRESS_H
#include <stdio.h>
#include "common/data.h"
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
        if(level%4)snprintf(label,size,"%d.%d",level/4+1,level%4);
        else snprintf(label,size,"%d",level/4+1);
    }else snprintf(label,size,"%d",level+1);
}
#endif
