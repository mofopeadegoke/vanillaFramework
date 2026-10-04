# Riverside Rapid 2026

Event page for a local one-day rapid chess tournament, built with Canonical's
[Vanilla Framework](https://vanillaframework.io/). It has a schedule with
pairings, live standings calculated from the results, a registration form and an FAQ.

## Develop

```sh
npm install
npm run dev    # builds to dist/, rebuilds on change, serves http://localhost:3000
npm run build  # production build (compressed CSS) into dist/
```

## Project layout

```
src/
  index.html            page markup (Vanilla patterns)
  scss/main.scss        brand overrides + the Vanilla patterns this page uses
  scss/_tournament.scss page-specific styles
  js/app.js             renders everything from the data file
  js/standings.js       Swiss standings + tiebreaks (Buchholz Cut-1, Sonneborn-Berger)
  js/register.js        registration form validation and submit handler
  data/tournament.json  all event content: details, schedule, players, pairings, FAQ
scripts/build.mjs       Sass compile + static copy (+ dev server in --watch mode)
```

## Updating tournament data

Everything on the page comes from `src/data/tournament.json`:

- `status`: `"pre-event"` lists registered players by seed. `"live"` and `"finished"` show standings.
- `sections[].rounds[].pairings`: `{ board, white, black, result }`, where `result` is `"1-0"`, `"0-1"`, `"½-½"`
  or `null` (not yet played). `black: null` gives a full-point bye.
- Standings, ranks and tiebreaks are calculated from the pairings, so never edit them by hand.

The shipped data is a fictional mid-event demo: rounds 1–3 are played and round 4 pairings are published.

## Registration

Validation runs entirely in the browser. Submissions are **not stored** yet. To connect a backend or
form service, replace `submitEntry` in `src/js/register.js`.

## Deploy to Vercel

Import the repository in Vercel. `vercel.json` already sets the install command (`npm ci`), the build command
(`npm run build`) and the output directory (`dist`), so you don't need to configure anything in the dashboard.
