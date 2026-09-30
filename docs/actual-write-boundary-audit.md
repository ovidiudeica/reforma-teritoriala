# ACTUAL write-boundary audit — 2026-09-30

Baseline: `15a382b85d1a5baf03b4c414eb81bb023ac1267d` (#140).
Follow-up: #141 (`actual/provenance-write-credential-hardening`).

## Exact current workflow inventory

| Workflow | Write permission | Trigger | Write destination |
| --- | --- | --- | --- |
| actual-candidate.yml | contents | dispatch / reusable workflow | new `actual/candidate-*`, absent-ref lease |
| actual-promote-candidate.yml | contents, pull-requests | dispatch | exact candidate branch/SHA lease; promotion PR to main |
| refresh-actual-review-evidence.yml | contents, pull-requests | dispatch | new `actual/review-evidence-*`, absent-ref lease; PR to main |
| import-osm.yml | contents | dispatch | delegates exclusively to actual-candidate.yml |
| refresh-md-official.yml | contents | dispatch / schedule | delegates exclusively to actual-candidate.yml |
| refresh-ro-official.yml | contents | dispatch / schedule | delegates exclusively to actual-candidate.yml |
| build-actual-runtime-image.yml | packages | dispatch / push on actual/pin-oci-runtime | GHCR; no repository write |

The other four workflows are read-only: persisted verification, CHANGE
reproducibility, release trust chain and topology audit. No workflow uses a
GitHub REST mutation, `github-script`, generic force push or direct main push.
The runtime publisher's curl downloads the pinned Buildx binary; it is not
a GitHub API write. Pages deployment is managed by GitHub outside these files.

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
- Dynamically test both exact host profiles, unknown profiles, mixed profiles
  and unexpected profile fields. The CPU and network-denial contracts remain.
- Rebind provenance without changing snapshot `actual-5383ff3db7cf3f67` or
  release fingerprint `5383ff3db7cf3f677006ad3e70c706dccc8c208eea84b1689bb645d056e471dc`.

## Adversarial findings still requiring an independent trust root

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
