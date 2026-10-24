# NI-FIN.1 — model administrativ virtual pregătit

Stare: **IMPLEMENTED / DRAFT / DEPENDS_ON_NI-FIN.0**, nu acceptare funcțională.
NI-FIN.0 este PR439; gate-ul său ACTUAL A/B rămâne nesatisfăcut. Acest model
poate fi testat independent, dar nu se integrează înaintea etapelor și gate-urilor
aplicabile. Nu schimbă ACTUAL, CUATM, părinții MD sau website-ul activ.

Generator: `node scripts/audit/build-ni-fin-model.mjs`; verificare byte-identică:
`node scripts/audit/build-ni-fin-model.mjs --check`.

Registrul `public/data/ni-fin-administration.json` are 242 de noduri accesibile:
rădăcină, 5 raioane, 4 orașe superioare, 74 consilii și alte 158 de mențiuni.
Cele patru orașe au câte două referințe documentare în același nod. Toate cele
245 de referințe unit/council/place au mapare reciprocă verificată. Sursa originală
și corecția punctuală Maiac rămân separate și hash-uite.

Cele 93 de resurse sunt referințe: 85 identități ACTUAL existente și opt contururi
independente. Versiunile/timestampurile/hashurile probelor OSM sunt conservate.
Nu există coordonate sau poligoane în noul model. Nu se afirmă echivalența dintre
contururile OSM și teritoriile administrative declarate.

Statutele nodurilor: 8 `GEOMETRY_VERIFIED`, 97 `GEOMETRY_CANDIDATE`,
137 `NO_GEOMETRY_EVIDENCE`. **234 de noduri nu au contur propriu certificat**,
inclusiv toate cele 74 de consilii. Candidaturile nu sunt activate drept geometrie
proprie; se inspectează explicit și distinct în card. Niciun candidat nu certifică
identitatea juridică ori controlul efectiv.

Cele 75 de mențiuni fără referință în OSM-85 au fost căutate numai după egalitate
de nume de afișare (NFKC, spații marginale și case-folding, fără fuzzy matching
sau eliminarea diacriticelor) în catalogul MD existent. 12 mențiuni au 25 de
înregistrări nominale posibile. Acestea **nu sunt corespondente certificate**,
nu intră în cele 85 de roluri, nu primesc poligoane NI și nu sunt comasate.
Există inclusiv omonimii din alți părinți MD; părintele MD este păstrat în dovadă,
iar verificarea individuală rămâne necesară. Absența unei potriviri nu dovedește
absența unei geometrii în OSM.

Etichetele românești existente sunt utilizate numai drept aliasuri de afișare,
independent de geometrie. Pentru restul, se transliterează textul paralel în
grafie chirilică moldovenească din aceeași anexă, cu indice și text original
păstrate per-ID. Nu se inventează o denumire juridică oficială.

Întregul registru rămâne `SOURCE_SCOPED_CONFIRMED` pentru enunțul sursei2023,
`PROVISIONAL` pentru actualizarea contemporană, cu apartenența juridică și
controlul efectiv necertificate separat. BenderMD9581354/NI944727, orașele și
raioanele Dubăsari/Rîbnița, Cremenciug/Tiraspol/Slobozia și omonimiile sunt
referințe distincte. Arhitectura separă registrul de prezentare de resursa
geometrică; jurisdicții viitoare pot folosi alte namespace-uri și contracte,
fără modificarea identităților ACTUAL.

20 de teste verifică regenerarea identică, sursele și identitățile, deduplicarea
rolurilor comune, interdicția de copiere a poligoanelor, statutul candidaților,
părinții, aliasurile, epoca și încărcătorul WebCrypto cu răspuns corupt/lipsă.
Aceste teste nu substituie integrarea, Chromium sau publicarea din NI-FIN.2–3.
