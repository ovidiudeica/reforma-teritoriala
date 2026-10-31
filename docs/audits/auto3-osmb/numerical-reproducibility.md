# Reproductibilitatea numerică Windows/Ubuntu

Rularea inițială AUTO-3 din Actions, job 124392572749, a trecut verificarea integrală a registrului și a hashurilor, dar a eșuat la comparația unei suprafețe proiectate cu toleranța absolută fixă de 0,00001 m². Verificarea locală Windows trecuse pe aceleași geometrii. Nu s-a demonstrat o diferență a intrărilor geometrice.

Controlul scalar folosește acum un buget de rotunjire dependent de scară: maximum dintre 128 ULP-uri ale coordonatei proiectate maxime înmulțite cu perimetrul, 64 ULP-uri ale suprafeței așteptate și 10⁻⁸ m². Astfel, comparația numerică tratează diferențele de aritmetică/proiecție între platforme în raport cu mărimea geometriei. Fiecare abatere trebuie să rămână în bugetul calculat; o abatere mai mare oprește verificarea și tipărește valorile. Raportul CI tipărește abaterea maximă, bugetul și versiunile GEOS/PROJ.

Bugetul nu stabilește acceptabilitatea unei limite și nu rotunjește un reziduu la zero. Hashurile intrărilor, egalitatea topologică exactă a contururilor alternative și identitatea exactă a diferențelor geometrice cu dovezile păstrate rămân obligatorii. Valorile originale nu sunt rescrise. Toate cele 13 diferențe și reziduul nenul Ojdula/Brețcu rămân în registru, iar P9.1 rămâne neautorizat.

Sursa eșecului observat: https://github.com/ovidiudeica/reforma-teritoriala/actions/runs/41152687306/job/124392572749 . Logul indică linia de comparație scalară; închiderea remedierii necesită o nouă rulare CI reușită, nu simpla modificare a verificatorului.
