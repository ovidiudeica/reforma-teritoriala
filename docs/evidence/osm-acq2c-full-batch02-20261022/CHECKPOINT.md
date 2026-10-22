# OSM-ACQ.2c — lotul 2 / checkpoint de integrare

**Domeniu:** exact 64 de obiecte autentice noi (indici deterministici 64–127), fără dublarea celor 8 din pilotul PR #408 sau a celor 64 din PR #409. Nu adjudecă individual nicio relație și nu certifică selecția Geofabrik/Overpass.

- Epoca: `2026-10-20T20:23:47Z`.
- Registru cumulativ: SHA-256 gzip `f893c3ba01fc870be5dfedb72381d47367ae4cdcacd0093fd56270a547bc36dd`.
- Predecesor #409: artifact `12437338609`; ZIP SHA-256 `b13762100c9107bba0e08280a5c8efb6ebb5c546052e8d9effd4b94e929ec6ab`.
- Plan predecesor: primele 64 obiecte SHA-256 `05178089441a5e992d18fd10987e2cfb12eb1c6a7abb744019ac9f5fb98ea380`.
- Run CI dedicat: `39808056177`, `osm-acq2c-full-unknown-batch02=SUCCESS`, cinci teste negative de continuitate PASS.
- Artifact lot2: `12438881996`, 120278 octeți, ZIP SHA-256 `ebec65857904cd11a57f402d7a4ac7799ec3c130314c29fcf71b1e63d53f52f7`.
- Verificare independentă ZIP: 131 intrări; toate 130 de fișiere enumerate în manifest au hashul și lungimea corecte. 64/64 obiecte `HISTORICAL_VERSION_PROVEN`, zero `RETRIEVAL_INCOMPLETE`, zero `HISTORY_REJECTED`, zero obiecte duplicate față de pilot și lotul 1.
- Cumulativ: **136/2966** obiecte directe probate; **2830** de dependențe directe rămase și posibile dependențe way→node suplimentare. **242 relații UNKNOWN**, zero verdicte noi.

**Nu înseamnă CLOSED_PASS OSM-ACQ.2c.** Fiecare etapă ulterioară cere captură istorică bulk autentică, replay exact și gate-urile cerute. ACTUAL 3246 RO + 2602 MD = 5848 / 32 componente, geometria publicată, părinții juridici MD, host-trust, pragul de prospețime și P9.1 rămân neschimbate. Nu a fost efectuată nicio editare publică OSM. Originalele sunt în GitHub Actions cu retenție limitată, iar pachetul de conservare extern separat nu se promovează în repository-ul public.
