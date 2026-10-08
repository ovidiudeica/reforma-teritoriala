# Atlas mobile shell — web-v1.2.5

Breakpoint comun CSS / matchMedia: max-width 720px. Desktop păstrează cele două side panels; intervalul 721–1050px păstrează overlay-ul details existent. Același DOM pentru search, filters, hierarchy-tree și details-panel; nimic nu este remontat la open/close.

## Drawer

Controller-ul atlas-mobile-ui.mjs gestionează numai stare ephemeral. Default closed; trigger „Navigare”, close explicit și backdrop. Drawer lateral width min(350px,90vw), scroll intern și overscroll containment. Search primește focus după open; close readuce focus pe trigger. Panelul closed este inert / aria-hidden, fără focus pe controale ascunse. Nu există focus trap modal; auditul complet rămâne web-v1.2.6.

Escape este ascultat în capture pentru a verifica starea search înainte de handler-ul acestuia: dacă listbox este open, controller-ul search primește Escape și închide numai lista. Altfel Escape închide drawer-ul. Query și selected entity rămân. Checkbox/disclosure nu închid drawer-ul. Search Enter/click și tree select închid drawer-ul, dar expand/collapse nu selectează. DOM, checkbox state, tree/filter disclosure și query sunt păstrate.

## Bottom sheet

Stări closed (fără selection), peek (cu selection) și expanded. Peek afișează display_name și tipul reprezentării folosind typeLabel existent; înălțime max 26% din suprafața hărții. Expanded: 70%, scroll intern, același details-body complet: breadcrumb, legal/statistical/cartographic, actions și mesaj hidden geometry. „Extinde” / „Restrânge” folosesc aria-expanded și aria-controls. Close delegă exact la clearSelection, eliminând și URL entity prin controller-ul semantic existent.

Orice selecție validă map/search/tree/breadcrumb/URL notifică shell-ul sincron, înainte de fetch geometry. Sheet revine la peek, inclusiv pentru geometrie ascunsă/statistical-only. Map framing folosește comportamentul existent; niciun padding/fitBounds suplimentar datorat sheet-ului. Sheet nu folosește backdrop; harta rămâne interactivă în zona liberă.

Selecția nu mută focus-ul către sheet. Search/tree auto-close îl readuc pe trigger, evitând focus ascuns. Collapse mută focus din details-body pe expand dacă este necesar. Clear mută focus ascuns pe trigger. La desktop→mobile drawer este closed, sheet peek dacă există selection; la mobile→desktop sunt eliminate clasele mobile/inert, details-body revine vizibil și focus-ul pe controale mobile trece la search. State-ul semantic nu este resetat.

## URL / history

Drawer open/closed și sheet peek/expanded nu sunt serializate și nu apelează History API. Selecție/clear/filtre rămân la controller-ele web-v1.2.1–1.2.4. Popstate selectat închide drawer-ul și arată peek; popstate fără entity ascunde sheet-ul. Filtrele geometrice nu sunt activate de shell; tree și breadcrumb rămân sincronizate pentru selection hidden.

## Layout / provenance

Harta umple main; header/footer mobile compacte. 100dvh, viewport-fit=cover și safe-area padding sus/jos. Body overflow hidden; drawer/details scroll separat. Touch targets noi ≥44px. Reduced-motion dezactivează slide transition. Release/provenance .status este accesibil în drawer, inclusiv status-urile RO/MD existente; nu este ascuns. Attribution Leaflet rămâne la baza hărții, într-o bandă de 26px sub sheet; scale în colțul opus. Footer păstrează textul legal compact.

Z-index: Leaflet 400–1000, trigger 1100, details sheet 1200, backdrop 1300, drawer 1400. Desktop rămâne la stilurile de bază. Nu există drag physics, framework, URL parameters noi sau dependențe suplimentare.

Teste controller/DOM și integrare cu app.js, search/tree/filters/Leaflet/History simulate; CSS audit pentru breakpoint, scroll, safe-area, attribution și desktop. E2E/visual QA complet rămâne web-v1.2.7.
