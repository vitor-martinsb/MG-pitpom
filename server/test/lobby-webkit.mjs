// Same real two-client flow, using WebKit's mobile engine in the CI browser image.
process.argv.push('--webkit');
await import('./lobby-tabs.mjs');
