# Fidelitatea octeților de audit Windows/Git/Linux

Jobul CI 124402228211 a oprit corect validarea la două metadate generate pentru istoriile RO: manifestul fusese calculat din copia Windows cu CRLF, iar bloburile Git aveau LF. Nu au fost afectate arhivele OSMB, răspunsurile API originale, geometriile sau ACTUAL.

Pentru `ro-shared-node-history/retrieval.json`, manifestul greșit consemna 876 bytes și SHA-256 `0444e59717f1326e09139c4f50d3efb07b34ba25fa49c1defc37eedbc20f6d7c`; blobul Git avea 851 bytes și `22f61a2b0a1be94dd823d608973006917caa95859de16319bc6c46e4f7d1431d`. Diferența este exclusiv LF/CRLF. Aceeași cauză privea `source-diagnostic.json`, 60.188 versus 56.732 bytes.

Remedierea păstrează metadatele generate în LF, conservă răspunsurile originale fără transformare și calculează manifestul pentru octeții efectivi. Reguli `.gitattributes` strict limitate noilor dosare de audit conservă octeții la checkout. Validarea locală suplimentară `node scripts/audit/auto3-osmb-verify.mjs --staged` cere concordanță atât cu copia de lucru, cât și cu bloburile din indexul Git, inclusiv manifestul însuși. Un nou dezechilibru oprește verificarea. SHA-256 sunt calculate din fișiere, nu înlocuite cu valori dorite.

Sortarea cheilor manifestelor este explicită și independentă de regulile de comparare a căilor Windows/POSIX. Nu sunt relaxate verificările de integritate, de geometrie sau de protecție a ACTUAL/P9.1. Închiderea remedierii necesită CI reușit pe commitul actualizat.

Eșec observat: https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/41155809400/job/124402228211 .
