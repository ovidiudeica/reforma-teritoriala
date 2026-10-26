# NI LEGAL CLOSE 1 — registru permanent cu excepții

Acest dosar încheie **inventarierea și investigația documentară în limitele probelor disponibile**, nu certificarea juridică integrală. Baza este `main@c8b3ce8d6b3c863aa4f6b9e7203f38c398989728`. Închiderea administrativă a #442 a fost autorizată separat de acceptarea unor concluzii juridice și se execută numai după CI, integrare și audit post-merge.

## Domeniu și registre

- `per-id-final-register.json`: toate cele 85 identități geometrice ACTUAL cu rol NI, trei axe contemporane independente și statusurile istorice păstrate integral.
- `normative-source-register.json`: cele 14 PDF-uri nerecuperate, edițiile HTML și metadatele cunoscute, 19 înregistrări documentare istorice (nu 19 acte distincte), originalele deja existente și limitările lor.
- `unresolved-exceptions.json`: fiecare caz, original lipsă, condiție de efectivitate, excepție nominală și contradicție poate fi reluat individual.
- `sources/`: unsprezece copii textuale byte-identice din lanțul NI-ADM arhivat, proveniența Git și hashurile, intrările curente verificate și observația constituțională nouă. Nu se integrează payloadurile istorice NO MERGE sau concluziile lor ca acceptări juridice.
- `NI-LEGAL-CLOSURE.md`: raport și decizie condiționată de închidere, cu starea reală la pregătire. Evenimentul GitHub ulterior consemnează execuția efectivă, fără afirmații premature despre merge/CI.
- `sha256-manifest.json`: inventarul complet al acestui dosar, fără manifestul însuși.

Toate cele trei axe pentru **întregul poligon contemporan** rămân UNRESOLVED_EVIDENCE: 0 CERTIFIED / 85 UNRESOLVED_EVIDENCE / 0 CONTRADICTORY_EVIDENCE pe fiecare axă. Separat sunt conservate 84 propoziții istorice nominale privind textul din 2023, cu domeniu strict, fără certificarea identității poligonului. Nu transformăm cele 84 potriviri în 84 certificări juridice actuale.

Cele 96 decizii istorice privind contradicțiile rămân în fiecare fișă. O diferență între roluri, epoci, enumerare și rang nu este automat o incompatibilitate juridică demonstrată. Clasificarea 7/9, orașele Dubăsari și Rîbnița, Bender, Cremenciug, Lunga, omonimele Hlinaia, Chițcani și Zona de Securitate rămân explicit urmărite; zero în coloana CONTRADICTORY_EVIDENCE nu le declară rezolvate.

## Probe existente și probe lipsă

Cele 14 publicații rămân individual `ORIGINAL_NOT_PUBLICLY_RECOVERED`. Previziunile HTML, indexurile și datele derivate nu sunt PDF-uri originale și nu certifică articolul operativ integral. Cele trei efectivități condiționate și discrepanța titlului 2024000427 se păstrează. Nu s-au repetat cereri restricționate identice, nu s-au ocolit abonamente și nu s-au contactat instituții.

Inventarul arhivat de **307 fișiere** este un inventar de metadate (369 intrări, 62 directoare), nu 307 texte citite sau certificate. Sunt conservate separat revizuirile a 14 regulamente locale și două hashuri binare istorice; originalele celor două exemple nu sunt pretinse reverificate acum. Tagul remote adnotat `archive/repo-clean-20261025/audit/ni-adm132-public-edition-and-local-effects-20261024` a fost verificat la commitul `cf0a68d837c80e8c1c789ece7ad82b3f74d27f64`. Poate recupera lanțul și indexurile complete fără un nou recensământ. Copiile înghețate verifică independent hashurile Git blob și SHA-256.

Au fost reverificate cele 80 intrări ale manifestului suplimentului și **25 fișiere originale deja conservate**: 22 fișiere cu semnătură PDF și trei atașamente HTML/alte formate. Sunt fișiere, nu 25 acte distincte. Rehashuirea confirmă conservarea octeților, nu constituie o nouă revizuire integrală a conținutului sau o certificare de semnătură calificată. Nu se duplică binarele.

## Ediția constituțională 2026

[Pagina oficială](https://vspmr.org/legislation/laws/konstitutsiya-pridnestrovskoy-moldavskoy-respubliki-i-zakoni-ob-izmenenii-konstitutsii-pmr/konstitutsiya-pridnestrovskoy-moldavskoy-respubliki.html) indică ediția din **19.04.2026**. Ediția 2025 citată în auditul anterior nu este tratată drept ultima. Unicul [atașament Word public](https://vspmr.org/file.xp?file=130728) a fost recuperat în această investigație: 318976 octeți, SHA256 `c58e1cf133091ee19691e4e2987b7ec88cf5ceb934dd2ec176ee79d93e7c1708`, MIME și semnătură CFB verificate. Originalul brut rămâne în checkpointul local; receiptul nu pretinde publicarea lui aici sau verificarea binarului de către CI.

Dintr-un fragment brut UTF-16 contiguu al art.14 se observă enumerarea celor patru orașe și cinci raioane, inclusiv mențiunile de localități asociate Benderului în acea revendicare instituțională. Fragmentul nu reprezintă o parsare/randare completă a Word-ului sau certificarea aplicabilității întregii ediții; runtime-ul disponibil nu are convertor pentru DOC legacy. Hashul și localizarea fragmentului, limitările și sursele sunt în `sources/constitutional-evidence.json`. Nu deducem suveranitate, recunoaștere juridică, limite ori control efectiv.

Nouă entități enumerate constituțional și șapte categorii/unități de rang superior din prezentarea instituțională nu sunt reconciliate prin reparentări presupuse. Modelul NI-FIN și toți părinții juridici MD rămân nemodificate.

## Reproducere și control

`node docs/ni-legal-close/validate.mjs --check`

`node --test scripts/test/ni-legal-close.test.mjs`

`--write` regenerează numai registrele derivate și manifestul din intrările fixe; nu efectuează accesări externe, nu închide issue-uri și nu schimbă surse/date. `--check` verifică hashurile intrărilor și binarelor păstrate, identitățile distincte, cele 14/85 înregistrări, cele 96 decizii, toate excepțiile și regenerarea byte-identică. Testele negative interzic promovări neprobate și registre incomplete. CI pe SHA exact și auditul post-merge sunt dovezi separate de acest validator.

ACTUAL RO3246 / MD2602 / total5848 / 32 componente rămâne protejat, SHA semantic `a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446`. `ACTUAL_MUTATION_ALLOWED=false`, `P91_IMPORT_ALLOWED=false`, `NI_FUNCTIONAL_COMPLETE=true`. Nicio schimbare OSM, NI-FIN, WEB-NI-U1, CUATM ori părinți MD. #396/#398 nu sunt modificate de această operațiune. Sursa OSM STALE nu este rezolvată.
