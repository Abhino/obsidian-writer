# Board

A desktop planning view over the notes you already plan from. Today is the
target; everything else is a source you move lines out of.

It is a second PWA in this repo, deliberately not a second app: same
origin, same `inbox.cfg` in localStorage, so the backend URL and token you
entered in the capture app are already here. Its service worker scopes to
`/dashboard/`, so the two shells never evict each other.

## Install

1. Copy `dashboard/` into the repo that serves the capture PWA, beside
   `index.html`. It is served at `<your pages url>/dashboard/`.
2. Copy `board.py` next to `main.py` in the Cloud Run service and apply
   `main.py.patch.md`. No new dependency; `COPY . .` already picks it up.
3. Open the board. If the capture app has been used on this browser, there
   is nothing to configure.

`ALLOWED_ORIGIN` needs no change — same origin as before.

## Environment

The board reads three notes the service didn't know about. Defaults match
the vault as it stands; override if you move them.

| Variable | Default |
| --- | --- |
| `APPEND_REVIEW_PATH` | `02 Append and Review Note.md` |
| `STALLED_PATH` | `Stalled, New Project List.md` |
| `AAR_OPEN_CATEGORIES` | `India things to do,Restaurants,To Watch` |

Everything else — the priorities note, the inbox, Future Days, the month
files — comes from the variables already set.

## How the stalled note is read

`Stalled, New Project List.md` is a **mixed scratchpad**, not a project
list. It does NOT need labels. The board scans the whole note and groups by
the nearest heading, so a scratchpad like this works as-is:

```markdown
##### Need to Start Right away
- [[Office Trip Return to USA Oct 2026]]
- [ ] Loft sofa - new project to find a recliner use meta muse
##### Need to Start in future
- [ ] Autonomus Trading Bot
	- [ ] https://github.com/TraderAlice/OpenAlice
- [[AI Testing]]
	- [ ] Use Venice AI and sample prompt ideas?
- Skydiving
```

Only an explicit `- [[wikilink]]` bullet is a **project**. It and its
indented checkboxes are shown in the Projects view, under their source
heading. Everything else is **loose work** shown in the Stalled view:

- `- [ ] text` — a task
- `- text` — a plain task/idea, shown without a checkbox
- indented lines — kept as that item's sub-items; the row says how many,
  and converting the item carries them into the new project

Checked tasks are history and are dropped. The old rule — every top-level
checkbox was a project — is what made the Stalled view look like a project
list. It no longer applies.

## Converting a task to a project

`⇢` on any task opens the move sheet. **Convert to project…** asks for a
project name (prefilled from the task) and:

- in Stalled, rewrites the line in place to `- [[Name]]` — its heading and
  sub-items stay put;
- in Priorities, moves a loose task or a next action to a `Top Projects:`
  bullet;
- from Today / Inbox / Future, first parks the task in Active or Stalled,
  then promotes it there.

If a project with that name already exists, the conversion is refused
rather than merging silently. A next action that has its own sub-items is
also refused, so nothing is orphaned. Every conversion is visible in the
Projects view immediately.

## What a move does

Every move is a real move: the line leaves the source and lands at the
target, so there is still exactly one live copy. The destination is
written first and the source cleared second — a failure in between leaves
a duplicate, which the next load flags, never a lost task.

The `⇢` button on a task row opens the full destination menu: Today,
Tomorrow, any Future Days date, Inbox, Priorities, every active or stalled
project, and Review categories.

| Moved to | What is written |
| --- | --- |
| Today | under `### Today Tasks` (or `### Project Tasks`, nested under that project's bullet, when it came from one) |
| a Future Days date | under that date, nested under its project bullet if it has one |
| a project | a subtask of that project |
| a Review category | a plain bullet at the top of that category — storage, not a task |

Order still matters in one place: a project's first open subtask is its
next action. The move menu does not reorder tasks inside a pane.

## Projects

The Projects view merges the active `Top Projects:` bullets with the
stalled `[[wikilink]]` projects. Each project shows its source
(active/stalled), its open next-action count, the first unchecked subtask,
and how many dated tasks are parked for it in Future Days. The
**All / Active / Stalled** filter remembers its choice in
`board.projFilter`. Two endpoints back the inline add lines:

- `POST /projects/add` `{name}` — append `- [[name]]` to Top Projects.
- `POST /stalled/projects/add` `{name}` — park a project in the stalled note.
- `POST /project/task` `{project, text}` — file a next action at the top
  of that project's subtasks (Top Priorities first, then the stalled
  list).
- `POST /project/move` `{name, from, to}` — move a whole project and its
  next actions between `priorities` and `stalled`.
- `POST /project/from-task` `{text, from, name}` — promote a task or next
  action into a project (see above).

Both creation endpoints are idempotent; rerunning either never duplicates
a line. Each project card has a `→ priorities` / `→ stalled` button that
uses `/project/move`.

## Review is long-term storage

Review categories — restaurants, places to watch, things to do — hold
plain bullets, not tasks. They are destinations for archiving a task or
idea, and the Review view has its own add line so you can store something
directly. `/daily` never reads them, they never appear on Today, and they
have no checkbox or schedule. A stored item can be renamed or removed;
there is deliberately no “move it back to a task” button.

## Removing

There is no destructive delete. `×` on a row or `Backspace` on a focused
row removes the line, and git history keeps it. Every removal has a
five-second undo, so a stray click is never an erasure.

## Reloading is manual

The board never reloads itself. A move writes to the vault and removes the
row from its source lane — it does not re-fetch, because rebuilding the
whole board after every move threw away your scroll position and the
groups you had open.

`↻` reloads. So does changing day, and so does an undo. When something is
unsaved or stale the status line says so (`edited · ↻`, `4m old · ↻`)
rather than acting on it. A failed move reloads on its own, because at
that point the screen and the vault disagree.

## The rest of it

- **Date picker in the header** plans any day. Past days render as the
  record they are.
- **`defer view`** shades every unfinished task with where `/defer` would
  send it tomorrow: `stays`, `→ project`, `→ future`.
- **Type into the day** to add a task straight to it.
- **`✎`** renames in place, **`◷`** schedules for a date, **`⇢`** moves to
  any destination: a date, Inbox, Priorities, a project, or Review.
- **Undo** on every move, for five seconds. It is the same call with the
  ends swapped.
- **Keys**: `←` `→` change day, `r` reloads, `Esc` closes a sheet,
  `Backspace` removes the focused row.
- A warning bar appears when two open tasks normalize to the same text,
  because `/check` cannot tell them apart.

## Endpoints

`GET /board?date=` — every pane in one round trip, all notes read in
parallel plus the calendar.

`POST /move` — `{text, new_text?, from, to, position?}`, where an address
is `{pane, date?, project?, category?, section?, plain?}` and `pane` is one
of `day`, `future`, `inbox`, `priorities`, `stalled`, `aar`. `section` and
`plain` keep a stalled row inside its heading and keep an idea a plain
bullet. A `block` key is still accepted in `to` for compatibility with
older clients but is ignored — the day is one flat list now.

`POST /projects/add` — `{name}`; `POST /project/task` — `{project, text}`;
`POST /project/from-task` — `{text, from, name}`.

## Tests

`test_board.py` (parsers and mutations against the real note samples),
`test_roundtrip.py` (a project task through Future Days and home again),
`test_e2e.py` (real moves in a real browser against `fakevault.py`, which
runs the actual service over an in-memory vault).

```
python3 test_board.py && python3 test_roundtrip.py
python3 fakevault.py &                  # port 8099
(cd dashboard && python3 -m http.server 8098) &
python3 test_e2e.py
```

## Bumping the shell

`sw.js` serves the shell cache-first. Change `index.html` and you must
bump `CACHE` in `sw.js`, or the browser keeps running the old board.
