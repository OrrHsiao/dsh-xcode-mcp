#!/usr/bin/env node
/**
 * install-local.sh — swap the hand-written xcrun mcpbridge row in a DSH profile
 * for the `dsh-xcode-mcp` bundle, installing it from this directory.
 *
 * Use this only for a local, pre-publish install. Once the package is on npm,
 * the Plugins page installs it by name and none of this is needed.
 *
 * The script is fail-closed: every mutation is preceded by an exact check, and
 * both profile files are backed up with a timestamp before anything is written.
 *
 *   node install-local.sh              # dry run: print the planned changes
 *   node install-local.sh --apply      # perform them
 *
 * Restart DSH afterwards; the bundle layer is composed at boot.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const APPLY = process.argv.includes('--apply');
const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_NAME = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')).name;

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh');
const PROFILE = process.env.DSH_PROFILE ?? 'desktop';
const DIR = join(DSH_HOME, 'profiles', PROFILE);
const MANIFEST = join(DIR, 'package.json');
const PATCH = join(DIR, 'cordis.patch.yml');

const say = (s) => process.stdout.write(s + '\n');
const plan = [];
const note = (m) => plan.push(m);

if (!existsSync(MANIFEST)) {
  say(`error: no profile manifest at ${MANIFEST}`);
  process.exit(1);
}

/* ---------------------------------------------------------------- manifest */

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const bundles = manifest.dsh?.profile?.bundles ?? [];
const dep = manifest.dependencies?.[PKG_NAME];

note(`profile            ${DIR}`);
note(`package            ${PKG_NAME}  (from ${realpathSync(HERE)})`);
note(`current bundle list ${JSON.stringify(bundles)}`);

const needsDep = dep === undefined;
const needsBundle = !bundles.includes(PKG_NAME);
if (needsDep) note(`  + dependencies.${PKG_NAME} = "file:${realpathSync(HERE)}"`);
if (needsBundle) note(`  + dsh.profile.bundles += "${PKG_NAME}"`);
if (!needsDep && !needsBundle) note('  = already registered; nothing to do in package.json');

/* ------------------------------------------------------- the manual patch */

const patchText = readFileSync(PATCH, 'utf8');
const lines = patchText.split('\n');

/**
 * Find the whole top-level patch entry that inserts the row with this id,
 * plus any comment lines immediately above it. An entry starts at a line
 * matching `- ` at column 0 and runs until the next such line.
 */
function findEntry(id) {
  const starts = [];
  lines.forEach((l, i) => { if (/^- /.test(l)) starts.push(i); });
  for (let n = 0; n < starts.length; n++) {
    const from = starts[n];
    const to = n + 1 < starts.length ? starts[n + 1] : lines.length;
    const body = lines.slice(from, to).join('\n');
    if (!/^-\s*insert:/m.test(lines[from])) continue;
    // only a row inside THIS entry's insert list counts
    if (!new RegExp(`^\\s*-\\s*id:\\s*${id}\\s*$`, 'm').test(body)) continue;
    let head = from;
    while (head > 0 && /^\s*#/.test(lines[head - 1])) head--;
    return { head, from, to };
  }
  return null;
}

const entry = findEntry('mcp-xcode');
if (entry === null) {
  note('  = no hand-written mcp-xcode row found; nothing to remove');
} else {
  const removed = lines.slice(entry.head, entry.to).join('\n');
  note(`  - remove the hand-written mcp-xcode entry (lines ${entry.head + 1}-${entry.to}):`);
  for (const l of removed.split('\n')) note(`      | ${l}`);
}

/* ------------------------------------------------------------------- apply */

say('Planned changes\n' + '='.repeat(64));
for (const l of plan) say(l);
say('='.repeat(64));

if (!APPLY) {
  say('\nDRY RUN — nothing was written. Re-run with --apply to perform these changes.');
  say('Both profile files are backed up first.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
for (const f of [MANIFEST, PATCH]) {
  const bak = `${f}.bak-${stamp}`;
  copyFileSync(f, bak);
  say(`backed up  ${bak}`);
}

if (needsDep || needsBundle) {
  const next = structuredClone(manifest);
  next.dependencies = next.dependencies ?? {};
  if (needsDep) next.dependencies[PKG_NAME] = `file:${realpathSync(HERE)}`;
  if (needsBundle) {
    next.dsh = next.dsh ?? {};
    next.dsh.profile = next.dsh.profile ?? {};
    next.dsh.profile.bundles = [...(next.dsh.profile.bundles ?? []), PKG_NAME];
  }
  writeFileSync(MANIFEST, JSON.stringify(next, null, 2) + '\n');
  say(`wrote      ${MANIFEST}`);
}

if (entry !== null) {
  const next = [...lines.slice(0, entry.head), ...lines.slice(entry.to)];
  // collapse a run of blank lines left behind
  writeFileSync(PATCH, next.join('\n').replace(/\n{3,}/g, '\n\n'));
  say(`wrote      ${PATCH}`);
}

say(`
Next steps
  1. Install the package into the profile:
       dsh plugin --profile ${PROFILE} install
  2. Quit and reopen DSH so the bundle layer is composed.
  3. Confirm the mcp__xcode__* tools are back.

To undo: restore the two .bak-${stamp} files and run step 1 again.
`);
