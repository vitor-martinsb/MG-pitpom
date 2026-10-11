#define STB_TRUETYPE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include <stdio.h>
#include "common/font_import.h"
int main(int argc, char **argv) {
    if(argc!=3) return 2;
    FILE *input=fopen(argv[1],"rb"); if(!input) return 1;
    fseek(input,0,SEEK_END); long size=ftell(input); rewind(input);
    if(size<=0) { fclose(input); return 1; }
    char *font=malloc((size_t)size);
    if(!font || fread(font,1,(size_t)size,input)!=(size_t)size) { fclose(input);free(font);return 1; }
    fclose(input);
    int sizes[]={16,24,32,40,48,56,64,128}, images[]={512,512,512,1024,1024,1024,1024,2048};
    JSON_Value *root=json_value_init_object(), *atlases=json_value_init_array();
    for(int i=0;i<8;i++) {
        JSON_Value *atlas=golf_font_atlas_import(font,sizes[i],images[i]);
        if(!atlas) { fprintf(stderr,"Font atlas does not fit: %s, %d\n",argv[1],sizes[i]);free(font);json_value_free(root);json_value_free(atlases);return 1; }
        json_array_append_value(json_value_get_array(atlases),atlas);
    }
    free(font);json_object_set_value(json_value_get_object(root),"atlases",atlases);
    int result=json_serialize_to_file(root,argv[2])==JSONSuccess?0:1;json_value_free(root);return result;
}
