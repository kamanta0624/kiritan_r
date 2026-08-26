#!/usr/bin/env node
'use strict';

const path = require('path');
const { execFileSync } = require('child_process');

let chokidar;
try {
  chokidar = require('chokidar');
} catch {
  process.stderr.write('chokidar not installed. Run: npm install --save-dev chokidar\n');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const WIKI = path.join(ROOT, 'docs/wiki');
const BUILD_SCRIPT = path.join(__dirname, 'wiki_build.cjs');

let building = false;
let pendingBuild = false;
let debounceTimer = null;

function runBuild() {
  if (building) {
    pendingBuild = true;
    return;
  }
  building = true;
  console.log(`[${new Date().toISOString()}] wiki_watch: build start`);
  try {
    execFileSync('node', [BUILD_SCRIPT], { stdio: 'inherit', cwd: ROOT });
    console.log(`[${new Date().toISOString()}] wiki_watch: build done`);
  } catch (e) {
    console.error(`[${new Date().toISOString()}] wiki_watch: build failed (exit ${e.status})`);
  }
  building = false;
  if (pendingBuild) {
    pendingBuild = false;
    scheduleBuild();
  }
}

function scheduleBuild() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runBuild, 500);
}

const watcher = chokidar.watch(WIKI, {
  ignored: [/(^|[/\\])archive[/\\]/, /(^|[/\\])\./],
  persistent: true,
  ignoreInitial: true,
});

watcher
  .on('add', p => { if (p.endsWith('.md')) { console.log(`  + ${path.relative(ROOT, p)}`); scheduleBuild(); } })
  .on('change', p => { if (p.endsWith('.md')) { console.log(`  ~ ${path.relative(ROOT, p)}`); scheduleBuild(); } })
  .on('unlink', p => { if (p.endsWith('.md')) { console.log(`  - ${path.relative(ROOT, p)}`); scheduleBuild(); } })
  .on('ready', () => {
    console.log('wiki_watch: watching docs/wiki/**/*.md (Ctrl+C to stop)');
    runBuild();
  });

process.on('SIGINT', () => {
  console.log('\nwiki_watch: stopping');
  watcher.close();
  process.exit(0);
});
