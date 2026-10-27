import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const suites=JSON.parse(fs.readFileSync(new URL('./browser-suites.json',import.meta.url)));
const suite=process.argv[2];
if(!Object.hasOwn(suites,suite))throw new Error(`Unknown browser suite: ${suite}`);
const server=spawn(process.execPath,['server/dist/index.js'],{cwd:root,env:{...process.env,PORT:'3000'},stdio:'inherit'});
let serverError;
server.on('error',error=>{serverError=error;});
try{
  let healthy=false;
  for(let attempt=0;attempt<60;attempt++){
    if(serverError)throw serverError;
    if(server.exitCode!==null)throw new Error(`Application exited: ${server.exitCode}`);
    try{const response=await fetch('http://localhost:3000/health',{signal:AbortSignal.timeout(1000)});healthy=response.ok;}catch{}
    if(healthy)break;
    await delay(500);
  }
  if(!healthy)throw new Error('Application health check timed out');
  for(const [file,...args] of suites[suite]){
    const start=performance.now();
    console.log(`::group::${suite}: ${file} ${args.join(' ')}`);
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[`test/${file}`,...args],{cwd:path.join(root,'server'),env:process.env,stdio:'inherit'});
      child.on('error',reject);
      child.on('exit',(code,signal)=>code===0?resolve():reject(new Error(`${file}: exit ${code}, signal ${signal}`)));
    });
    console.log(`${file}: ${((performance.now()-start)/1000).toFixed(1)}s\n::endgroup::`);
  }
}finally{
  server.kill();
}
