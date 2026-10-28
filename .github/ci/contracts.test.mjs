import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {campaignIndices} from '../../server/test/campaign-shards.mjs';

const suites=JSON.parse(fs.readFileSync(new URL('./browser-suites.json',import.meta.url)));
const workflow=fs.readFileSync(new URL('../workflows/validate.yml',import.meta.url),'utf8');

test('parallel browser groups retain every original validation script',()=>{
  const original=[
    'menu-flicker','menu-alpha','menu-pet-help','menu-motion','living-menu','clean-play',
    'menu-readiness','home-navigation','mascot-art','visual-shaders',
    'course-features','evolution-browser','campaign-browser','juju-browser',
    'wildlife-render','rescue-browser','loading-audio','bot-updates-browser','visual-refresh','lobby-tabs','lobby-webkit'
  ].map(name=>`${name}.mjs`).sort();
  const files=Object.values(suites).flat().map(([file])=>file);
  assert.deepEqual([...new Set(files)].sort(),original);
  for(const file of original.filter(file=>file!=='campaign-browser.mjs')){
    assert.equal(files.filter(value=>value===file).length,1,`${file} must run exactly once`);
  }
  const matrix=/suite: \[([^\]]+)\]/.exec(workflow);
  assert.ok(matrix);
  assert.deepEqual(matrix[1].split(',').map(name=>name.trim()).sort(),Object.keys(suites).sort());
  for(const file of original)assert.ok(fs.existsSync(new URL(`../../server/test/${file}`,import.meta.url)));
});

test('campaign shards cover all 80 maps exactly once and preserve a full local run',()=>{
  const args=Object.values(suites).flat().filter(([file])=>file==='campaign-browser.mjs');
  assert.equal(args.length,4);
  const indices=args.flatMap(([, ...options])=>campaignIndices(80,options));
  assert.deepEqual(indices,campaignIndices(80,[]));
  assert.equal(new Set(indices).size,80);
  for(const [, ...options] of args)assert.equal(campaignIndices(80,options).length,20);
  for(const value of ['0/4','5/4','1/81','1/0','bad','1/4extra']){
    assert.throws(()=>campaignIndices(80,['--shard',value]));
  }
  assert.throws(()=>campaignIndices(80,['--shard']));
});

test('browser image matches the installed Playwright version',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../../server/package-lock.json',import.meta.url)));
  const version=lock.packages['node_modules/@playwright/test'].version;
  assert.ok(workflow.includes(`image: mcr.microsoft.com/playwright:v${version}-noble`));
});

test('deployment requires all parallel checks and standalone Docker retains native tests',()=>{
  assert.match(workflow,/validation-complete:[\s\S]*if: always\(\)[\s\S]*needs: \[checks, builds, native-tests, server-tests, browser-validation, container-smoke\]/);
  assert.ok(!workflow.includes('continue-on-error:'));
  const docker=fs.readFileSync(new URL('../../Dockerfile',import.meta.url),'utf8');
  assert.match(docker,/FROM native-build AS native-checked[\s\S]*ctest --test-dir out\/server-native[\s\S]*ctest --test-dir out\/unit-tests/);
  assert.match(docker,/FROM ci-runtime AS runtime\r?\nCOPY --from=native-checked/);
});
