import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function clock(){const context=vm.createContext({Intl,Date});vm.runInContext(fs.readFileSync('../build/emscripten/menu-clock.js','utf8'),context);return context.GolfMenuClock;}
test('Brasilia periods and exact boundaries are independent of the process timezone',()=>{
  const c=clock(),before=process.env.TZ;
  try{for(const zone of ['UTC','Pacific/Auckland','America/Los_Angeles']){
    process.env.TZ=zone;
    for(const [local,expected]of [['05:59:59','night'],['06:00:00','morning'],['11:59:59','morning'],['12:00:00','afternoon'],['17:59:59','afternoon'],['18:00:00','sunset'],['18:59:59','sunset'],['19:00:00','night'],['23:59:59','night'],['00:00:00','night']]){
      const s=c.sample(new Date(`2026-10-23T${local}-03:00`));assert.equal(s.period,expected);assert.equal(s.timeZone,'America/Sao_Paulo');assert.ok(Math.abs(Object.values(s.weights).reduce((a:number,b)=>a+Number(b),0)-1)<1e-9);
    }
  }}finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});
test('all four lighting boundaries blend continuously and reach the new palette after twelve minutes',()=>{
  const c=clock();for(const hour of [6,12,18,19]){
    const date=new Date(`2026-10-23T${String(hour).padStart(2,'0')}:00:00-03:00`),a=c.sample(new Date(+date-1000)),b=c.sample(date),middle=c.sample(new Date(+date+360000)),end=c.sample(new Date(+date+720000));
    for(const key of ['morning','afternoon','sunset','night'])assert.ok(Math.abs(a.weights[key]-b.weights[key])<.0001);
    assert.equal(middle.weights[b.period],.5);assert.equal(end.weights[b.period],1);
  }
  assert.equal(c.sample(new Date('2026-10-24T03:00:00Z')).weights.night,1);
});
