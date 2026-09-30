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

## Limită de verificare

Conectorul GitHub folosit pentru auditul din 2026-09-30 poate confirma starea codului, PR-urilor și check-urilor, dar nu expune endpoint-ul de branch protection/rulesets. Din acest motiv, valorile concrete din GitHub Settings trebuie verificate în interfața administrativă înainte de tag-ul final; documentația repository-ului nu este folosită drept substitut pentru acea setare.
