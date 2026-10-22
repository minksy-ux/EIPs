#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const workflow = JSON.parse(execFileSync('ruby', [
  '-ryaml', '-rjson', '-e',
  'puts JSON.generate(YAML.load_file(ARGV[0]))',
  path.join(root, '.github/workflows/jekyll.yml'),
], { encoding: 'utf8' }));
const { build, deploy } = workflow.jobs;
const step = (name) => build.steps.find((entry) => entry.name === name);
// Ruby's YAML 1.1 parser treats the unquoted GitHub Actions "on" key as true.
const triggers = workflow.on || workflow.true;

assert.deepEqual(triggers.push.branches, ['master']);
assert.ok(Object.hasOwn(triggers, 'workflow_dispatch'));
assert.equal(triggers.schedule, undefined);
assert.equal(build.if, undefined);
assert.deepEqual(workflow.concurrency, { group: 'pages', 'cancel-in-progress': false });
assert.equal(build['runs-on'], 'ubuntu-22.04');
assert.equal(step('Setup Ruby').with['ruby-version'], '3.1.7');
assert.equal(step('Checkout EIPs').with.repository, undefined);
assert.equal(step('Checkout EIPs').with.ref, undefined);
assert.equal(step('Checkout EIPs').with['persist-credentials'], false);
assert.equal(step('Checkout EIPs').uses, 'actions/checkout@v7.0.1');
assert.equal(step('Merge Repos').uses, './.github/actions/merge-repos');
assert.equal(step('Install Ruby dependencies').run, 'bundle install --jobs 4 --retry 3');
assert.equal(step('Setup Pages').uses, 'actions/configure-pages@v6');
assert.equal(step('Setup Pages').id, 'pages');
assert.equal(step('Setup Pages').if, undefined);
assert.ok(build.steps.indexOf(step('Setup Pages')) < build.steps.indexOf(step('Build with Jekyll')));
assert.equal(step('Build with Jekyll').run, 'bundle exec jekyll build --baseurl "$PAGES_BASE_PATH"');
assert.equal(step('Build with Jekyll').env.PAGES_BASE_PATH, '${{ steps.pages.outputs.base_path }}');
assert.equal(step('Build with Jekyll').env.JEKYLL_ENV, 'production');
assert.equal(step('Build with Jekyll').if, undefined);
assert.deepEqual(workflow.permissions, { contents: 'read' });
assert.deepEqual(build.permissions, { contents: 'read', pages: 'read' });
assert.deepEqual(deploy.permissions, { pages: 'write', 'id-token': 'write' });
assert.equal(step('Upload artifact').if, undefined);
assert.equal(step('Upload artifact').uses, 'actions/upload-pages-artifact@v5');
assert.equal(step('Upload artifact').with.path, './_site');
assert.equal(deploy.if, undefined);
assert.equal(deploy.needs, 'build');
assert.equal(deploy.environment.name, 'github-pages');
assert.equal(deploy.environment.url, '${{ steps.deployment.outputs.page_url }}');
assert.equal(deploy.steps[0].id, 'deployment');
assert.equal(deploy.steps[0].uses, 'actions/deploy-pages@v5');

// Check base-path arguments for both project sites and custom domains.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-workflow-'));
try {
  fs.writeFileSync(path.join(temporary, 'bundle'), `#!/usr/bin/env bash
set -eu
[[ "$#" == 5 ]]
[[ "$1" == exec && "$2" == jekyll && "$3" == build && "$4" == --baseurl ]]
[[ "$5" == "$PAGES_BASE_PATH" ]]
`, { mode: 0o755 });
  for (const basePath of ['/EIPs', '']) {
    execFileSync('bash', ['-e', '-c', step('Build with Jekyll').run], {
      env: {
        ...process.env,
        PATH: `${temporary}:${process.env.PATH}`,
        PAGES_BASE_PATH: basePath,
      },
    });
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('all Pages workflow tests passed');
