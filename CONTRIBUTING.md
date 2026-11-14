# Contributing to Gistry

Thanks for helping out! Setup takes about a minute.

## Develop

Requirements: Node 24 (`nvm use` reads `.nvmrc`) and Git.

```sh
npm install
```

Then press **F5** in VS Code or Cursor. This starts `tsc --watch` and opens an **Extension Development Host** with Gistry loaded. Open any Git repository in that window. After editing `src/`, run **Developer: Reload Window** in the host. After editing `media/` (the webview), close and reopen the Gistry view.

| Script              | What it does                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run watch`     | Compile `src/` → `out/` on change (F5 runs this for you).                                                         |
| `npm run lint`      | Biome lint + format check (what CI runs).                                                                         |
| `npm run fix`       | Apply Biome's formatting and safe lint fixes.                                                                     |
| `npm run typecheck` | TypeScript, no emit.                                                                                              |
| `npm test`          | Compile, then run unit tests (Node test runner) and integration tests (a real VS Code instance).                  |
| `npm run test:unit` | Just the fast unit tests in `src/test/unit` (run `npm run compile` first).                                        |
| `npm run check`     | Lint + typecheck + all tests. Run it before opening a PR.                                                         |
| `npm run package`   | Build `gistry-<version>.vsix` to install locally with `code --install-extension` or `cursor --install-extension`. |

Keep `git.ts` and `stacks.ts` free of `vscode` imports so they stay unit-testable.

## Commits and pull requests

`main` only takes **rebase-merged PRs**, so **every commit lands on `main` as it is** and each one can become its own changelog entry. Keep commits focused (one change each) and write their messages as [Conventional Commits](https://www.conventionalcommits.org). A CI check enforces this on every commit in a PR.

| Message                                                      | Effect on the next release                         |
| ------------------------------------------------------------ | -------------------------------------------------- |
| `feat: show tags in the legend`                              | minor bump, listed under **Features**              |
| `fix(graph): misaligned merge curve`                         | patch bump, listed under **Bug Fixes**             |
| `perf: …`                                                    | patch bump, listed under **Performance**           |
| `feat!: …` or a `BREAKING CHANGE:` footer                    | major bump (minor while we're on 0.x)              |
| `docs:` `refactor:` `test:` `build:` `ci:` `chore:` `style:` | no release on their own, hidden from the changelog |

Write the subject line for users, because it shows up word for word in the changelog and on the Marketplace. Tidy up fixup commits with `git rebase -i` before merging.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please). **Never edit the version in `package.json` or `CHANGELOG.md` by hand.**

1. As PRs merge, release-please keeps a **`chore: release vX.Y.Z`** PR open. It contains the version bump and the generated changelog.
2. When you want to ship, merge that PR.
3. The [Release workflow](.github/workflows/release.yml) then does the following:
   - tags `vX.Y.Z` and creates the GitHub release
   - builds the VSIX **once**, attaches it to the release, and signs a build-provenance attestation
   - publishes that same file to the **VS Code Marketplace** and **Open VSX** in parallel, using OIDC trusted publishing with no stored tokens

If one marketplace fails, open the workflow run and click **Re-run failed jobs**. Publishing uses `--skip-duplicate`, so re-runs are safe.

To force a specific version (for example `1.0.0` for the launch), add a `Release-As: 1.0.0` footer to a commit, or push an empty commit:

```sh
git commit --allow-empty -m "chore: release 1.0.0" -m "Release-As: 1.0.0"
```

> GitHub doesn't trigger workflows for PRs opened with the default `GITHUB_TOKEN`, so CI doesn't run on the release PR, and the `main` ruleset lets admins merge it anyway. To get CI on release PRs, add a fine-grained PAT with _Contents_ and _Pull requests_ read/write as the `RELEASE_PLEASE_TOKEN` repository secret.

### First release (one-time setup)

1. **Create the GitHub repo and push.** Then configure it in **Settings**:
   1. **General → Pull Requests:** allow rebase merging only. release-please reads each conventional commit from `main`, so squash merging (which collapses them) and merge commits must be off.
   2. **Actions → General → Workflow permissions:** keep the default `GITHUB_TOKEN` read-only and tick _Allow GitHub Actions to create and approve pull requests_, so release-please can open the release PR.
   3. **Environments:** create `release` and limit deployments to the `main` branch. `release.yml` deploys to it, and the trusted-publisher policies below refer to it by name.
   4. _Recommended:_ add a branch ruleset for `main` that requires a pull request, allows only rebase merges, blocks force-pushes and deletion, and requires the CI checks (`Lint, typecheck & package`, the three `Test (…)` jobs and `Conventional commits`). Under **Advanced Security**, turn on private vulnerability reporting, Dependabot alerts and Dependabot security updates.
2. **VS Code Marketplace.** Sign in at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) and create the publisher `gistry`. It must match `publisher` in `package.json`. Then add a **Trusted Publishing** policy with:
   - Repository owner: `levijubb`
   - Repository: `gistry`
   - Workflow: `release.yml`
   - Environment: `release`

   No PAT is needed. (Azure DevOps global PATs stop working on **1 Dec 2026**.)

3. **Open VSX** (this is what Cursor, VSCodium and Windsurf install from):
   1. Sign in at [open-vsx.org](https://open-vsx.org) with GitHub and sign the Eclipse publisher agreement.
   2. Create an access token, then run `npx ovsx create-namespace gistry -p <token>`.
   3. Store the token for the first publish: `gh secret set OVSX_PAT --env release`.
   4. After the first release is live, add a **Trusted Publisher** for the extension on Open VSX (workflow `release.yml`, environment `release`). Then delete the secret with `gh secret delete OVSX_PAT --env release`. The workflow switches to OIDC automatically once the secret is gone.
4. Merge the release PR. 🚀
