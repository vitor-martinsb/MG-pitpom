#ifndef GOLF_PROGRESS_H
#define GOLF_PROGRESS_H
#include <stdio.h>
#include "common/data.h"
/* Keep the original twenty-course records; the new campaign has its own saves. */
static inline void golf_progress_key(char *key,size_t size,golf_config_t *config,int level) {
    snprintf(key,size,CFG_NUM(config,"campaign_version")>0?"pitpom100_best_%d":"stroke_count_level_%d",level);
}
#endif
