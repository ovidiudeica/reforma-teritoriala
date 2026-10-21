# Audit Pages — retry limitat, separat de promovarea OSM

Runul post-merge 39634353612, pe `476307e2f86407166114ddcbcc2dd5be03ee16cf`, a primit HTTP503 pentru `public/data/topology-frontiers/chunks/md/detail/osm-r59002.json` înaintea matricei Chromium. Nu este o dovadă de corupere a resursei sau de defect al aplicației. Eșecul rămâne conservat; o relansare reușită nu închide singură problema.

Remedierea existentă în PR #398 este extrasă prin cherry-pick cu proveniența originală: `9c5fedb941e3908f51b5f12bd26a3db585f3db5a` și `a20c55036a66fad6a037d0fe9f898beea2f0b5bd`. Nu se promovează sursa OSM. Maximum trei încercări, backoff500/1000ms, numai pentru statusuri/erori de transport explicite. Statusul final trebuie să fie200 și fiecare resursă trebuie să coincidă byte-identic cu checkout-ul cerut. HTTP404, erorile de integritate și erorile netranzitorii nu sunt transformate în PASS.

Auditul acoperirii a constatat că testul retry existent nu era inclus în workflow-ul publicat. Este adăugat acum în pasul obligatoriu. Regresia suplimentară demonstrează că503 urmat de200 cu geometrie veche eșuează în continuare la hash. Nu se modifică UI, corpusul ACTUAL, host-trust, prospețimea sau P9.1.
