# WEB-R2c.3.1 — profilare și verdict de performanță

Baseline acceptat: `335234bdb7b8cec828d4d2ad11d42d5bc5f99642`, Etapa 0 CLOSED_PASS. Domeniul acestui PR: completarea și corectarea instrumentării Chromium/CDP și investigarea măsurătorilor, fără schimbări ale aplicației sau ACTUAL.

Constatare reproductibilă RM-002: benchmarkul aplică viewport-ul după navigare; astfel încărcarea inițială etichetată mobil pornește cu viewport-ul implicit. Corecția va aplica viewport-ul înainte de navigare și va verifica dimensiunile la începutul documentului.

Acoperire în lucru: cinci încărcări independente cold/warm pe desktop, tabletă și mobil portrait/landscape; interacțiuni, V8 heap după GC, trase CDP, rețea brută, încărcare geometrică și verificarea independenței filtrelor/NI/ACTUAL. Verdictul rămâne OPEN până la măsurare, inspectarea capturilor și toate gate-urile PASS pe SHA-ul exact.

Nu se introduc praguri noi arbitrare, cache, worker sau virtualizare suplimentară. Orice optimizare a aplicației necesită o problemă demonstrată și comparație controlată înainte/după. ACTUAL și P9.1 rămân protejate.
