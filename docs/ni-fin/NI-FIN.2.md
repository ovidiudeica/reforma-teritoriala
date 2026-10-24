# NI-FIN.2 — Integrarea interfeței virtuale

Implementare pregătită, fără acceptare sau publicare implicită. Depinde de NI-FIN.0 și NI-FIN.1.

Arborele folosește aceleași componente virtualizate și mecanisme URL ca RO/MD. Cele 242 de noduri de prezentare acoperă 9 unități superioare, 74 consilii și 162 mențiuni reconciliate (4 orașe au roluri documentare comune). Etichetele oraș/raion disting explicit omonimiile.

Entitățile fără contur propriu au nume selectabil, căutare, card, URL și History, dar nu o bifă geometrică activă. Navigarea tastaturii sare peste bifa dezactivată în ambele direcții. Nivelurile OSM rămân filtre independente; nodurile fără nivel probat apar la categoria necunoscută, fără atribuirea unui nivel administrativ inventat.

Cele 85 de referințe canonice sunt consultabile separat în carduri, toate fiind accesibile din cardul rădăcinii. Aceste comenzi modifică exclusiv selecția geometriei existente; nu certifică poligonul propriu al unui consiliu sau localități. Cele 8 contururi independente au aceleași ID-uri și aceleași coordonate. La încărcare rămân bifate numai rădăcinile RO, MD și NI.

Cardurile arată sursa 2023, incertitudinea contemporană, părintele documentar, geometria și, când există, rolul/nivelul/versiunea OSM și părintele MD păstrat. Omonimele suplimentare din MD sunt numai text, fără comenzi geometrice sau promovare identitară.

Teste: ni-fin2-view.test.mjs; ni-fin2-browser.test.mjs; contractele Chromium P909/P9094 au fost actualizate pentru schimbarea comportamentală explicit autorizată. Regresiile P9095 păstrează verificarea contururilor, filtrelor, Undo, Reset, URL/Share și ciclului de selecție. Niciun test obligatoriu nu a fost exclus.

NI_FUNCTIONAL_COMPLETE=false până la acceptarea dependențelor, CI pe SHA exact, merge și publicarea Pages verificată. NI_LEGAL_CERTIFICATION_PENDING și OSM_SOURCE_PENDING rămân distincte și adevărate.

Remedieri CI inițial: modelul a fost izolat sub `views/nistrenia/`, păstrând integral interdicția WEB-R2a.1 pentru data/public; verificările vechi de șapte grupări au fost actualizate la cele nouă unități aprobate; parcurgerea automată a celor 242 de carduri este ritmată fără dezactivarea protecției Chromium IPC. Schimbarea unei înregistrări NI resetează derularea cardului la titlu, fără resetarea cardului la bifarea unei resurse din interior.
