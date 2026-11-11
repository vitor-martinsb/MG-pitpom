// Same seasonal flow using Safari's engine in the CI browser image.
process.argv.push('--webkit');
await import('./seasonal.mjs');
