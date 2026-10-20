# WEB-R2c.4 — acceptarea finală a website-ului publicat

Predecesor acceptat: WEB-R2c.3.2, PR #392, `main@970ce9ad70273c3b34721c283075875b04e1a2a3`. Gate-uri post-merge: 14 workflow-uri și 21 checks PASS, fără omiteri; audit public 39385100647 PASS cu 18 verificări, 14 capturi inspectate și nouă hashuri publicate potrivite. Cele 32 componente ACTUAL, 5.848 identități și 85 roluri sunt intacte. Dosarul post-merge al etapei închide GATE-002.

Această etapă extinde acceptarea pe GitHub Pages: pornire în viewport-ul declarat, desktop/tabletă/mobil portrait/landscape, selecții RO → MD → NI, geometrii și jurisdicții independente, filtre OSM 8/9 și statistice, confirmare/anulare/Undo, interacțiuni repetate, Back/Forward, refresh/Share, căutare/carduri, fundal OSM, focus și zoom nativ 200%. Se verifică resursele runtime și geometrice publicate față de sursele checkout-ului corespunzător și se păstrează hashurile și diagnosticele brute de rețea/consolă.

Auditorul candidat și sursa publicată se identifică separat. În PR, domeniul public este baseline-ul integrat; aceasta nu certifică publicarea candidatului. După merge este obligatoriu verdictul `PUBLISHED_EXACT_CHECKOUT` pentru noul main, împreună cu CI și Pages pe acel SHA.

Orice problemă reproductibilă nouă se înregistrează și se remediază cu regresie. Acceptarea finală necesită toate gate-urile, capturile relevante inspectate și zero defecte tehnice cunoscute deschise. Nu se schimbă UX fără un contract verificat. ACTUAL, părinții juridici MD, geometriile și P9.1 rămân protejate; acceptarea semantică rămâne BLOCKED_INCOMPLETE.

Stare: audit în curs; etapele NI-JUR nu au început.
