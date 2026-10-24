# Independent native history ordering validation

The already authenticated 163,893,678,040-byte original was read once by osmium 1.19.1 / libosmium 2.23.1. The complete scan exited successfully after 3,406 seconds, reported objects_ordered=true and retained the original source size, history header and base epoch 2026-10-19T00:00:04Z. No original download or hash rerun occurred.

The native checker and five selected dependency DLLs were acquired from official conda-forge packages with verified SHA-256 values, isolated under the workspace, and tested with ordered and unordered synthetic histories. Software receipts and license metadata are included; executable packages and large source originals are not uploaded. The public stdout presentation changes only file.name to its basename; the original private stdout remains unchanged and hash-verified.

A pure evidence validator and 15 negative/determinism fixtures enforce the separation between global ordering and source acceptance. Wrong size, epoch, exit status, digest bindings, missing counts, changed source state and attempted self-approval fail closed. The historical claim that sorting was not yet independently verified remains intact in older evidence; this new proof supplies the later technical observation for the same frozen original.

Human or signed validation of source provenance remains pending. The 107 observed historical gaps, 242 formal UNKNOWN, way/node closure, geometry/topology, Overpass generated-area equivalence and source freshness are separate gates. No ACTUAL mutation, published geometry change, legal attribution, public OSM edit or P9.1 authorization occurs.

Native recursive getid-H-r has been started separately for 251,088 frontier IDs after confirming the previous reader exited. This PR does not claim that capture is complete. Tests demonstrate that historical getid may exit 0 for an absent ID, so independent enumeration, missing-ID accounting and target-epoch replay remain mandatory.
