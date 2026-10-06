#!/usr/bin/env bash
set -euo pipefail

: "${ACTUAL_BASE_REF:?ACTUAL_BASE_REF is required}"
: "${ACTUAL_NETWORK_MODE:?ACTUAL_NETWORK_MODE is required}"
: "${NODE_OPTIONS:?NODE_OPTIONS is required}"
: "${UV_THREADPOOL_SIZE:?UV_THREADPOOL_SIZE is required}"
: "${TZ:?TZ is required}"
: "${LANG:?LANG is required}"
: "${LC_ALL:?LC_ALL is required}"

test "$NODE_OPTIONS" = "--jitless"
test "$UV_THREADPOOL_SIZE" = "1"
test "$TZ" = "UTC"
test "$LANG" = "C.UTF-8"
test "$LC_ALL" = "C.UTF-8"

mkdir -p "${HOME:-/tmp/actual-home}"
git config --global --add safe.directory /workspace

npm run prove:actual-network-denial
npm run build:actual-runtime-image-manifest
npm run audit:actual-runtime-image
npm run audit:actual-npm-dependency-bundle
npm run build:actual-build-environment
npm run audit:actual-build-environment
npm run audit:node-toolchain
npm run install:actual-offline-deps

npm run build:actual-source-bundle
npm run audit:actual-source-bundle
npm run audit:actual-statistical-contract
npm run build:actual-review-evidence-bundle
npm run audit:actual-review-evidence-bundle

npm run build:osm-actual
npm run audit:actual-topology
npm run audit:ro-official-reconciliation
npm run audit:ro-county-siruta-bridge
npm run apply:ro-official-reconciliation
npm run audit:admin
node scripts/process/audit-cuatm-consistency.mjs
npm run audit:cuatm-chains
npm run audit:balti-geometry
npm run audit:balti-components
npm run audit:md-special-municipalities
npm run reconcile:cuatm
npm run audit:md-cuatm-semantic-bridge
npm run apply:md-reviewed-reconciliation
npm run audit:md-release-gate
npm run audit:ro-release-gate
npm run build:actual-public-data
npm run audit:md-chisinau-sectors
npm run audit:actual-structural-completeness
npm run audit:actual-official-identity
npm run audit:actual-regression
npm run stabilize:actual-bytes
npm run build:actual-release-manifest
npm run audit:actual-release-gate
npm run build:actual-candidate-diff
