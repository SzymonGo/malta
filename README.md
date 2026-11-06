# Malta 7–14.11.2026 – offline PWA

Plan wyjazdu dzień po dniu, działający offline na iPhonie (Safari → „Dodaj do ekranu początkowego”).
Statyczna strona bez backendu i bez kroku build: `index.html`, `styles.css`, `app.js`, `js/`, `data/trip.json`, `sw.js`.

## Instalacja na iPhonie
1. Otwórz adres aplikacji w **Safari**.
2. **Udostępnij → Dodaj do ekranu początkowego → Dodaj**.
3. Otwórz aplikację **z ikony** (online) i poczekaj na komunikat **„Gotowe offline”** (widać go też w zakładce Info).
4. Włącz tryb samolotowy i otwórz aplikację z ikony – wszystko powinno działać.

## Poprawka w trakcie wyjazdu
1. Zmień `data/trip.json` (albo inny plik).
2. `node tools/update-sw.mjs --bump` – podbija wersję cache w `sw.js` (`malta-vN` → `malta-vN+1`) i odświeża listę plików.
3. `node tools/validate.mjs` – sprawdza dane i wszystkie scenariusze Hypogeum.
4. Commit + push. Po otwarciu aplikacji (online) pojawi się baner **„Nowa wersja planu – Odśwież”**.

Bez Node'a: wystarczy ręcznie zmienić `const VERSION = 'malta-vN'` w `sw.js`. Same zmiany w `trip.json` docierają też bez podbicia (network-first), ale bez banera.

## Narzędzia
- `tools/validate.mjs` – walidacja danych (placeRef, godziny, scenariusze).
- `tools/update-sw.mjs` – lista precache + wersja cache.
- `tools/merge-credits.mjs` – atrybucje zdjęć z `img/credits.json` do `trip.json`.
- `tools/make-icons.py` – ikony (PIL).
- `tests/e2e.mjs` – test Playwright (iPhone, offline, scenariusze, zamiana dni, aktualizacja).

Zdjęcia: Wikimedia Commons, wolne licencje – autorzy w zakładce Info i w `img/credits.json`.
