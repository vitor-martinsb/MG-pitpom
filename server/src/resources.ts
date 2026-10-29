// CPU shares are cores (Render Free: 0.1). Unset keeps the local/full profile.
export function cpuBudget():number {
  const value=Number(process.env.GOLF_CPU_BUDGET);
  return Number.isFinite(value)&&value>0&&value<=128?value:0;
}
export function loadingBudget():number{return cpuBudget()>0&&cpuBudget()<.5?120000:0;}

// Keep older Render environment values from restoring multi-second searches.
export function plannerEnvironment():NodeJS.ProcessEnv{
  const env={...process.env},cpu=cpuBudget();
  if(cpu>0&&cpu<.5){
    const requested=Number(env.GOLF_BOT_SEARCH_MS);
    env.GOLF_BOT_SEARCH_MS=String(Number.isFinite(requested)&&requested>0?Math.min(requested,20):20);
    if(!env.GOLF_BOT_CPU_FRACTION)env.GOLF_BOT_CPU_FRACTION=String(Math.min(.04,cpu*.4));
  }
  return env;
}
