# RT-ADM — închidere probatorie limitată și handoff P9.1a (2026-11-01)

## Domeniu și verdict

**Dosarele RT-ADM sunt închise la nivel de triere și decizie probatorie individuală, nu la nivel de certificare juridică a limitelor.** Sunt 14 cazuri unice: 3 MD, 5 localități RO, 6 sectoare București. Pentru toate 14, decizia este **NO_CHANGE_PENDING_PRIMARY_EVIDENCE**, fără reparentare, coduri atribuite sau înlocuiri de poligoane.

Registrul sursă este `docs/audits/rt-adm2-8/consolidated-legal-exceptions.json`. Registrul nou `docs/audits/p91a-20261101/prepromotion-register.json` păstrează toate 14 cazurile în HOLD. Acesta nu este inventarul tuturor candidaților ACTUAL sau Nistrenia.

## Ce s-a demonstrat

- Sectoare București: pe snapshotul OSMB din 2026-10-05, reuniunea celor șase poligoane coincide topologic cu municipiul (zero gap, outside, overlap și diferență simetrică; `docs/audits/rt-adm2-13-1/topology-register.json`).
- Dosare RO/MD: sursele existente sprijină numeroase identificări nominale, dar **niciunul dintre cele 14 footprinturi OSM nu este certificat juridic**.
- Lanțul normativ București nu este complet: originale de publicație D284/1979 și L31/1979, verificarea modificatorilor, anexa limitelor HCL15/1995 și eventualele planșe PUG aplicabile încă necesită probe primare; `docs/audits/auto2-bucharest-chain-20261031/modifier-chain.json`.

## Criterii fail-closed P9.1

- **P9.1a**: analiză, evidență per-ID, comparație și simulare read-only, fără efect în ACTUAL.
- **P9.1b**: **BLOCKED**; orice promovare necesită dovezi primare aplicabile ID-ului și întregului footprint, precizarea schimbării, autorizare explicită, CI complet și integrare protejată.
- Nu se deduce drept din geometrie OSMB; nu se autorizează automat schimbări de părinți sau coduri.
- Identitatea `osm-r12104636` rămâne fără confirmare pozitivă.

## Distincția de închidere

**COMPLETE_WITH_DOCUMENTED_EXCEPTIONS** înseamnă că trierea probatorie a celor 14 dosare este completă, nu că au fost recuperate toate originalele, adjudecate excepțiile sau aprobate modificări. Etapa de recuperare și certificare juridică exhaustivă rămâne deschisă separat. Nicio modificare ACTUAL.
