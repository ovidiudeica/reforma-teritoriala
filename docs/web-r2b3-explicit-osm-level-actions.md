# WEB-R2b.3 — comenzi explicite pe nivel administrativ OSM

## Contractul de interacțiune

Acțiunile **Afișează geometriile nivelurilor selectate** și **Ascunde geometriile nivelurilor selectate** sunt independente de filtrul read-only WEB-R2b.2. Lista multi-select OSM definește exclusiv *domeniul numeric propus*; modificarea efectivă a bifelor are loc **numai după un click separat și confirmarea explicită** a numărului de geometrii afectate.

- Nivelurile numerice validate sunt `2, 3, 4, 5, 7, 8, 9`; `unknown` nu se transformă într-o acțiune masivă asupra entităților fără sursă verificată.
- Sunt eligibile entitățile ACTUAL RO/MD cu nivel OSM confirmat și **cele 8 contururi NI independente**, fiecare cu bifa proprie.
- Cele **85 de aliasuri de rol NI** reutilizează geometria ACTUAL MD. Pentru a evita modificarea implicită a unor checkbox-uri MD prin aliasurile NI, sunt *excluse* din acțiunile de grup. Eticheta de confirmare comunică numărul de aliasuri excluse.
- Confirmarea include nivelurile selectate și distribuția schimbărilor RO/MD/NI; o modificare a domeniului sau a bifelor înainte de confirmare invalidează planul, fără modificări parțiale.
- **Undo** restaurează ultima operațiune explicită de grup, doar asupra bifelor încă aflate în starea rezultată; dacă o bifă a fost ajustată ulterior individual, nu este suprascrisă.
- Resetarea geometriilor și restaurarea unei stări URL invalidează undo-ul în memorie. Istoricul URL existent (`x` pentru ACTUAL și `o` pentru contururile NI) înregistrează bifele efectiv schimbate.
- Un click pe filtrul OSM, o extindere de ramură ori o selecție de entitate nu modifică automat vreo bifă geometrică.

Acțiunile nu rescriu date publice, nu introduc noi jurisdicții ACTUAL, nu generează poligoane și nu certifică juridic rolurile OSM. `p91_import_allowed=false`, `semantic_acceptance=BLOCKED_INCOMPLETE`.

## Dovezi necesare înainte de integrare

1. Teste unitare pentru blast radius pe RO/MD/NI, excluderea aliasurilor, confirmare stale/fail-closed, undo și lipsa inferenței pe valori necunoscute.
2. Chromium desktop/mobil pentru confirmare, activarea explicită a 7 contururi NI de nivel 5, independența celor 85 de aliasuri MD, undo, URL și capturi relevante.
3. **Toate** workflow-urile GitHub obligatorii `SUCCESS` pe SHA-ul exact, inspecția capturilor, Ready → merge controlat → audit Pages și fingerprint ACTUAL.

**Nu se efectuează merge doar în baza acestui document.**
