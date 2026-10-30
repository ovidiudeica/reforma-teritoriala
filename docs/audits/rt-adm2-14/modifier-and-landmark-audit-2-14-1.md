# RT-ADM.2.14.1 — Controlul actelor modificatoare și corelarea reperelor (30.10.2026)

**Stare:** investigație executată parțial; verificarea juridică exhaustivă și concordanța liniară cu OSMB **NU sunt certificate**. Nicio modificare ACTUAL.

## Surse normative

| ID | Act / versiune | Observație verificabilă | Relevanță | Control |
|---|---|---|---|---|
| N-01 | Decret nr. 284/31.07.1979, BO nr. 69/01.08.1979, https://legislatie.just.ro/Public/DetaliiDocument/28216 | Art. 1 instituie șase sectoare; anexa nr. 1 descrie limitele; art. 5 declară anexele parte integrantă | bază juridică pentru șase trasee | text oficial disponibil; original tipărit necertificat |
| N-02 | Legea nr. 31/14.12.1979, https://legislatie.just.ro/public/DetaliiDocument/28169 | legea de aprobare a decretului 284/1979 | aprobare, nu s-a demonstrat modificare de traseu | identificat în inventarul anterior |
| N-03 | Legea nr. 2/1968, republicarea istorică, https://legislatie.just.ro/Public/DetaliiDocumentAfis/46045 | organizare în 8 sectoare | bază istorică, nu limită aplicabilă celor 6 sectoare | verificat |
| N-04 | Legea nr. 2/1968, formă actualizată/printabilă, https://legislatie.just.ro/Public/FormaPrintabila/00000G006MECTABEER702U9T7T2042VK | include anexa de delimitare a celor șase sectoare | termen de comparație textuală cu 1979 | existență verificată; comparație text exhaustivă neexecutată |
| N-05 | HG nr. 64/2011, metodologia stare civilă, https://legislatie.just.ro/Public/DetaliiDocumentAfis/126502 | descrie istoria transformării sectoarelor din 8 în 6, indică 04.08.1979 | corroborare cronologică, NU act modificator de hotare | verificat |

**Inventarul modificatorilor:** căutări pe sintagmele „Decretul 284/1979 modificat”, „delimitarea sectoarelor municipiului București modifică”, plus comparația formelor Legii nr. 2/1968. Nu a fost identificat în acest lot un modificator ulterior care să schimbe explicit anexa nr. 1. **Această constatare este un rezultat negativ de căutare, nu dovadă că nu există modificatori.** Sunt încă necesare examinarea „Acte modificatoare”/istoricul complet al Portalului Legislativ, colecțiile Monitorului Oficial și eventuale acte de rectificare; evaluarea perioadei 1979–2026 rămâne deschisă.

## Normalizare istorică preliminară

| Reper din textul de la 1979 | Tratament | Corespondent modern | Certitudine |
|---|---|---|---|
| Bulevardul Republicii | denumire istorică, traseul trebuie dezambiguizat per tronson | NECONFIRMAT | neconfirmat |
| Bulevardul 1848 | denumire istorică | NECONFIRMAT | neconfirmat |
| Bulevardul Gheorghe Gheorghiu-Dej | denumire istorică și reper de traseu | NECONFIRMAT | neconfirmat |
| Piața Nicolae Bălcescu | toponim istoric, nu se presupune aceeași geometrie a intersecției | NECONFIRMAT | neconfirmat |
| Strada Ștefan Furtună | toponim istoric | NECONFIRMAT | neconfirmat |
| Podul Elefterie | reper fizic explicit | verificare locație necesară | reper textual |
| Calea Plevnei; Calea Giulești; Drumul Carierei | drumuri textuale, mențiuni inclusiv/exclusiv relevante | evaluare în OSM de făcut | reper textual |
| Calea ferată București–Roșiori; calea ferată de centură | ax feroviar, necesară versiunea istorică și precizarea referinței la ax | evaluare în OSM de făcut | reper textual |
| Liziera vestică a pădurii Tunari | limită naturală din 1979, potențial schimbată | geometrie istorică necesară | nesigur |
| Strada Vadul Moldovei, grădina zoologică Băneasa | traseu și includere explicită | verificare istorică necesară | reper textual |
| Calea ferată București–Constanța; șoseaua Pipera | intersecție reper | verificare în OSM necesară | reper textual |
| Râul Dâmbovița și râul Colentina | fir de apă explicit, nu malul și nu baza poligonului OSMB | verificare talveg/ax | reper textual |
| Drumul între Tarlale; satul Cățelu, comuna Glina; bulevardul Ion Șulea | repere istorice/comunitare | verificare schimbări teritoriale necesară | nesigur |

**Regulă:** termenii „inclusiv” și „exclusiv” sunt păstrați ca atribute juridice ale tronsonului; nu sunt transformați în offset geometric implicit. „Linie convențională” nu permite interpolare arbitrară.

## Inventar per sector și confruntare cu OSMB

| Sector | Relație OSMB | Anexa nr. 1 | Identificare reper istoric în sursa oficială | Match GIS cu traseul normativ |
|---|---|---|---|---|
| 1 | 7960954 | sector 1 | Blvd. Republicii, pod Elefterie, Dâmbovița, CFR centură, lizieră Tunari, Vadul Moldovei, Pipera | NEEXECUTAT |
| 2 | 7960953 | sector 2 | descriere existentă; extragere granulară nefinalizată | NEEXECUTAT |
| 3 | 7960937 | sector 3 | Bd. Republicii, Hristo Botev, Calea Călărași, Colentina, Cățelu, Dâmbovița | NEEXECUTAT |
| 4 | 7960957 | sector 4 | descriere existentă; extragere granulară nefinalizată | NEEXECUTAT |
| 5 | 7960956 | sector 5 | descriere existentă; extragere granulară nefinalizată | NEEXECUTAT |
| 6 | 7960955 | sector 6 | descriere existentă; extragere granulară nefinalizată | NEEXECUTAT |

### Separarea probelor

Rezultatul RT-ADM.2.13.1 confirmă numai faptul că șase geometrii OSMB constituie o partiție exactă a municipiului; nu demonstrează alinierea lor la descrierea juridică din 1979. Pentru a afirma concordanță per-tronson sunt necesare extragerea completă a traseelor, geocodarea reperelor istorice și testele de distanță/lungime pe segmente, cu erori de identificare explicite.

## Gate de închidere

**BLOCKED:** nu adjudeca limitele juridice și nu modifica ACTUAL până la inventarul modificatorilor certificat, analiza integrală a celor șase trasee și comparația liniară însoțită de surse. 
