# Släktsagan

[![CI](https://github.com/godvig/slaktsagan/actions/workflows/ci.yml/badge.svg)](https://github.com/godvig/slaktsagan/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-2f5d50.svg)](LICENSE)
![No build step](https://img.shields.io/badge/build-none-8b8174.svg)

**Build your family history together.** Släktsagan is a browser-based genealogy workbench: family tree, fan chart, sources, timeline, map and auto-written life stories. It runs from a single static page, needs no account and keeps your data in your own hands.

*Släktsagan* is Swedish for "the family saga" (*släkt* = family, relatives). The repository is `slaktsagan` because GitHub names can't contain å/ä/ö.

Most genealogy tools are either subscription platforms that own your tree, or desktop programs that look like 2005 and can't be shared. Släktsagan is for the person who does the research for the whole family. You document every fact with its source, then share **the part of the tree each relative cares about**. Cousins on dad's side don't have to scroll through mum's side.

The interface is in Swedish for now, and it understands Swedish sources (household examination rolls, parishes, patronymics). An English UI is next on the [roadmap](#roadmap).

![Släktsagan demo: clicking through the House of Vasa, the tree glides to each new person, then the relationship calculator lights up how Sigrid and Władysław IV are related](docs/screenshots/demo.gif)

*Click someone and the family rearranges around them; ask how two people are related and the chain lights up in the tree. Try it on the [House of Vasa example](https://klansagan.godvig.com/#exempel).*

| Fan chart | Relationship calculator | Person card |
|---|---|---|
| ![Fan chart](docs/screenshots/fan.png) | ![Relationship calculator](docs/screenshots/relationship.png) | ![Person card](docs/screenshots/person-card.png) |
| **Timeline** | **Map with life route** | **Dark mode** |
| ![Timeline](docs/screenshots/timeline.png) | ![Map](docs/screenshots/map.png) | ![Dark mode](docs/screenshots/tree-dark.png) |

## Live demo

**[Open the example](https://klansagan.godvig.com/#exempel)**: the Swedish royal House of Vasa, from Gustav Vasa (1496) to Queen Christina and Charles X Gustav, with coronations, marriages, places and sources. The example lives in memory only and is never saved. [Open an empty archive](https://klansagan.godvig.com/) to start with your own family.

## Quick start

There is no build step. Serve the folder with any static web server:

```bash
git clone https://github.com/godvig/slaktsagan.git
cd slaktsagan
python3 -m http.server 8000      # or: npx serve .
```

Open <http://localhost:8000>. Opening `index.html` directly from disk won't work, because the map data is loaded with `fetch`.

To import your own family, start from [`examples/slaktsagan-import-example.xlsx`](examples/slaktsagan-import-example.xlsx). It has one row per person, and parents are referenced by id or by name.

## Features

- **Family tree:** ancestors and descendants around any person, up to 10 generations each way. Couples follow genealogical convention (man left, woman right), and cards stay put when you move between partners. *Lock* the tree to read around in it without it rebuilding; pick someone who is outside it (from search or a name in the panel) and the locked tree grows – more generations, wider side branches – until they are in it.
- **Fan chart:** ancestors in a half circle, coloured by grandparent line, with completeness per generation.
- **Person cards:** an automatically written life story ("…was born on 12 May 1496 at Rydboholm… married… died aged 64"), plus family, a vertical timeline with age at each event, photos and sources.
- **Relationship calculator:** precise Swedish kinship terms (farbror, moster, brorsdotter, kusin, tremänning, halvkusin, svåger…) with the path drawn through the common ancestor.
- **Sources:** register each register volume once (archive, reference, image id) and cite it per fact.
- **Timeline:** lifespans against historical events (plague, famine years, emigration, wars).
- **Map:** places on a map, with a person's life route. Place a parish by clicking the map and merge spelling variants.
- **Views:** hide a branch ("dad's side only"), single people or descendants. Each view has its own link, and nothing is deleted. One click undoes a change.
- **Several trees in one archive:** families that aren't connected yet show up as separate trees. Link them with a plain-language sentence ("Anna *is the mother of* Ellen"), or accept a suggested match when the same person appears in both.
- **Duplicate finder:** catches spelling variants (Gustaf/Gustav, Wasa/Vasa, Larsdtr/Larsdotter) and merges the records safely.
- **Import:** GEDCOM 5.5 / 5.5.1 / 7 from any genealogy program (Disgen, MyHeritage, Ancestry, Geni, Holger, Legacy…), including the old ANSEL and IBM PC character sets Swedish programs used, the `*` call-name marker, dates like `ABT`/`BET … AND …`, coordinates, notes, sources with page references and marriages. A preview shows what was found before anything is saved; places and sources the archive already has are reused, and the whole import is one undoable step. Excel, CSV or cells pasted from Excel work too, with columns mapped automatically from Swedish or English headers.
- **Export:** GEDCOM 5.5.1 (MyHeritage, Ancestry, Gramps, Disgen…), CSV and a JSON backup. The tree, fan chart and person cards print as PDF (A3/A4) or PNG.
- **Family book:** the branch you see in the tree becomes a printable book (PDF): a cover with the focus person's photo, a table of contents, the tree as a picture, one chapter per generation, oldest first, with each person's life story, photo, family, events, voice-memory titles and sources, numbered so parents and children refer to each other, and an index of names.
- **Collaboration:** when hosted as a Claude artifact, invited relatives edit the same tree live, and every change records who made it.
- **Works on phones:** a bottom tab bar, a compact tree toolbar, person details as a sheet, touch zoom and pan.
- **Easy to use:** a start page with three clear choices and a *simple mode* (big text, only Start, Tree and People) that a link can switch on with `?enkelt`. Mark yourself as "me" and kinship is counted from you. Light by default, dark mode on request.
- **Call names (tilltalsnamn):** mark the name a person went by. It is underlined Swedish-style, and you can show short names everywhere (call name, or the first given name).
- **Show the path in the tree:** the relationship calculator ("Hur är vi släkt?") opens the tree around the shared ancestor and lights up the chain between the two people, couples included, and dims everyone else.
- **On this day:** the start page lists birthdays, death days and wedding days today and in the next two weeks – living relatives as *"turns 30"*, so it doubles as a birthday reminder, everyone else as *"born 1594, 432 years ago"*.
- **Questions per person:** every person has a thread – *"Does anyone know when Hilda was born?"* – with replies and a *solved* mark. Open questions show as a badge on the tree card and as a list on the start page. Each comment is its own document, so two relatives commenting at the same time never overwrite each other when they publish.
- **Swedish church records:** paste a citation copied from ArkivDigital (`Röke (L) AII:3 (1918-1933) Bild 70 / sid 3 (AID: v350192.b70.s3, NAD: SE/LLA/13324)`) or Riksarkivet (`Röke kyrkoarkiv, Församlingsböcker, SE/LLA/13324/A II/3 (1918-1933), bildid: 00127782_00010`) and the volume becomes the source, with its type (*husförhörslängd*, *födelse- och dopbok*…) read from the series letter, the county from the county letter, and image and page filled in. The same volume from both services is recognised as one source via its NAD reference. Riksarkivet images get a link; an ArkivDigital AID can be copied to open the image there. AIDs and image ids survive a GEDCOM round trip.
- **Backups:** a local archive lives only in the browser, so *Import & export* shows when you last saved a backup and how much has changed since, and the app reminds you (at most every few days) when you have never saved one or it is two weeks old with changes. The backup is one JSON file with everything, photos and voice memories included, and reads straight back in.
- **Photos straight onto people:** drag an image onto a card in the tree (or the person panel), paste one with Ctrl+V while someone is selected, or tap the empty photo on a card; on a phone that offers the camera. The first photo becomes the profile picture and is framed on the face.
- **Undo everything:** every change — an edit, a deleted person with all their links, a photo upload, a whole import — can be undone and redone with the ↶ ↷ buttons or Ctrl+Z / Ctrl+Shift+Z. Changes made in one go count as one step, and the toast says what was undone.
- **Animated tree:** when you click someone, they stay put under your cursor while the rest of the family glides into its new places (and the view eases them back towards the middle if they ended up near an edge); relatives who leave the view fade out and new ones fade in. Respects *reduce motion*.
- **Voice memories:** record grandma telling a story straight from the browser (or upload an audio file) and attach it to a person, or to one of their photos. Recordings are small (Opus, about 180 KB a minute), kept on the device and, in shared trees, uploaded end-to-end encrypted like photos.
- **Thumbnails:** photos get a small thumbnail when uploaded, so the tree and lists load only a few kilobytes per person; the full image is fetched when you open it.
- **Photos framed on the face:** profile photos are centred on the face automatically (MediaPipe face detection, loaded on demand) and can be dragged and zoomed by hand.
- **Side branches:** the tree can show siblings, cousins, second cousins and further out, packed beside the direct line. On import, use a *Tilltalsnamn* column or an asterisk (`Lars* Anders`).
- **What's new since your last visit:** in a shared tree, the start page lists who others added, changed (and what: birth, photos, sources…) or removed, and their new questions, with who published them. Changed people carry a small *Ny*/*Ändrad* badge in the tree until you mark it as seen.
- **Photo gallery:** the person card shows photos with their captions, the first one large, and as a swipeable strip on phones. The viewer steps through them with arrows, arrow keys, swipes and a thumbnail strip.
- **Kinship as a chain on phones:** on a narrow screen "Hur är vi släkt?" shows the way between two people as one readable chain (*Gustav II Adolf · son till · Karl IX · son till · Gustav Vasa*), also over the tree.

<details>
<summary><b>Swedish terms used in the interface</b></summary>

| Swedish | English |
|---|---|
| Träd / Solfjäder | Tree / Fan chart |
| Släktskap | Relationship |
| Källa, husförhörslängd | Source, household examination roll |
| Församling / socken | Parish |
| Far, mor, farfar, mormor | Father, mother, paternal grandfather, maternal grandmother |
| Farbror, faster, morbror, moster | Paternal uncle/aunt, maternal uncle/aunt |
| Kusin, tremänning, halv- | First cousin, second cousin, half- |
| Vy, dölj | View, hide |
| Startperson | Home person |

</details>

## Architecture

```
index.html          markup shell, loads D3 + topojson from CDN
src/core.js         pure logic: dates, GEDCOM parsing and dates, kinship terms, views, duplicate scoring, undo history
src/app/            the UI as ES modules, one per area:
  main.js           everything that runs on load: header wiring, routing, start-up
  state.js          the archive in memory, the filtered view of it, UI state
  store.js          saving and loading, undo/redo, IndexedDB / artifact database
  tree.js fan.js    the family tree and the fan chart
  panel.js media.js the person panel, photos, voice memories, questions
  share.js          end-to-end encrypted sharing, publish and merge
  importexport.js   GEDCOM and Excel/CSV import, GEDCOM/CSV/JSON export
  …                 timeline, map, start page, relationship, duplicates, print, views
src/styles.css      design tokens (light + dark), layout
fonts/              Fraunces + IBM Plex Sans (woff2, SIL OFL), served from the site itself
data/world-50m.json Natural Earth countries (via world-atlas) for the map
examples/           fictional import files
tests/              Vitest suite for src/core.js
e2e/                Playwright browser tests
scripts/bump.mjs    bumps the asset version everywhere for a release
```

- **No framework, no bundler.** The app is vanilla JavaScript, split into ES modules that the browser loads directly (every import carries the release's `?v=` so a browser never mixes two releases; `npm run bump` moves them all), with [D3](https://d3js.org) for the tree, fan chart, timeline and map. [SheetJS](https://sheetjs.com) and [jsPDF](https://github.com/parallax/jsPDF) load lazily, only when you import or print.
- **Data model:** five document kinds (`person`, `place`, `source`, `view`, `comment`) stored as flat JSON documents. Relationships live on the person (`fatherId`, `motherId`, `spouseIds`), and events and citations are embedded.
- **Storage adapters:**
  - IndexedDB when the app runs standalone, such as on GitHub Pages: the archive text and photos, with no 5 MB cap (archives from older versions are moved over from `localStorage` automatically). Edits made just before a tab closes are also written synchronously as an emergency copy, so nothing is lost.
  - A realtime document store with per-user attribution when it runs as a Claude artifact.
  
  The rest of the app only sees an in-memory store.
- **Cheap redraws:** every data change bumps a revision counter; the tree and person list compare it with what they last drew, so selecting someone only moves a highlight instead of rebuilding hundreds of cards (77 ms → 5 ms on a 1,500-person archive).
- **Views** filter the store before rendering. All writes, exports and merges always operate on the full, unfiltered data, so hiding something can never orphan or overwrite it.
- **Pure core:** everything that has a right answer (kinship terms, date handling, duplicate scoring, view filtering) lives in `src/core.js` and is unit tested.

## Tests

```bash
npm ci
npx playwright install chromium   # once, for the browser tests
npm run check     # eslint + tsc (JSDoc types on core.js) + vitest + Playwright
```

CI runs all of it on every push and pull request, in two jobs:

- **Unit tests (Vitest)** for the pure logic in `src/core.js`: Swedish kinship terms (including half and removed relationships), date parsing, GEDCOM import (character sets, dates, families, sources) and export dates, Swedish source citations, the undo history, three-way merge and encryption, CSV/Excel paste parsing, duplicate scoring and branch hiding.
- **Browser tests (Playwright)** that drive the real app in Chromium, on a desktop and a phone viewport: the animated tree, the kinship path, undo/redo, GEDCOM and CSV import, backup and restore, pasted church-record citations, dropping a photo on a card, recording and playing a voice memory (with a fake microphone), and two relatives commenting on a shared tree at the same time against an in-memory stand-in for the Supabase functions, which also checks that nothing readable reaches the server.

All test data is synthetic. Offline, point `E2E_LIB_DIR` at local copies of the CDN libraries and `PW_CHROME` at an installed Chrome.

## Sharing (end-to-end encrypted)

**Dela** creates a link you send to relatives. The tree is encrypted in the browser with AES-256-GCM; the key sits in the link's `#fragment`, which browsers never send to a server. Supabase stores only ciphertext and checks a write secret derived from the key, so neither the host nor the site owner can read a shared tree.

Everyone with the link can edit a local working copy and **publish** when ready. If two people publish in parallel, the second publish merges document by document (three-way merge); when both changed the same person, the newer edit wins. The server keeps the last 30 versions. Leaving the page with unpublished edits asks first, coming back to them shows a reminder with a Publish button, and so does sitting on them for ten minutes.

**Two links: edit and read-only.** A shared tree has two keys. The edit link carries both; the read-only link carries only the read key. Publishing needs a secret derived from the editor key, so a read-only link can't publish. Living people (no death date, born less than 105 years ago, or with no dates to go on) are split out before encryption: readers get their name, birth year and family links, while their dates, places, photos, voice memories, notes and sources, along with all comments, are encrypted a second time with the editor key. A reader can't recover them even from the raw payload. Either link can be replaced: the old one stops working at once, and editors keep the old keys so history still opens. Trees shared before this existed keep their single link until someone presses **Skapa läslänk**.

Photos are kept in IndexedDB on each device and, in a shared tree, uploaded once each as separate encrypted blobs, so publishing never re-sends them.

To run your own: create a Supabase project, run the files in `supabase/migrations/` in order in the SQL editor, and put the project URL and publishable key in `src/config.js`. The publishable key is public by design: the tables are closed and only the `kl_*` functions are exposed.

## Roadmap

Done recently: a family book as PDF, undo/redo for every change, a reminder before leaving with unpublished changes, photos dropped straight onto tree cards, backup reminders, GEDCOM import, Swedish source citations, a presentation page for first-time visitors, questions and comments per person, browser tests in CI, the app split into ES modules, a locked tree that grows to include whoever you pick, "On this day", encrypted sharing with publish and merge, version history, photo storage with thumbnails, voice memories, animated tree, kinship path in the tree, archive in IndexedDB, self-hosted fonts, phone layout, installable offline app (PWA).

**Next:** a research log per person, transcription of voice memories, English UI.

## License

[AGPL-3.0](LICENSE) © Adam Englund. You can use, study and modify Släktsagan freely. If you run a modified version as a network service, you must share your source code too.

Fonts: [Fraunces](https://github.com/undercasetype/Fraunces) and [IBM Plex Sans](https://github.com/IBM/plex), both under the SIL Open Font License 1.1 (see `fonts/`). Map data: [Natural Earth](https://www.naturalearthdata.com) (public domain) via [world-atlas](https://github.com/topojson/world-atlas). The House of Vasa example is compiled from public historical sources (Svenskt biografiskt lexikon, Svenskt kvinnobiografiskt lexikon, the Royal Court). Dates follow the Julian calendar that Sweden used until 1753.
