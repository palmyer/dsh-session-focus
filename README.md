# dsh-session-focus

> A fork of [TianYa-DAO/dsh-pinned-sessions](https://github.com/TianYa-DAO/dsh-pinned-sessions).
> The original aggregates only its own pin list; this fork also merges **DSH's own registry pin set**
> (`workspaces.pinnedSessionIds`) into the same section, so sessions pinned through the shipped "..." menu
> show up at the top too.

Keeps every session you must not lose track of in one section at the top of the DSH Web sidebar: pinned, running, finished-but-unopened, and currently open.

English | [中文](README.zh.md)

## Differences from the original

| | dsh-pinned-sessions | dsh-session-focus (this fork) |
|---|---|---|
| Sessions pinned from this plugin's menu | ✅ | ✅ |
| **Sessions pinned through DSH natively** | ❌ not read | ✅ merged into the same section, listed first |
| Running / Unread / Open now groups | ✅ | ✅ |
| Pinned workspaces | ✅ | ✅ |

A natively pinned session stays under the Host's control: it is unpinned from the shipped "..." menu row,
and this plugin deliberately does not add a second control that would only clear the local list.

## What the pinned section holds

In this order, below the region header and above every workspace group:

```
sidebar
├─ Workspaces            ← the region header (search / view options / add workspace)
├─ Pinned                ← added by this plugin
│   ├─ Pinned 2          ← native pins + plugin pins, merged and deduped
│   │   ● Session title…             proj
│   ├─ Running 1         ← derived from session state
│   │   ● Session title…             other
│   ├─ Unread 1
│   ├─ Open now 1
│   └─ Pinned workspaces ← workspaces pinned from their "..." menu
│       ▸ proj  4
├─ Workspace group A     ← untouched
└─ Workspace group B
```

> **The section is additive only.** It inserts its own block at the top and leaves the order, contents and visibility of every group below it alone. Expanding or folding any group never removes a row from another group.

> **Every group folds, the same way.** Running, Unread, Open now, Pinned workspaces and the pin list all use one collapsible caption: **click the whole row** (not just the chevron), or focus it and press Enter / Space. The count stays readable while folded, and each group remembers its own fold state across reloads.

1. **Globally pinned sessions** — chosen from a Session's "..." menu; they stay in their own workspace group below as well.
2. **Running / Unread / Open now** — derived from session state:

   | Group | Condition | Marker |
   |---|---|---|
   | Running | session status `running === true` | blue pulsing dot |
   | Unread | session status `completionUnread === true` (finished while you had not opened it) | green dot |
   | Open now | session retained by the main view (`retainedBy.mainView > 0`) | hollow ring |

   **A Session you have already read, with no other state, shows no marker at all** — that leading cell stays empty. Only the three states above draw something.

   These three groups are **mutually exclusive**, ranked `running > unread > open now` — the upstream rule, unchanged here. **A globally pinned session is still listed in its state group** — the pinned part is an extra listing, so expanding it never shortens the groups below.

   **The selected Session is highlighted exactly as the shipped row highlights it.** The row the main view holds takes the sidebar's own selection fill — the same rule and the same theme token (`--dsw-alias-interactive-bg-hover`), with `aria-selected` set the same way — so the pinned copy and the original row read as one state and follow the theme together.
3. **Globally pinned workspaces** — chosen from a workspace's "..." menu; each renders as a collapsible group whose sessions can be opened right there. That workspace's own group stays exactly where the sidebar draws it.

Archived sessions and subagent child sessions never appear. Rows are ordered by most recent update, empty parts are omitted, and the whole section stays unrendered when every part is empty. Clicking a row opens that session.

The section renders only while sessions are grouped by workspace (the "By workspace" and "Workspace tree" view options). It hides itself when the sidebar is collapsed to the rail, when the list is switched to "In one list", and while search results are on screen — and while it is hidden, nothing is hidden from the list below either.

## Pinning and unpinning

1. A Session's "..." menu carries **Pin globally / Unpin globally** as a real entry in the shipped `sidebar.workspaces.session.menu.item` slot, alongside the shipped pin, rename, fork and archive rows.
   A session already pinned through the Host registry does not show this row again — the shipped menu already
   carries its unpin entry, and two entries for one thing would disagree with each other.
2. A workspace's "..." menu carries the same action. DSH declares no slot for that menu, so the row is portaled into the shipped popup, located from the open row's `data-row-key="workspace:<key>"`.
3. A pinned workspace header carries an unpin control that appears on hover. Its ordinary row is still there in place.

Hovering any row in the section reveals the same **`...` more** button the shipped row has: clicking it, right-clicking the row, or pressing <kbd>Shift</kbd>+<kbd>F10</kbd> / <kbd>Menu</kbd> opens the **shipped session menu**, so rename, fork, archive and pin behave exactly as on a native row, including entries other plugins contribute to that menu.

> **Nothing is drawn at rest.** Before you hover, a row's trailing edge is clean — no backdrop, no gradient, no faded button. Only the single `...` appears on hover, using the shipped row's metrics (24×24, `radius-xs`, 13px gap).

> **Why one `...` and no separate archive / pin buttons?** Those two buttons on a native row come from the shipped `sidebar.workspaces.session.row.action` seat, which only the shipped row renders; a plugin cannot render that seat again without re-declaring it. So this section does not paint a second button pair — it routes through the one shipped menu, which carries the same actions with the same semantics.

The section is inserted at the top of the list's own scroll container, so a long pinned section scrolls together with the workspace groups rather than clipping its own overflow.

## Settings

**Settings → General → Pinned sessions** switches the section off and on. Preferences (the switch, the pinned sessions, the pinned workspaces and which pinned workspaces are collapsed) persist in the shared client store under localStorage key `dsh.session-focus.prefs.v1`.

## Install

From GitHub:

```sh
dsh plugin add github:palmyer/dsh-session-focus
```

Or clone locally and link it, so later edits reload without being overwritten by upstream releases:

```sh
git clone https://github.com/palmyer/dsh-session-focus.git
dsh plugin add link:/absolute/path/to/dsh-session-focus
```

In the desktop application, install it from the Plugins page instead. The package declares `dsh.bundle`, so the profile mounts its `cordis.patch.yml` row and the client registry serves `./client.js`. It also declares `engines.dsh` (`>=0.2.0-rc.2 <0.3.0`), so the market shows the host requirement and refuses a version it cannot run.

## How it works

1. It is a client-only plugin: `client.js` loads through the dynamic client module protocol (`window.__ModuleLoader__.load`). Its overlay row registers into the additive `shell.overlay` seat, and that row owns the two portals described below.
2. The sidebar's workspace region (`sidebar.workspaces`) is a single slot with no insertion hole of its own, so the plugin neither replaces nor re-implements the shipped browser. It creates one host element and inserts it at the top of the region's own scrolling list (the element carrying the browser's `list` class, which is the `overflow-y: auto` container), inside `div[data-slot="sidebar.workspaces"]`. The host is removed when the plugin unloads.
3. Placement and mode detection read stable DOM facts: the `listArea` class locates the list area, the `projectRow` and `searchResultRow` row classes distinguish workspace grouping from the flat list and from search, and the `rail` class on the browser root marks the collapsed sidebar. A `MutationObserver` follows structural changes and a 1.5s reconciler covers the region being replaced wholesale.
4. The workspace menu row is portaled into the open menu's popup; the popup is a React portal into `document.body`, and the row it belongs to is found by `data-row-key` plus the open-state class.
5. Data comes from the client's root standard hooks (`useSessions`, `useSessionStatus`, `useWorkspaces`); opening a session goes through `ctx.get("uiWorkspace").openSession(id)`.
6. Styling uses its own `dshps-*` classes and only `--dsw-alias-*` theme tokens, so it follows the active theme and skins. The client half requires only platform modules (`react`, `react-dom`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-primitives`), so the package has no install-time npm dependencies.

## Self-check

```sh
npm test
```

Loads `client.js` through a stubbed dynamic-module protocol and checks the factory and export shape, all three `apply()` registrations (slot, id, order, shared store, inject face, bilingual dictionaries), the section derivation (priority, archived and subagent filtering, blank sessions, explicit pins, pinned workspaces) and the rendered tree.

## Known limitations

1. Placement depends on the shipped client's DOM and class names (`listArea`, `projectRow`, `searchResultRow`, `rail`, `list`). A sidebar refactor in DSH requires updating the selectors in `client.js`.
2. The workspace "..." menu row is injected because DSH declares no slot for it; a change to that popup's structure requires updating the lookup in `client.js`.
3. Client API renames can break registration; the plugin warns instead of failing silently when `uiWorkspace` is unavailable, but a renamed hook or service still needs a code update.
4. Tested against DSH `0.2.1-rc.1`; `engines.dsh` keeps the range honest about that.

## License

[MIT](LICENSE)