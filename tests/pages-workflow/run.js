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
assert.equal(build['runs-on'], 'ubuntu-24.04');
assert.equal(deploy['runs-on'], 'ubuntu-24.04');
assert.equal(step('Setup Ruby').with['ruby-version'], '3.3');
assert.equal(step('Checkout EIPs').with.repository, undefined);
assert.equal(step('Checkout EIPs').with.ref, undefined);
assert.equal(step('Checkout EIPs').with['persist-credentials'], false);
assert.equal(step('Checkout EIPs').uses, 'actions/checkout@v7.0.1');
assert.equal(step('Merge Repos').uses, './.github/actions/merge-repos');
assert.equal(step('Install Ruby dependencies').run, 'bundle install --jobs 4 --retry 3');
assert.equal(step('Setup Pages (with PAT)').uses, 'actions/configure-pages@v6');
assert.equal(step('Setup Pages (with PAT)').id, 'pages_pat');
assert.equal(step('Setup Pages (with PAT)').if, "${{ secrets.PAGES_TOKEN != '' }}");
assert.equal(step('Setup Pages (with PAT)').with.enablement, true);
assert.equal(step('Setup Pages (with PAT)').with.token, '${{ secrets.PAGES_TOKEN }}');
assert.equal(step('Setup Pages (fallback)').uses, 'actions/configure-pages@v6');
assert.equal(step('Setup Pages (fallback)').id, 'pages');
assert.equal(step('Setup Pages (fallback)').if, "${{ secrets.PAGES_TOKEN == '' }}");
assert.equal(step('Expose Pages base path from PAT step').if, "${{ steps.pages_pat.outcome == 'success' }}");
assert.equal(step('Expose Pages base path from PAT step').run,
  'echo "PAGES_BASE_PATH=${{ steps.pages_pat.outputs.base_path }}" >> $GITHUB_ENV');
assert.equal(step('Expose Pages base path from fallback step').if, "${{ steps.pages_pat.outcome != 'success' }}");
assert.equal(step('Expose Pages base path from fallback step').run,
  'echo "PAGES_BASE_PATH=${{ steps.pages.outputs.base_path }}" >> $GITHUB_ENV');
assert.ok(build.steps.indexOf(step('Setup Pages (fallback)')) < build.steps.indexOf(step('Build with Jekyll')));
assert.equal(step('Build with Jekyll').run,
  '/usr/bin/time -v bundle exec jekyll build --baseurl "$PAGES_BASE_PATH" --profile --trace --verbose');
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
[[ "$#" == 8 ]]
[[ "$1" == exec && "$2" == jekyll && "$3" == build && "$4" == --baseurl ]]
[[ "$5" == "$PAGES_BASE_PATH" ]]
[[ "$6" == --profile && "$7" == --trace && "$8" == --verbose ]]
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
