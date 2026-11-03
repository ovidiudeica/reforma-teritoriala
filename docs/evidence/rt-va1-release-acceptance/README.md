# RT-VA1 — infrastructură de acceptare și probe

Acest branch nu modifică `data/current`, `public/data`, `public/geo` sau `assets/web-card-audit`. Baza este `main@b005f2cf2e5842eae33fc575c84617fac960e507`. Nu reprezintă promovarea unui snapshot.

**Identități aprobate:** ACTUAL istoric `actual-a9e5a4ddcb5277ef` / 5.848 (RO 3.246, MD 2.602); Varianta A `actual-903b934850711dc7` / 5.725 (RO 3.246, MD 2.479). Sunt acceptate numai fingerprinturile semantice exacte. Excluderile sunt exact 123, dintre care 122 structurale și Î.P. „Mure Dulci” `osm-r12104738` revizuită. SHA-256 arhivă: `20a03333a9485218da6b552ce9af77b929f6163826c4af4f3936eb374f150c63`.

**Derivate reconstruite oficial:** după release gate, pipeline-ul regenerează catalogul celor 85 de roluri NI, topologia P8.2 (index, shards și frontiere) și WEB-CARD.1 (64 de fragmente, 5.725 de fișe). Sursa WEB-CARD istorică este verificată înainte de filtrarea strictă a celor 123 de ID-uri. Workflow-urile candidat/promovare acceptă numai aceste noi căi de publicare, fără privilegii suplimentare sau push în `main`.

**Separare probatorie:** WEB-R2a.1 și P9.0.8 păstrează probele și hashurile istorice. Pentru un candidat semantic RT-VA1 promovat se construiește separat un raport read-only pe baza originală, lanțul celor două commituri, registrul per-ID, manifestele topologiei/fișelor, 85 roluri NI și blocajele P9.1. Testele P2 și NI recunosc numai release-uri cu identitate exactă, nu un prag liber.

**Admitere:** integrarea acestui PR necesită CI terminal reușit pe SHA exact. PR #509, pe snapshotul candidat vechi, nu se mergează. După integrarea infrastructurii se cere un candidat oficial nou `actual/candidate-*`, promovare cu SHA exact, CI protejat și audit GitHub Pages. `P9.1a=BLOCKED_INCOMPLETE`; `P9.1b=BLOCKED`.
