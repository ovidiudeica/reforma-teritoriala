#!/usr/bin/env node
import {validateNpmDependencyBundle} from '../lib/actual-npm-dependency-bundle.mjs';

const validation=await validateNpmDependencyBundle();
const report={
 schema_version:1,
 mode:'ACTUAL_NPM_DEPENDENCY_BUNDLE_GATE',
 status:validation.status,
 policy:'Fail closed unless every package locked by package-lock.json is present in the committed canonical TAR bundle with exact lockfile facts, SHA-256 bytes and npm integrity.',
 checks:validation.checks,
 failures:validation.failures,
 bundle_fingerprint_sha256:validation.manifest?.bundle_fingerprint_sha256??null,
 archive_sha256:validation.archive_sha256??null,
 manifest_sha256:validation.manifest_sha256??null
};
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exit(1);
