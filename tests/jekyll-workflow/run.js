#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
function workflow(name) {
  return JSON.parse(execFileSync('ruby', [
    '-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.load_file(ARGV[0]))',
    path.join(root, '.github/workflows', name),
  ], { encoding: 'utf8' }));
}

const ci = workflow('ci.yml').jobs.htmlproofer;
const pages = workflow('jekyll.yml').jobs.build;
for (const job of [ci, pages]) {
  const step = (name) => job.steps.find((entry) => entry.name === name);
  const build = step('Build with Jekyll');
  assert.equal(build.run,
    '/usr/bin/time -v bundle exec jekyll build --profile --trace --verbose');
  assert.equal(build.env.JEKYLL_ENV, 'production');
  assert.equal(build.env.JEKYLL_GITHUB_TOKEN, '${{ secrets.GITHUB_TOKEN }}');
  assert.equal(build.if, undefined);
  assert.equal(build['timeout-minutes'], 20);
  assert.ok(job['timeout-minutes'] > build['timeout-minutes']);
  assert.equal(job.permissions.contents, 'read');
  assert.equal(step('Checkout EIPs').with['persist-credentials'], false);
  assert.equal(step('Merge Repos').uses, './.github/actions/merge-repos');
}

const step = (name) => ci.steps.find((entry) => entry.name === name);
assert.equal(step('Setup Ruby').with['bundler-cache'], true);
assert.equal(step('Jekyll Doctor').run, 'bundle exec jekyll doctor');
assert.equal(step('Jekyll Doctor')['timeout-minutes'], 5);
assert.equal(step('HTML Proofer').run,
  `bundle exec htmlproofer --allow-missing-href --disable-external --assume-extension '.html' --log-level=:info --cache='{"timeframe":{"external":"6w"}}' --checks 'Links,Images,Scripts,OpenGraph' --no-check-sri --ignore-empty-alt --no-enforce_https ./_site`);
assert.equal(step('HTML Proofer')['timeout-minutes'], 10);
assert.equal(step('DNS Validator').run, 'bundle exec github-pages health-check');
assert.equal(step('DNS Validator')['timeout-minutes'], 2);
console.log('all Jekyll workflow tests passed');
