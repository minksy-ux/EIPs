# Ethereum Improvement Proposals (EIPs)

> **_ATTENTION_**: The EIPs repository has recently [undergone](https://github.com/ethereum/EIPs/pull/7206) a separation of ERCs and EIPs. ERCs are now accessible at [https://github.com/ethereum/ercs](https://github.com/ethereum/ercs). All new ERCs and updates to existing ones must be directed at this new repository. The editors apologize for this inconvenience.

The goal of the EIP project is to standardize and provide high-quality documentation for Ethereum itself and conventions built upon it. This repository tracks past and ongoing improvements to Ethereum in the form of Ethereum Improvement Proposals (EIPs). [EIP-1](https://eips.ethereum.org/EIPS/eip-1) governs how EIPs are published.

The [status page](https://eips.ethereum.org/) tracks and lists EIPs, which can be divided into the following categories:

- [Core EIPs](https://eips.ethereum.org/core) are improvements to the Ethereum consensus protocol.
- [Networking EIPs](https://eips.ethereum.org/networking) specify the peer-to-peer networking layer of Ethereum.
- [Interface EIPs](https://eips.ethereum.org/interface) standardize interfaces to Ethereum, which determine how users and applications interact with the blockchain.
- [ERCs](https://eips.ethereum.org/erc) specify application layer standards, which determine how applications running on Ethereum can interact with each other.
- [Meta EIPs](https://eips.ethereum.org/meta) are miscellaneous improvements that nonetheless require some sort of consensus.
- [Informational EIPs](https://eips.ethereum.org/informational) are non-standard improvements that do not require any form of consensus.

**Before you write an EIP, ideas MUST be thoroughly discussed on [Ethereum Magicians](https://ethereum-magicians.org/) or [Ethereum Research](https://ethresear.ch/t/read-this-before-posting/8). Once consensus is reached, thoroughly read and review [EIP-1](https://eips.ethereum.org/EIPS/eip-1), which describes the EIP process.**

Please note that this repository is for documenting standards and not for help implementing them. These types of inquiries should be directed to the [Ethereum Stack Exchange](https://ethereum.stackexchange.com). For specific questions and concerns regarding EIPs, it's best to comment on the relevant discussion thread of the EIP denoted by the `discussions-to` tag in the EIP's preamble.

If you would like to become an EIP Editor, please read [EIP-5069](./EIPS/eip-5069.md).

## Preferred Citation Format

The canonical URL for an EIP that has achieved draft status at any point is at <https://eips.ethereum.org/>. For example, the canonical URL for EIP-1 is <https://eips.ethereum.org/EIPS/eip-1>.

Consider any document not published at <https://eips.ethereum.org/> as a working paper. Additionally, consider published EIPs with a status of "draft", "review", or "last call" to be incomplete drafts, and note that their specification is likely to be subject to change.

## Validation and Automerging

All pull requests in this repository must pass automated checks before they can be automatically merged:

- [eip-review-bot](https://github.com/ethereum/eip-review-bot/) determines when PRs can be automatically merged [^1]
- EIP-1 rules are enforced using [`eipw`](https://github.com/ethereum/eipw)[^2]
- HTML formatting and broken links are enforced using [HTMLProofer](https://github.com/gjtorikian/html-proofer)[^2]
- Spelling is enforced with [CodeSpell](https://github.com/codespell-project/codespell)[^2]
  - False positives sometimes occur. When this happens, please submit a PR editing [.codespell-whitelist](https://github.com/ethereum/EIPs/blob/master/config/.codespell-whitelist) and **ONLY** .codespell-whitelist
- Markdown best practices are checked using [markdownlint](https://github.com/DavidAnson/markdownlint)[^2]

[^1]: https://github.com/ethereum/EIPs/blob/master/.github/workflows/auto-review-bot.yml
[^2]: https://github.com/ethereum/EIPs/blob/master/.github/workflows/ci.yml

It is possible to run the EIP validator locally:

Make sure to add cargo's `bin` directory to your environment (typically `$HOME/.cargo/bin` in your `PATH` environment variable)

```sh
cargo install eipw
eipw --config ./config/eipw.toml <INPUT FILE / DIRECTORY>
```

## Build the status page locally

### Pages workflow validation

The Pages workflow builds the triggering repository and commit, including its local
merge action. Pushes to `master` and manual runs validate fork builds; scheduled
runs, artifact uploads, and deployment are restricted to `ethereum/EIPs`.
Build jobs have read-only permissions; Pages and OIDC write permissions are limited
to the deployment job.

Run the workflow regression checks with Node.js and Ruby (standard libraries only):

```sh
node tests/pages-workflow/run.js
```

These checks cover checkout, runner selection, triggers, deployment guards,
permissions, and Pages API success, unavailable-site, and network-error responses.
A successful fork build is not a successful deployment. Enabling Pages in a fork
would require explicit repository setup and a separately reviewed deployment policy
change; enabling Pages alone does not bypass the upstream-only guards.

### Production build diagnostics

CI and Pages perform full production builds after merging ERCs. Both run
`/usr/bin/time -v bundle exec jekyll build --profile --trace --verbose`:
verbose output identifies the file being rendered, the final profile ranks
Liquid templates, and process timing reports elapsed time and peak memory.
Pages also retains `--baseurl "$PAGES_BASE_PATH"` from its configuration step.
Build steps time out after 20 minutes; CI also bounds doctor, HTMLProofer, and
DNS validation separately. A timeout is a failed check, not a skipped validation.
To reproduce, use the same merged inputs with `JEKYLL_ENV=production`.

The apparently stalled [CI job](https://github.com/minksy-ux/EIPs/actions/runs/39728601462/job/119661941012)
actually succeeded: Jekyll took 508.76 seconds, HTMLProofer took 158.04 seconds,
and the domain health check passed. The feed message was normal progress before
rendering, not an exception; disabled incremental building is intentional.

The header's repeated full-page navigation scans were the confirmed bottleneck.
Only this page-independent fragment is cached using the already-locked
`jekyll-include-cache` plugin. Its in-memory cache is cleared at `site:pre_render`,
including rebuilds; nothing is shared between workflow runs or PRs. Keep
`_includes/header-cached.html` independent of the current page. Page-specific
content, metadata, Markdown processing, feeds, and validation are not cached or
disabled.

One local before/after comparison used the same merged corpus (1,198 proposals),
locked dependencies, Ruby 3.2.11, Jekyll 3.9.3, production mode, profiling enabled,
and clean destinations without incremental output:

| Measurement | Before | After |
| --- | ---: | ---: |
| Full Jekyll build | 363.457 s | 41.125 s |
| Header Liquid rendering | 319.800 s | 0.277 s |
| Navigation fragment renders | 1,308 | 1 |

This was about 89% less build time locally, not a promised CI runtime. All 1,314
generated HTML files were byte-identical; the only output differences were build
timestamps in seven feeds. The sandbox blocked the GitHub metadata API, so both
local builds used an empty base URL and injected
`site.github.repository_url = https://github.com/ethereum/EIPs` after plugin
initialization, without disabling plugins or changing repository configuration.
Authenticated metadata behavior was not revalidated locally. Doctor and the
unchanged HTMLProofer command passed (1,314 files and 11,428 internal links;
HTMLProofer took 108.47 seconds locally, not a separate optimization).
The domain health-check executable could not run on local Ruby 3.2 because
github-pages 228 uses `File.exists?`. CI retains Ruby 3.1 and its health check.

Run the rendering and diagnostic-workflow regressions with the locked bundle,
Node.js, and Ruby:

```sh
bundle exec ruby tests/jekyll/run.rb
node tests/jekyll-workflow/run.js
```

### Install prerequisites

1. Open Terminal.

2. Check whether you have Ruby 3.1.4 installed. Later [versions are not supported](https://stackoverflow.com/questions/14351272/undefined-method-exists-for-fileclass-nomethoderror).

   ```sh
   ruby --version
   ```

3. If you don't have Ruby installed, install Ruby 3.1.4.

4. Install Bundler:

   ```sh
   gem install bundler
   ```

5. Install dependencies:

   ```sh
   bundle install
   ```

### Build your local Jekyll site

1. Bundle assets and start the server:

   ```sh
   bundle exec jekyll serve
   ```

2. Preview your local Jekyll site in your web browser at `http://localhost:4000`.

More information on Jekyll and GitHub Pages [here](https://docs.github.com/en/enterprise/2.14/user/articles/setting-up-your-github-pages-site-locally-with-jekyll).
