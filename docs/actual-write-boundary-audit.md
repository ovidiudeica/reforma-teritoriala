# ACTUAL write-boundary audit — 2026-10-01

Baseline: `15a382b85d1a5baf03b4c414eb81bb023ac1267d` (#140).
Final hardening: #142 (unique required status owners) and #143 (`06a919556291bd6fddd4327b44d595b667a19b60`). #141 was closed as superseded by #143.

## Exact current workflow inventory

| Workflow | Write permission | Trigger | Write destination |
| --- | --- | --- | --- |
| actual-candidate.yml | contents | dispatch / reusable workflow | new `actual/candidate-*`, absent-ref lease |
| actual-promote-candidate.yml | contents | dispatch | exact candidate branch/SHA lease; emits exact protected-PR handoff, while PR creation remains outside GitHub Actions |
| refresh-actual-review-evidence.yml | contents, pull-requests | dispatch | new `actual/review-evidence-*`, absent-ref lease; PR to main |
| import-osm.yml | contents | dispatch / weekly schedule | delegates exclusively to actual-candidate.yml |
| refresh-md-official.yml | contents | dispatch / monthly schedule | delegates exclusively to actual-candidate.yml |
| refresh-ro-official.yml | contents | dispatch / monthly schedule | delegates exclusively to actual-candidate.yml |
| publish-actual-release.yml | contents | dispatch | GitHub Release/tag/assets only; no branch push |
| build-actual-runtime-image.yml | packages | dispatch / push on actual/pin-oci-runtime | GHCR; no repository write |
| verify-persisted-actual-release.yml | none (read-only) | push / PR / dispatch | verification only |
| actual-change-reproducibility-gate.yml | none (read-only) | push / PR / dispatch | proof artifacts/check only |
| actual-release-trust-chain-gate.yml | none (read-only) | push / PR / dispatch | verification only |
| actual-topology-audit.yml | none (read-only) | PR / dispatch | topology artifact only |
| actual-source-freshness.yml | none (read-only) | dispatch / daily schedule | freshness artifact only |

No workflow may push directly to `main`. Source-refresh wrappers delegate to the reusable candidate workflow; the scheduled OSM refresh therefore has the same candidate/review/promotion boundary as manual OSM refresh. The release publisher may create only GitHub release/tag/assets after binding the exact protected-main SHA and required checks. Its SBOM/evidence generation runs in the digest-pinned ACTUAL runtime with network disabled. Pages deployment is managed by GitHub outside these files.

Promotion and evidence refresh open PRs in separate Ubuntu jobs without a
checkout. Those jobs receive only contents:read and pull-requests:write, check
the exact remote branch commit through a read-only `gh api` call, then use
`gh pr create`. The preceding container jobs have no pull-request permission.
This also removes the assumption that the pinned Node container includes gh.

## Changes validated by this follow-up

- Disable checkout credential persistence in the three repository writers and
  the package publisher; use one-command authentication at each exact push.
- Put the promotion token on its push step (the prior patch mistakenly put it
  on the branch-read step). Regression tests inspect the individual step.
- Pass free-form workflow inputs through environment variables, never shell
  interpolation; validate snapshot syntax and explicit confirmation up front.
- Require the candidate build base to equal fetched current main before any
  repository script. Promotion requires one parent equal to current main,
  exactly one candidate commit, the write allowlist and a genuine CHANGE marker.
- Inspect NUL-delimited, non-rename diffs and Git tree modes before repository
  code: candidate publication objects must be regular non-executable blobs.
- Keep exact candidate-SHA promotion lease and absent-ref creation leases.
- Recognize authenticated `git -c ... push` in the static write inventory.
- Use Bash explicitly in container writers and retain packages:read in all
  three callers of the reusable candidate workflow.
- Dynamically test both exact host profiles, unknown profiles, mixed profiles
  and unexpected profile fields. The CPU and network-denial contracts remain.
- Rebind provenance without changing snapshot `actual-5383ff3db7cf3f67` or
  release fingerprint `5383ff3db7cf3f677006ad3e70c706dccc8c208eea84b1689bb645d056e471dc`.


## ACTUAL v1 disposition

For ACTUAL v1, the repository owner/admin is the accepted GitHub administrative trust root. The findings below remain an explicit threat-model boundary, not an unresolved defect in the v1 release: repository-controlled checks cannot independently defend against an administrator who can replace both workflow code and repository admission settings.

The operational branch-protection contract and the future independent-trust-root path are recorded in `docs/actual-v1-trust-boundary.md`. This audit therefore does not claim protection against a hostile repository administrator.

## Adversarial findings outside the accepted v1 trust boundary

**The repository is not an unconditional fail-closed authorization boundary.**
Green checks establish behavior of the checked-in pipeline, not that a hostile
repository writer cannot replace the pipeline.

1. All three required workflows use `pull_request`; their workflow definitions
   and validation scripts are supplied by the proposed change. A malicious PR
   can replace them with successful jobs using the same required check names.
   Pinning the source app to GitHub Actions does not pin the workflow or its code.
   The static regex inventory is a regression guard, not a parser or sandbox for
   arbitrary attacker-authored workflows.
2. Candidate namespace, hashes and two-commit structure are not proof of a
   workflow dispatch or human authorization. A repository writer can construct
   structurally valid candidate/promotion commits and matching JSON markers.
   A trusted verifier must bind authorization to the exact workflow run and
   exact SHA, using evidence that the proposed commit cannot author itself.
3. At audit start main had strict required checks and admin enforcement, with
   force pushes/deletions disabled, but no PR requirement. Therefore passing
   checks alone did not express the intended PR-only admission rule.

Closing (1) and (2) needs enforcement outside PR-controlled repository code:
an organization-enforced required workflow or a separately administered GitHub
App, including exact promotion-run authorization. Moving a job to
`pull_request_target` alone does not make a check name an unforgeable identity.
No untrusted PR should execute with privileged credentials as a workaround.

GitHub documents that required status checks do not identify workflows:
https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules

This audit does not claim an actual semantic promotion was performed. The A/B
proof builds synthetic CHANGE candidates; it does not authorize their release.
