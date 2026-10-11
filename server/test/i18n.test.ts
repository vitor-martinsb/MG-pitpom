import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { errorCode } from '../src/errors.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../../data/locales.json',import.meta.url),'utf8'));
test('complete catalogues preserve parameters and printf formats across languages',()=>{
  const keys=Object.keys(catalog.en).sort();
  for(const language of ['en','pt-BR','es']){
    assert.deepEqual(Object.keys(catalog[language]).sort(),keys);
    for(const key of keys){
      const tokens=(text:string)=>[...text.matchAll(/\{\w+\}|%[ds]/g)].map(match=>match[0]).sort();
      assert.deepEqual(tokens(catalog[language][key]),tokens(catalog.en[key]),language+': '+key);
    }
  }
});
test('all legacy server messages have stable language-independent codes',()=>{
  for(const [key,value] of Object.entries(catalog['pt-BR']))if(key.startsWith('error.'))assert.equal(errorCode(new Error(value as string)),key.slice(6));
  assert.equal(errorCode(new Error('internal detail')),'BAD_REQUEST');
});
test('font atlases contain visible Portuguese and Spanish accented glyphs',()=>{
  const font=JSON.parse(fs.readFileSync(new URL('../../data/font/FiraSans-Bold.ttf.golf_data',import.meta.url),'utf8'));
  for(const atlas of font.atlases)for(const character of 'áéíóúãõçêñ¡ü'){
    const glyph=atlas.char_datas.find((glyph:any)=>glyph.c===character.codePointAt(0));
    assert.ok(glyph&&glyph.x1>glyph.x0&&glyph.y1>glyph.y0&&glyph.xadvance>0,character);
  }
});
