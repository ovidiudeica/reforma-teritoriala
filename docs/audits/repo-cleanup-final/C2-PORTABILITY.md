# C2 — reproducere portabilă și păstrarea snapshotului original

Stare: **LOCAL_VERIFIED_PENDING_CI**. Remediere separată de ștergerea placeholderului C3, consolidarea CI și datele ACTUAL.

Analizorul inițial folosea `Path.write_text()` fără parametrul `newline` pentru JSON și SHA256SUMS. Pe Windows acestea aveau CRLF, pe Linux LF. CSV-urile aveau deja LF explicit. Datele semantice coincideau, dar instrucțiunea de comparare byte-for-byte a snapshotului istoric nu era portabilă.

Implementarea actuală folosește implicit LF explicit, inclusiv pe Windows. Modul `--json-line-endings legacy-crlf` reconstruiește exact vechile produse Windows din același commit. Nu se normalizează retroactiv niciun produs C2 integrat și nu se schimbă hashurile sale. Sursa inițială este păstrată byte-identic în `c2-analyzer-v1.py.txt`; extensia `.txt` indică o dovadă arhivată, nu un nou entry point executabil. Pentru executarea istorică directă folosește versiunea din commitul #492 pe calea sa originală.

`c2-portability-proof.json` înregistrează comparația reală pentru toate cele cinci produse ale snapshotului `8c8cb123c0e8c363268886aba863131e33f3e1a4`: summary, cititori dinamici, registru, matrice și checksums. Hashurile sunt comparate cu bytes originali integrați, nu cu un rezultat recalculat și acceptat artificial.

Un test CLI creează un repository Git temporar cu surse UTF-8 și importuri relative. Rulează executabilul real în ambele moduri, verifică exact terminatorii, identitatea CSV-urilor și fiecare checksum intern. Nu repetă inventarul teritorial sau audituri juridice. Cele patru teste Python au trecut local, inclusiv acest test; aceleași teste rulează în CI pe Linux.

Guard-ul păstrează controlul hashului sursei originale și verifică separat SHA-256 al implementării portabile. Niciun gate nu este dezactivat, niciun test nu devine SKIPPED. Manifestele și corpusurile ACTUAL nu sunt modificate. Acceptarea finală cere CI pe SHA-ul exact și controale post-merge reușite.
