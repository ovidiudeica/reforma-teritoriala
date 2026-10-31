# AUTO-2 — originale și lanț normativ provizoriu

Pachetul adaugă două publicații binare oficiale PMB: HCL15/30.03.1995 și HCGMB269/21.12.2000, validate prin semnătura PDF, SHA-256, extragere reproductibilă și inspecție vizuală. Sunt reproduceri ale editorului oficial, **nu scanuri autentificate ale ediției inițiale din Monitorul/Buletinul Oficial**. Originalele Decretului284/1979 și Legii31/1979 rămân nerecuperate. Încercările directe eșuate și captura normalizată a paginilor oficiale sunt păstrate separat.

`modifier-chain.json` distinge9 acte/candidați și7 legături cu domeniul și nivelul probatoriu precizate. Decretul284/1979 modifică anexa Legii2/1968; Legea31/1979 aprobă decretul. Decretul15/1981 și Legea50/1997 privesc organizarea București–Ilfov și nu sunt promovate la modificări demonstrate ale traseelor interne ale celor șase sectoare. Legea24/1996 rămâne candidat neadjudecat.

Publicația HCL15/1995 enumeră o anexă privind delimitările, dar PDF-ul recuperat nu furnizează planșa delimitatoare. HCGMB269/2000 aprobă PUG și conține o clauză generală de abrogare a prevederilor urbanistice contrare. Clauza nu dovedește singură abrogarea nominală a HCL15 și nici modificarea Decretului284. PDF-ul HCGMB conține lista avizelor, fără planșele PUG. Un răspuns HTTP200 cu extensiaPDF de la studiul istoric PMB2025 conține HTML; acesta este înregistrat ca sursă respinsă și nu intră în categoria originalelor PDF dobândite.

Registrele celor6 sectoare reutilizează comparația acceptată prin PR483:6 perechi de trasee,24 clauze și35 grupuri de diferențe lexicale. Nu o repetă și nu o interpretează ca dovadă a unei modificări juridice. Hashurile întregului pachet anterior sunt fixate în `previous-stage-pins.json`.

**Statut: REVIEW_REQUIRED pentru fiecare sector; lanțul complet nu este certificat.** Lipsesc edițiile originale relevante, verificarea completă a modificărilor/rectificărilor/republicărilor, planșele aplicabile și identificarea istorică independentă a reperelor. Fiecare sector păstrează clauzele și lista de dovezi necesare. Nu se aliniază juridic geometriile OSMB și nu se modifică ACTUAL. P9.1 rămâne neautorizat.

Reproducere offline:

```sh
python -m pip install pypdf==6.10.0
python scripts/audit/auto2-bucharest-text-chain-verify.py
```

Verificatorul controlează toate hashurile, extragerea textului PDF, domeniul legăturilor normative, cele6 ID-uri și păstrarea dovezilor anterioare și a arborilor protejați. `sha256-manifest.json` acoperă fiecare fișier, exceptându-se pe sine. Capturile web normalizate nu sunt prezentate ca octeți originali ai actelor.
