import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const catalog=JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../data/locales.json',import.meta.url)),'utf8'));
const codes=new Map<string,string>(Object.entries(catalog['pt-BR'] as Record<string,string>)
  .filter(([key])=>key.startsWith('error.')).map(([key,value])=>[value,key.slice(6)]));
/** Preserve legacy messages on the wire; clients localize stable codes. */
export function errorCode(error: unknown): string {
  return error instanceof Error?codes.get(error.message)??'BAD_REQUEST':'BAD_REQUEST';
}
