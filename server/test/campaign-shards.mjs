// A local invocation without --shard still exercises every campaign course.
export function campaignIndices(count,args=process.argv.slice(2)){
  const position=args.indexOf('--shard');
  if(position===-1)return Array.from({length:count},(_,i)=>i);
  const match=/^([1-9]\d*)\/([1-9]\d*)$/.exec(args[position+1]??'');
  if(!match)throw new Error('Expected --shard INDEX/TOTAL');
  const [,indexText,totalText]=match,index=Number(indexText),total=Number(totalText);
  if(!Number.isSafeInteger(total)||index>total||total>count)throw new Error('Invalid campaign shard range');
  const start=Math.floor(count*(index-1)/total),end=Math.floor(count*index/total);
  return Array.from({length:end-start},(_,i)=>start+i);
}
