# AUTO-2 — Șase trasee istorice, comparație textuală și dependențe deschise

Continuare după AUTO-3, 31 octombrie 2026. Sunt reutilizate investigația din branch-ul `audit/rt-adm-2-14-legal-boundaries-bucharest` și inventarul surselor din PR Draft #479. Nu sunt repetate inventarul OSMB și auditul topologic al sectoarelor.

Au fost extrase cele șase descrieri istorice din anexa nr. 1 a Decretului nr. 284/1979, vizibile în [forma oficială de afișare](https://legislatie.just.ro/Public/DetaliiDocumentAfis/28216). Au fost comparate cu cele șase descrieri vizibile în [această formă imprimabilă a Legii nr. 2/1968](https://legislatie.just.ro/Public/FormaPrintabila/00000G006MECTABEER702U9T7T2042VK). Nu se certifică versiunea temporală exactă a celei de-a doua pagini.

Rezultat: **6 perechi de texte, 24 de clauze direcționale indexate și 35 de grupuri de diferențe lexicale** după normalizarea diacriticelor, majusculelor, punctuației și spațiilor. Unele diferențe privesc grafii istorice; altele ating mențiuni inclusiv/exclusiv sau succesiunea reperelor. Ele nu sunt considerate automat modificări normative. Pentru sectoarele 3–5 este necesară în special confruntarea originalelor și identificarea eventualului temei modificator ori a erorii de transcriere/editoriale. Nu s-au inventat denumiri moderne sau coordonate ale reperelor.

## Proveniență și limită probatorie

Fișierele `web-extracted-*.txt.gz` păstrează transcrierea normalizată returnată de instrumentul web pentru paginile oficiale, inclusiv numerotarea liniilor. **Nu sunt HTML/PDF original și hashul lor nu este hashul originalului publicat.** Descărcările directe independente ale celor patru pagini s-au încheiat fără răspuns utilizabil; încercările sunt în `retrieval.json`. Metadatele de crawl ale instrumentului web indică o copie anterioară, nu o accesare binară live certificată.

`six-historical-routes.json` păstrează descrierile, modificatorii inclusiv/exclusiv și SHA-256 al fiecărei transcrieri. `six-route-text-comparison.json` păstrează ambele texte per sector, fiecare grup lexical diferit și cele 24 de clauze. Verificarea reconstruiește cele șase texte istorice din liniile păstrate și cere concordanță, apoi reproduce comparația. `reused-rt-adm2-14-1.md.gz` consemnează starea investigației precedente, fără a o transforma în dovadă de închidere.

## Ce rămâne deschis

- originale tipărite sau copii oficiale verificabile, cu integritate binară;
- lanțul complet al modificatorilor și rectificărilor aplicabile 1979–2026;
- explicația documentară a diferențelor care pot modifica sensul traseului;
- identificarea independentă și datată a reperelor istorice;
- confruntarea segment-cu-segment cu OSMB după rezolvarea acestor dependențe.

**Nu se certifică hotare juridice sau echivalență OSMB. ACTUAL nemodificat; P9.1 neautorizat.** Lipsa originalelor și a lanțului complet nu este tratată drept concordanță sau lipsă de modificatori.

Reproducere fără rețea: `python scripts/audit/auto2-bucharest-text-compare.py`, apoi `node scripts/audit/auto2-bucharest-text-verify.mjs`. SHA-256 din `sha256-manifest.json` se referă la livrabilele efectiv păstrate, nu substituie probele oficiale încă lipsă.
