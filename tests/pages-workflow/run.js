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
const upstream = "github.repository == 'ethereum/EIPs'";
// Ruby's YAML 1.1 parser treats the unquoted GitHub Actions "on" key as true.
const triggers = workflow.on || workflow.true;

assert.deepEqual(triggers.push.branches, ['master']);
assert.ok(Object.hasOwn(triggers, 'workflow_dispatch'));
assert.equal(triggers.schedule[0].cron, '*/15 * * * *');
assert.equal(build.if, `github.event_name != 'schedule' || ${upstream}`);
assert.equal(build['runs-on'], 'ubuntu-22.04');
assert.equal(step('Setup Ruby').with['ruby-version'], '3.1');
assert.equal(step('Checkout EIPs').with.repository, undefined);
assert.equal(step('Checkout EIPs').with.ref, undefined);
assert.equal(step('Checkout EIPs').with['persist-credentials'], false);
assert.equal(step('Merge Repos').uses, './.github/actions/merge-repos');
assert.equal(step('Install Ruby dependencies').run, 'bundle install --jobs 4 --retry 3');
assert.equal(step('Build with Jekyll').run, 'bundle exec jekyll build');
assert.equal(step('Build with Jekyll').if, undefined);
assert.deepEqual(workflow.permissions, { contents: 'read' });
assert.deepEqual(build.permissions, { contents: 'read', pages: 'read' });
assert.deepEqual(deploy.permissions, { pages: 'write', 'id-token': 'write' });
assert.equal(step('Check Pages site availability').if, upstream);
assert.equal(step('Upload artifact').if,
  `${upstream} && steps.pages-check.outputs.enabled == 'true'`);
assert.equal(deploy.if,
  `${upstream} && needs.build.outputs.pages_enabled == 'true' && needs.build.outputs.artifact_uploaded == 'true'`);
assert.equal(deploy.needs, 'build');

// Exercise the actual Pages check without network access or real credentials.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-workflow-'));
try {
  fs.writeFileSync(path.join(temporary, 'curl'), `#!/usr/bin/env bash
set -eu
[[ "$*" == *"$GH_TOKEN"* ]]
printf '%s' "$TEST_HTTP_STATUS"
exit "$TEST_CURL_EXIT"
`, { mode: 0o755 });
  const script = step('Check Pages site availability').run.replace(
    '${{ github.repository }}', 'ethereum/EIPs');
  for (const [status, exit, enabled] of [
    ['200', '0', 'true'],
    ['404', '0', 'false'],
    ['403', '0', 'false'],
    ['000', '7', 'false'],
    ['200', '7', 'false'],
  ]) {
    const output = path.join(temporary, 'output');
    fs.writeFileSync(output, '');
    execFileSync('bash', ['-e', '-c', script], {
      env: {
        ...process.env,
        PATH: `${temporary}:${process.env.PATH}`,
        GH_TOKEN: 'test-token',
        GITHUB_OUTPUT: output,
        TEST_HTTP_STATUS: status,
        TEST_CURL_EXIT: exit,
      },
    });
    assert.equal(fs.readFileSync(output, 'utf8'), `enabled=${enabled}\n`);
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('all Pages workflow tests passed');
