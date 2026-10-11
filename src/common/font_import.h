/* Shared by the asset importer and the portable font regeneration tool. */
#ifndef GOLF_FONT_IMPORT_H
#define GOLF_FONT_IMPORT_H
#include <stdlib.h>
#include <string.h>
#include "stb/stb_truetype.h"
#include "stb/stb_image_write.h"
#include "parson/parson.h"
typedef struct { unsigned char *data; size_t size; int failed; } golf_font_png_t;
static void golf_font_png_write(void *context, void *data, int size) {
    golf_font_png_t *png = context;
    unsigned char *next = realloc(png->data, png->size + (size_t)size);
    if (!next) { png->failed = 1; return; }
    png->data = next; memcpy(next + png->size, data, (size_t)size); png->size += (size_t)size;
}
static JSON_Value *golf_font_atlas_import(const char *file_data, int font_size, int img_size) {
    unsigned char *bitmap = calloc((size_t)img_size, (size_t)img_size);
    stbtt_bakedchar chars[224] = {0};
    if (!bitmap) return NULL;
    if (stbtt_BakeFontBitmap((const unsigned char*)file_data, 0, (float)-font_size,
                bitmap, img_size, img_size, 32, 224, chars) <= 0) { free(bitmap); return NULL; }
    float ascent, descent, linegap;
    stbtt_GetScaledFontVMetrics((const unsigned char*)file_data, 0, (float)-font_size, &ascent, &descent, &linegap);
    golf_font_png_t png = {0};
    int ok = stbi_write_png_to_func(golf_font_png_write, &png, img_size, img_size, 1, bitmap, img_size);
    free(bitmap);
    if (!ok || png.failed) { free(png.data); return NULL; }
    const char *alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    char *encoded = malloc(4 * ((png.size + 2) / 3) + 1);
    if (!encoded) { free(png.data); return NULL; }
    size_t out = 0;
    for (size_t i = 0; i < png.size; i += 3) {
        unsigned a=png.data[i], b=i+1<png.size?png.data[i+1]:0, c=i+2<png.size?png.data[i+2]:0;
        encoded[out++]=alphabet[a>>2]; encoded[out++]=alphabet[((a&3)<<4)|(b>>4)];
        encoded[out++]=i+1<png.size?alphabet[((b&15)<<2)|(c>>6)]:'=';
        encoded[out++]=i+2<png.size?alphabet[c&63]:'=';
    }
    encoded[out]=0; free(png.data);
    JSON_Value *value=json_value_init_object(); JSON_Object *obj=json_value_get_object(value);
    json_object_set_number(obj,"font_size",font_size); json_object_set_number(obj,"img_size",img_size);
    json_object_set_number(obj,"ascent",ascent); json_object_set_number(obj,"descent",descent); json_object_set_number(obj,"linegap",linegap);
    json_object_set_string(obj,"img_data",encoded); free(encoded);
    JSON_Value *data=json_value_init_array(); JSON_Array *array=json_value_get_array(data);
    for(int i=0;i<224;i++) {
        JSON_Value *v=json_value_init_object(); JSON_Object *o=json_value_get_object(v);
        json_object_set_number(o,"c",32+i);
        json_object_set_number(o,"x0",chars[i].x0); json_object_set_number(o,"x1",chars[i].x1);
        json_object_set_number(o,"y0",chars[i].y0); json_object_set_number(o,"y1",chars[i].y1);
        json_object_set_number(o,"xoff",chars[i].xoff); json_object_set_number(o,"yoff",chars[i].yoff);
        json_object_set_number(o,"xadvance",chars[i].xadvance); json_array_append_value(array,v);
    }
    json_object_set_value(obj,"char_datas",data); return value;
}
#endif
