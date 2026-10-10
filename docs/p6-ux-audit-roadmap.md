# P6 — UX Refinement: audit inițial și roadmap

## Domeniu și protecții

Baseline imutabil: `main` `8cb96250611a0c79c1a1935e69eff29d7bf5bf34` (P5.4.3, release closure). P6 privește exclusiv prezentarea/navigarea aplicației publice.

Nu se modifică ACTUAL/P2, ISTORIC/PROPUNERI, identitățile SIRUTA/CUATM, geometria EPSG:4326, topologia, simplificarea (interzisă), manifestele, fingerprinturile, proveniența surselor sau contractele de URL/history. Operațiile checkbox/selectare/expand sunt independente și implicit numai România+Moldova sunt bifate. Noile funcționalități se livrează în PR-uri independente cu required checks și fără bypass.

## Audit Chrome al paginii publicate înainte de P6

URL: `https://ovidiudeica.github.io/reforma-teritoriala/`. Browser Chromium/CDP, capturi 1440×900 (desktop), 900×768 (tabletă landscape / prag desktop), 390×844 (telefon, drawer închis). Măsurători vizuale DOM, un run fără throttling:

- Desktop 1440×900: `#atlas-controls` 800px viewport util; `scrollHeight=1453px`; hartă 1092px lățime. Legenda începe la y≈941 și blocul „Release și proveniență” la y≈998, având ≈487px; acestea sunt sub fold.
- Tabletă 900×768: panou 668px, același conținut 1453px; hartă 552px lățime. Pragul responsive contractual rămâne 899/900px.
- Telefon 390×844: harta are lățime 390px, drawer-ul este ascuns implicit. Acesta trebuie verificat după deschidere, nu evaluat prin dimensiuni DOM când este inert/ascuns.

Problema P6.1 confirmată: meniul de navigare combină acțiuni, căutare, arbore, legendă, documentație despre niveluri și proveniență. Navigarea cere scroll excesiv și metadatele concurează vizual cu arborele; harta însă are spațiu bun pe desktop.

Datele de mai sus sunt observații de layout pe un număr limitat de viewporturi, nu certificare completă pentru orice dispozitiv sau WCAG.

## Livrare etapizată

### P6.1 — Simplificare explorator și informații la cerere

- Meniu „Explorează” cu trei acțiuni principale (link, filtre, informații), căutare, taburi și arbore.
- Elimină etichetele vizuale redundante Căutare/Arbore fără a le elimina din arborele de accesibilitate.
- Mută legenda, nivelurile de detaliu și proveniența într-un dialog modal cu închidere Escape, focus și revenire la controlul accesibil.
- Păstrează mesajele de eroare ale geometriilor în navigarea principală; dialogul nu ascunde erorile critice.
- Pe mobil, deschiderea informațiilor închide drawer-ul, iar închiderea dialogului mută focusul la butonul de navigare. Filtrele și dialogul nu rămân deschise simultan.
- Acceptare: test Chrome local dedicat, regresii P5 și verificare hash/data-diff; PR separat cu review înainte de integrare.

### P6.2 — UX pentru telefon/tabletă

Comenzi tactice compacte și o navigare ergonomică; cardul de detalii cu stări minimizat/intermediar/extins, inclusiv control gestual accesibil și fallback pe butoane; comportament explicit pentru portret/landscape. Se implementează separat, după P6.1 și confirmarea UX.

### P6.3 — Navigare avansată

Căutare grupată și evidențierea potrivirilor, panou cu geometrii vizibile, istoric local, card de detalii structurat, comparație explicită a două entități, comenzi de centrare/reset și posibilitate de ascundere a exploratorului desktop. Fiecare funcție cere criterii și teste pentru identitate vs geometrie; URL persistă numai opțiunile acceptate explicit.

### P6.4 — Performanță și acceptare

Profilare cold/warm în Chrome cu rețea lentă și hardware mobil; streaming/cache/render fără alterarea coordonatelor geometrice; verificări accesibilitate prin tastatură și testare manuală pe dispozitive fizice. Comparație byte-for-byte a corpusurilor și release assets, checks CodeQL/ACTUAL/P2/browser și A/B post-merge pentru fiecare PR integrat.

## Status — actualizat la 2026-10-10

- **P6.1 — CLOSED/PASS**, PR #275, merge `4f09593c19567269728004bfad727e581670a2af`.
- **P6.2 — CLOSED/PASS**, PR #276, merge `5ede06b75645577d25a1d860e3850f82e833264e`.
- **P6.3 — CLOSED/PASS**, PR #277, merge `8be982c325028562eeeba6c6f760a5feea864b9b`.
- **P6.4 — CLOSED/PASS**, PR #278, merge `325e95966bc618ceaaca37d4d65133b7e14da66a`. Browser QA, gates și audit post-merge documentate.
- **P6.4.1 — CLOSED/PASS**, PR #279, merge `4177b09c195e792677ef0f757168ba7ca21b834e`. `fitBounds` RO+MD pe 8 viewporturi; Chrome live 31/31, frontend 24/24 și geometrii 123/123 byte-identice.
- **P6.4.2 — CLOSED/PASS**, PR #280, merge `bfef878859fffa54937ce2b398475b0fbac6f349`. Patru iconuri în Leaflet, Chrome live 8/8, frontend 25/25, geometrii 123/123, 8/8 workflow-uri post-merge, A/B `mismatches: []`.
- **P6.4.3 — hotfix suprapuneri UI:** PR #282, merge `1affdd135b773b2c7b4fc533ee1cc0373e07f25d`. Scala mutată în dreapta pe mobil; butonul de restrângere a exploratorului mutat lângă, nu peste, bara Leaflet pe desktop. Regresia Chrome verifică nesuprapunerea și toate cele patru ținte de click; auditul post-merge intră în criteriul P6.5.
- **P6.5 — release closure evidence-only:** [documentul de acceptare](p6.5-phase-release-closure.md); PR separat pentru închiderea fazei P6. Verdictul final depinde de required checks și auditul post-merge pe SHA exact.

Acceptarea pe dispozitive fizice Android/iOS și cu tehnologii asistive rămâne distinctă de verificarea tehnică Chrome/CDP.
