# RT-AUDIT.1 — registru părinte–copil / execuție probatorie

**Baseline (main):** `913145398bea5861935cd4b3b89a88638d80fd9c`.
**Rulare CI independentă:** https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40785938179
**Arhivă cu cele șapte fișiere generate:** https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/40785938179/artifacts/12859805935
**SHA-256 ZIP:** `d0981970b3634f94c511b13154bd3c1a47bfdbea9d1f36e23d88a6a3cdacc831`.

## Rezultate reproductibile

- 5.848 identități, două rădăcini, **5.846/5.846** relații părinte–copil procesate; fără ID lipsă sau duplicat.
- **119/119** sharduri topologice verificate (inclusiv SHA-256 și dimensiune).
- **118/118** resurse de frontieră verificate; 237/237 resurse din manifest.
- Relații: **5.589 `within`**, **254 `overlap`**, **3 `equal`**.
- **GEO: 254** suprapuneri parțiale (toate MD; nu constituie concluzii juridice).
- **ADM: 0** contradicții juridice certificate prin acest proces; registrul gol nu demonstrează lipsa contradicțiilor juridice.
- **DOC: 593** entități cu cel puțin un motiv de revizuire (540 MD, 53 RO), cu posibilă suprapunere cu GEO.
- **79** diferențe de părinte consolidat/statistic vs. părinte administrativ, clasificate DOC, fără reparentare.
- **3** egalități geometrice explicite necesită interpretare de model, nu sunt atribuite automat clasei GEO.
- Nicio modificare a geometriei ACTUAL, a arborelui, a catalogului, a geometriilor publice sau a surselor.

## Dovezi și utilizare

Arhiva conține `parent-child-register.json`, `geometric-exceptions.json`, `administrative-exceptions.json`, `insufficient-evidence.json`, `reconciliation-summary.json`, `reconciliation-summary.md` și `checksums.sha256`.

Regenerare și control local pe aceeași versiune a surselor:

```bash
node scripts/audit/rt-audit1-parent-child.mjs --write
node scripts/audit/rt-audit1-parent-child.mjs --check
```

**Limită probatorie explicită:** verificarea de identitate juridică din catalog și semnalarea necesității de revizuire nu substituie certificarea individuală a actelor normative, a versiunii aplicabile ori a părinților juridici. Nicio neconcordanță geometrică nu autorizează reparentare.
