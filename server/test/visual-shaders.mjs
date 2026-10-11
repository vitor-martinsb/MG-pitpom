import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : process.env.CI ? {} : {channel:'chrome'}),
  headless:true,args:['--enable-unsafe-swiftshader']
});
try {
  const page = await browser.newPage();
  for (const name of ['environment_material','ball','ui','aim_line','garden']) {
    const {gles300:stages} = JSON.parse(fs.readFileSync(`../data/shaders/${name}.glsl.golf_data`,'utf8'));
    const errors = await page.evaluate(stages => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return ['WebGL2 unavailable'];
      const errors=[],program=gl.createProgram();
      for (const [stage,type] of [['vs',gl.VERTEX_SHADER],['fs',gl.FRAGMENT_SHADER]]) {
        const shader=gl.createShader(type);
        gl.shaderSource(shader,stages[stage].source);gl.compileShader(shader);
        if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) errors.push(gl.getShaderInfoLog(shader));
        gl.attachShader(program,shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) errors.push(gl.getProgramInfoLog(program));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return errors;
    },stages);
    assert.deepEqual(errors,[],`${name}: real GLES shader compilation and linking`);
  }
  console.log('All five visual shaders compile and link in WebGL2.');
} finally {await browser.close();}
