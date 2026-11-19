# AGENTS.md — obsidian-writer

Two phone-installable PWAs over the same vault, served as plain static
files from GitHub Pages:

- `index.html` + `sw.js` + `manifest.webmanifest` — the **capture app**
  (root, `<pages url>/`): compose targets inbox / today / outside /
  project, a Today tab fed by `/today` + `/context`, pinned lists.
- `dashboard/` — the **board**, the desktop planning view (sidebar, day,
  calendar rail, drag-to-move). Same origin as the capture app, scoped
  under `/dashboard/` so its service worker never evicts the capture
  shell.

Both are single-file apps: **all HTML, CSS and JS is inline in each
`index.html`** — vanilla JS, no framework, no build step, no npm. The
only vendored dependency is `dashboard/sortable.min.js`.

## Hard rules

- **Bump `CACHE` in `sw.js` (and `dashboard/sw.js`) on EVERY change to
  that app's `index.html`.** The shell is served cache-first; a stale
  version string means the phone keeps running the old app no matter
  what was deployed. This bites on every edit — version strings are
  e.g. `inbox-shell-v16`.
- **API responses are never cached.** The service workers only cache
  same-origin GETs (the shell); every call to the backend hits the
  network, and the app's own offline queue handles failures. A cached
  `/today` would show a stale day — the exact problem these apps exist
  to avoid.
- **The offline queue stores the WHOLE destination descriptor**
  (`{id, text, ts, dest, target, project, top}`), not just
  `{id, text, ts}`. It once kept only the short form and an offline
  errand or project capture silently landed in the inbox. Related
  invariant: `postBody()` is the one body builder for both the live
  send and the queue replay, so the two paths can never disagree about
  what a capture meant.
- **`flush()` stops on the first failure and keeps queue order** — a
  tunnel shouldn't reorder a day's thoughts. `force=true` (settings
  save, manual retry) overrides the `navigator.onLine` check only.
- **The board never reloads itself.** A drag writes to the vault and
  leaves the row where it landed; `↻` / day change / undo are what
  re-fetch, because reloading after every move threw away scroll
  position and open groups.
- There is no delete: drops go to `Dropped.md`, removals are moves, and
  destructive-sounding UI actions always have an undo or a file to open.

## Conventions

- `use strict` IIFE, `const $ = id => document.getElementById(id)`,
  `el(tag, cls)` helper. Keep additions in the same voice.
- CSS custom properties live in `:root` of each `index.html`; both apps
  share the same dark palette and fonts (Hanken Grotesk + JetBrains
  Mono via Google Fonts).
- localStorage keys are namespaced `inbox.*` and **shared between the
  two apps** (same origin): `inbox.cfg` `{url, token, target, outside}`,
  `inbox.composeTarget`, `inbox.project`, `inbox.projTop`,
  `inbox.projects`, `inbox.queue`, `inbox.pins`. Config entered in the
  capture app is already configured in the board — don't add a second
  config store.
- `hidden` is not enough on its own: the browser default only wins
  against rules that don't set `display`, so the stylesheet carries
  `[hidden]{display:none !important}` AND `switchView` sets inline
  `style.display` for the `.today` flex panes. Read the comment at that
  rule before touching view toggling.
- Comments explain why a rule exists and what bug it closes; if you
  change a rule, change its comment in the same edit.

## Backend contract

The backend URL and token are user config (`inbox.cfg`), not build-time.
Endpoints this app consumes (auth: `Authorization: Bearer <token>`):

| Endpoint | Used by | Purpose |
| --- | --- | --- |
| `GET /health` | capture · Test connection | reachability |
| `POST /capture` | capture composer | `{text, ts, dest, target?/project?, top?}` |
| `GET /today` | capture Today tab | today's section as task JSON |
| `GET /context` | capture Today tab | live calendar + weather (parallel with /today) |
| `GET /list`, `POST /list/check` | outside tab + pins | standing lists, cross-file tick |
| `GET /projects` | project picker | `Top Projects:` bullets |
| `POST /check`, `/more`, `/rough` | Today actions | toggle, top-up, cut back |
| `GET /board`, `POST /move`, `/pin/*`, `/projects/add`, `/stalled/projects/add`, `/project/task`, `/project/move` | dashboard + PWA | one-round-trip panes, drags, pin edits, project creation/moves |

Behavioral truth for these lives in `../cloudrun_obsidian_writer/` (see
its AGENTS.md). Changing a payload shape is a coordinated edit across
both directories; the backend sends `tags`/`title` alongside `text`
because tags live in the task text and `/check` matches on it.

## Deploy

Any HTTPS static host; the live one is GitHub Pages at
`https://abhino.github.io/obsidian-writer/`, with the board copied as
`dashboard/` beside `index.html`. HTTPS is required for PWA install and
the service worker. After deploying UI changes, remember the CACHE bump
rule above — the deploy isn't done until the version string moved.
