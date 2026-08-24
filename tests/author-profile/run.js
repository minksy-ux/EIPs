#!/usr/bin/env node
// Unit tests for assets/js/author-profile.js, the parsing/filtering logic
// behind the author profile page (author.html).
//
// Usage: node tests/author-profile/run.js
// Exits non-zero on the first failed assertion.

'use strict';

const assert = require('node:assert');
const path = require('node:path');

const AuthorProfile = require(path.join(__dirname, '..', '..', 'assets', 'js', 'author-profile.js'));

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
  }
}

console.log('handlesIn');
test('extracts a single handle', () => {
  assert.deepStrictEqual(
    AuthorProfile.handlesIn('Vitalik Buterin (@vbuterin)'),
    ['vbuterin']
  );
});

test('extracts multiple handles from a comma-separated author list', () => {
  assert.deepStrictEqual(
    AuthorProfile.handlesIn('Alice (@alice), Bob (@bob-two)'),
    ['alice', 'bob-two']
  );
});

test('lowercases handles', () => {
  assert.deepStrictEqual(AuthorProfile.handlesIn('Someone (@MixedCase)'), ['mixedcase']);
});

test('returns an empty array when there is no GitHub handle', () => {
  assert.deepStrictEqual(AuthorProfile.handlesIn('Alice <alice@example.com>'), []);
});

test('returns an empty array for undefined/null input', () => {
  assert.deepStrictEqual(AuthorProfile.handlesIn(undefined), []);
  assert.deepStrictEqual(AuthorProfile.handlesIn(null), []);
});
console.log();

console.log('eipsForHandle');
const eips = [
  { eip: 1, title: 'One', author: 'Alice (@alice)' },
  { eip: 2, title: 'Two', author: 'Bob (@bob), Alice (@alice)' },
  { eip: 3, title: 'Three', author: 'Carol (@carol)' },
  { eip: 4, title: 'Four (no github handle)', author: 'Dave <dave@example.com>' },
];

test('finds every EIP authored by a given handle', () => {
  const matches = AuthorProfile.eipsForHandle(eips, 'alice');
  assert.deepStrictEqual(matches.map((p) => p.eip), [1, 2]);
});

test('is case-insensitive and tolerates a leading @', () => {
  assert.deepStrictEqual(
    AuthorProfile.eipsForHandle(eips, '@Alice').map((p) => p.eip),
    [1, 2]
  );
});

test('returns an empty array for an unknown handle', () => {
  assert.deepStrictEqual(AuthorProfile.eipsForHandle(eips, 'nobody'), []);
});

test('returns an empty array for an empty/missing handle', () => {
  assert.deepStrictEqual(AuthorProfile.eipsForHandle(eips, ''), []);
  assert.deepStrictEqual(AuthorProfile.eipsForHandle(eips, undefined), []);
});

test('does not throw on EIPs with no github handle in their author field', () => {
  assert.doesNotThrow(() => AuthorProfile.eipsForHandle(eips, 'dave'));
  assert.deepStrictEqual(AuthorProfile.eipsForHandle(eips, 'dave'), []);
});
console.log();

if (failures === 0) {
  console.log('all author-profile tests passed');
} else {
  console.log(`${failures} assertion(s) failed`);
  process.exit(1);
}
