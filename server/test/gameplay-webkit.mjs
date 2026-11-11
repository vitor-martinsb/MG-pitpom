// Exercise the same camera, tutorial and turn flow in Safari's engine.
process.argv.push('--webkit');
await import('./gameplay-improvements.mjs');
