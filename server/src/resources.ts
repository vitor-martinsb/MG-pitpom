// CPU shares are cores (Render Free: 0.1). Unset keeps the local/full profile.
export function cpuBudget():number {
  const value=Number(process.env.GOLF_CPU_BUDGET);
  return Number.isFinite(value)&&value>0&&value<=128?value:0;
}
export function loadingBudget():number{return cpuBudget()>0&&cpuBudget()<.5?120000:0;}
