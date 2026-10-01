# ACTUAL v1 — trust boundary

## Decizie pentru v1

ACTUAL v1 folosește GitHub ca infrastructură de build, review, admission și publicare. Pentru repository-ul personal `ovidiudeica/reforma-teritoriala`, trust root-ul administrativ este proprietarul/adminul GitHub al repository-ului.

Gate-urile `verify-persisted-release`, `actual-change-reproducibility` și `actual-release-trust-chain` demonstrează proprietăți ale pipeline-ului versionat și ale release-ului verificat. Ele nu sunt prezentate ca o barieră independentă împotriva unui proprietar/admin sau a unui writer care poate schimba simultan codul de verificare și regulile repository-ului.

Acesta este threat model-ul acceptat pentru ACTUAL v1. Un trust root independent ar necesita, într-o fază ulterioară, de exemplu un organization-enforced required workflow sau un GitHub App administrat separat.

## Contract operațional pentru `main`

Înainte de publicarea tag-ului ACTUAL v1 și pe durata mentenanței v1, configurația GitHub pentru `main` trebuie să păstreze:

- merge prin pull request;
- required status checks exacte: `verify-persisted-release`, `actual-change-reproducibility`, `actual-release-trust-chain`;
- force pushes dezactivate;
- branch deletion dezactivată;
- enforcement pentru administratori, dacă politica repository-ului îl permite;
- fără bypass neauditat al admission path-ului ACTUAL.

## Verificare administrativă curentă

La auditul post-v1 din 2026-10-01, configurația GitHub a fost verificată direct prin API-ul administrativ al repository-ului. `main` este protejat prin pull request, required status checks sunt `strict` și sunt exact `verify-persisted-release`, `actual-change-reproducibility` și `actual-release-trust-chain`; enforcement pentru administratori este activ, iar force-push și branch deletion sunt dezactivate.

Tag-urile `actual-v*` sunt protejate de un repository ruleset activ care interzice update și deletion fără bypass. Immutable Releases este activ pentru release-urile noi. Aceste setări sunt parte din contractul operațional și trebuie reverificate după orice schimbare administrativă relevantă.
