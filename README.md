# Släktarkivet

Ett webbverktyg för att visualisera och dokumentera släktforskning: släktträd, personer, källor, tidslinje, karta, bilder och import från Excel.

Allt är en enda HTML-sida utan byggsteg – ingen `npm install` behövs.

## Funktioner

- **Släktträd** – anor uppåt och ättlingar nedåt från vald person, med snabbknappar för att lägga till föräldrar.
- **Personer** – lista med filter för det som saknas (källa, födelsedatum, födelseort, föräldrar).
- **Källor** – registrera husförhörslängder, dopböcker m.m. med arkivreferens och koppla dem till personer.
- **Tidslinje** – livslinjer med historiska händelser i bakgrunden.
- **Karta** – platser och en persons livsväg. Placera orter genom att klicka på kartan.
- **Import** – Excel (.xlsx), CSV eller inklistrade celler, med automatisk kolumnmatchning.
- **Export** – JSON-säkerhetskopia, GEDCOM 5.5.1 och CSV.

## Köra lokalt

Sidan läser in kartdata med `fetch`, så den måste serveras över HTTP (att dubbelklicka på `index.html` fungerar inte för kartan).

```bash
git clone https://github.com/godvig/slaktarkivet.git
cd slaktarkivet
python3 -m http.server 8000
```

Öppna sedan <http://localhost:8000>.

Alternativ utan Python: `npx serve .`

## Publicera med GitHub Pages

1. Gå till repots **Settings → Pages**.
2. Under *Build and deployment*, välj **Deploy from a branch**, gren `main` och mapp `/ (root)`.
3. Efter en minut finns sidan på `https://godvig.github.io/slaktarkivet/`.

## Var sparas datan?

| Var sidan körs | Lagring |
|---|---|
| Lokalt eller på GitHub Pages | I webbläsarens `localStorage` – bara på den datorn och i den webbläsaren. **Exportera en säkerhetskopia regelbundet.** |
| Som artefakt på claude.ai | I molnet, med stöd för bilduppladdning och delning. |

Uppladdning av bilder och dokument kräver claude.ai-versionen; övriga funktioner fungerar överallt.

## Teknik

- [D3](https://d3js.org/) för träd, tidslinje och karta
- [topojson-client](https://github.com/topojson/topojson-client) + [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, public domain) för kartan
- [SheetJS](https://sheetjs.com/) för Excel-import (laddas först när den behövs)
