# RT-ADM.2.5 — închidere exclusiv cartografică OSMB

**Decizie:** acceptarea ca atare a geometriilor OpenStreetMap Boundaries deja utilizate în ACTUAL pentru cele trei cazuri, fără reimportare sau modificare. Nu se cere cadastru oficial pentru acceptarea *cartografică*.

| ID | Obiect cartografic | Verdict |
|---|---|---|
| osm-r18967570 | Bondareuca / way 1376179980 | Acceptat OSMB as-is; parentaj CUATM încă disputat |
| osm-r18968043 | Etulia, loc. st. c. f. / way 1376179909 și 1376180675 | Acceptat OSMB as-is; parentaj CUATM încă disputat |
| osm-r12104636 | way 889101842, în zona Hrușova | Acceptat OSMB as-is; identitatea juridică rămâne necunoscută |

**Nu înseamnă:** geometrii juridice certificate, reparentare spre părinții CUATM, atribuirea unui cod nou, validarea juridică a întovărășirii pomicole sau acceptarea unei noi versiuni OSMB fără verificare de integritate.

**Sunt închise:** numai dependența de cadastru pentru reprezentarea pe hartă și cele trei excepții **din punct de vedere cartografic**. **Sunt deschise:** contradicțiile de identitate juridică și parentaj în registrul administrativ. Pentru acestea rămâne `NO_CHANGE_PENDING_PRIMARY_EVIDENCE`.

Dovezile de istoric relation / way / node verificate anterior sunt păstrate prin PR #467 și #468, care erau neintegrate în main la redactarea acestui registru. Nu se certifică un digest nou al snapshotului OSMB în această etapă și nu se regenerează ACTUAL.

Executare read-only: `node scripts/audit/rt-adm2-5-verify.mjs`. Nicio operațiune externă de solicitare, email sau plată. P9.1 continuă să necesite autorizare separată.
