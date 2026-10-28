// Injection order for the engine modules (used by background.js and the tests).
// Kept as a plain array so it works both as an ES module export and via importScripts.
self.ENGINE_FILES = [
  'engine/dom.js',
  'engine/page.js',
  'engine/fields.js',
  'engine/sections.js',
  'engine/index.js',
];
