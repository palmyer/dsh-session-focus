# Changelog

## [0.3.0-fork.10] - 2026-11-12

1. **The grey dot on already-read Sessions is gone.** The base `.dshps-dot` carried `background:var(--dsw-alias-label-tertiary)`, and `dotOf` returns an empty state for a Session that is neither running, unread, nor open. The class was therefore still applied on its own, so every read Session rendered a grey marker. The base class now paints `transparent`, leaving the leading cell empty for those rows.
2. The other two states are untouched: running keeps its pulsing dot, unread its green dot, and the open Session its hollow ring (`box-shadow: inset`), which is unchanged.
3. Self-checks assert the base rule paints nothing, does not fall back to a grey token, and that the open Session still carries its own ring rule.

## [0.3.0-fork.9] - 2026-11-12

1. **The `running > unread > open now` exclusivity is restored.** `0.3.0-fork.8` had turned the three state groups into independent membership so a Session could appear in several of them. That was a behaviour change on top of the requested fix and it is reverted: the derivation is now byte-for-byte the upstream `if / else if / else if` chain again.
2. What remains from the earlier work is only the fix that was actually asked for: a pinned Session is no longer skipped while collecting the state groups, so opening the pinned list does not shorten the other groups. That line was the only change left in the derivation, and the UI work from `0.3.0-fork.3` through `0.3.0-fork.7` is untouched.
3. Self-checks were rewritten to assert the exclusive semantics instead: a running open Session is reported under Running only, a resumed Session under Running only, and an unread open Session under Unread only.

## [0.3.0-fork.8] - 2026-11-12

1. **Fixed: 「待查看」 and 「当前打开」 could vanish.** The three state groups were ranked in one `else if` chain (running > unread > open), a rule inherited from upstream. That made a group disappear whenever a more important fact applied to its only member — the common case being the Session you were looking at also running, which emptied 「当前打开」 entirely, and a Session resuming while it still had an unread completion, which emptied 「待查看」. An empty group is dropped, so the rows seemed to vanish from the section.
2. The groups are now independent facts, matching how the shipped row presents the same Session (a running row still carries the open Session's selection fill). A Session that is running **and** on screen appears in both groups. `待查看` keeps one guard: a Session that is running again is no longer "finished unread", so the stale flag does not keep it there.
3. The explicit pin list stays independent, as before: pinning never removes a Session from any state group, and no state group can remove a Session from the pin list.
4. Self-checks pin the corrected semantics: a running open Session is listed under both groups, a resumed Session leaves Unread, and an unread open Session is listed under both.

## [0.3.0-fork.7] - 2026-11-12

1. **The stray gradient strip is gone.** The hover cluster used to paint its own `linear-gradient` backdrop while its buttons stayed at `opacity:0`, so at rest a row showed a permanent vertical fade on its right edge with nothing inside it. The backdrop is removed; nothing is painted at rest.
2. **Hover now reveals one control instead of a parallel implementation.** The cluster held a hand-built `×` unpin button plus a `…` trigger; the `×` is gone. What remains is the shipped session menu trigger, which opens the same menu the row below opens — same items, same actions, including rename / fork / archive / pin and anything other plugins contribute. The reason is structural: the shipped `sidebar.workspaces.session.row.action` seat is rendered by the shipped row itself, and a plugin cannot render it again without re-declaring that slot, so a second archive/pin pair would have been exactly the duplicate this section is meant to avoid.
3. Metrics now follow the shipped `.iconButton` / `.rowActions`: 24×24 buttons, `radius-xs`, 13px gap, `display:none` at rest instead of transparent, and the resting workspace label hides on hover so the two clusters never overlap.
4. Self-checks assert that the cluster holds exactly one control, that it carries `aria-haspopup="menu"`, and that clicking it opens the shipped menu for that Session rather than acting on the row itself.

## [0.3.0-fork.6] - 2026-11-12

Every group in the pinned section now folds, through one mechanism.

1. **Running / Unread / Open now fold like the pin list did.** Their captions were static text; the chevron existed only on the pin list. All of them now render through a shared `GroupCaption` / `CollapsibleGroup` pair, so the whole caption row is the control — not the chevron alone — with `role="button"`, `aria-expanded`, `tabIndex=0` and Enter / Space handling. The chevron is a decorative glyph that mirrors the state.
2. **The pinned-workspaces caption folds too.** It was the last static caption. Collapsing it hides the workspace groups while the per-workspace chevrons keep working.
3. **Fold state is per group and persisted.** A new `collapsedStatusGroups` list in the same store (`dsh.session-focus.prefs.v1`) records which captions are folded, keyed by the group's own key, so folding Running never folds Unread and the choice survives a reload. Older persisted state has no such field and reads as "everything expanded".
4. The two fold paths that already existed (`sessionPinsCollapsed` for the pin list, `collapsedWorkspaces` for each pinned workspace) are unchanged, so a saved layout keeps working.
5. Self-checks now assert the shared contract on every group, that each group hides its own rows when folded, and that folding one group leaves its siblings expanded.

## [0.3.0-fork.5] - 2026-11-12

1. A Session row in the pinned section now shows the **shipped selection highlight** when it is the Session the main view holds. The row was previously indistinguishable from its neighbours apart from the hollow status dot. The treatment is copied verbatim from the sidebar's own rule, read from the shipped bundle: `.wnFoaW_sessionRow.wnFoaW_selected{background-color:var(--dsw-alias-interactive-bg-hover)}` — same token, same `aria-selected` attribute — so the pinned copy of an open Session looks selected for the same reason the original row does, and follows the theme with it.
2. `deriveSections` now tags the retained row with `selected`, alongside the existing `dot`. No new state and no second notion of "current": it is the same `retainedBy.mainView > 0` predicate the sidebar uses.
3. Self-checks cover the flag and the rendered row (`dshps-selected` + `aria-selected="true"`), and assert an ordinary row stays unselected.

## [0.3.0-fork.4] - 2026-11-12

1. The **Global pins** caption is now clickable across its whole row, not just on the 16px chevron. The row carries `role="button"`, `aria-expanded`, a full-width hover fill and Enter / Space handling, so folding the list no longer requires hitting a small glyph. The chevron is now a decorative `aria-hidden` marker that mirrors the state; `dshps-groupToggle` is gone.
2. Row height, indent and the caption text are unchanged — only the hit area and its hover feedback changed.

## [0.3.0-fork.3] - 2026-11-12

The pinned section overrode the rest of the sidebar. Opening it took rows away from other groups, and pinning a workspace made its own group vanish. Both are gone: the section is now purely additive.

1. The explicit pin list no longer removes its Sessions from the **Running / Unread / Open now** groups. Expanding the pin list previously emptied those groups row by row, so the layout below the section changed depending on a fold state. A pinned Session is now listed twice — once at the top, once in its own group — and expanding or collapsing changes this part only. `sessionPinsCollapsed` stays as a fold control for the pin list itself.
2. Pinning a workspace no longer hides that workspace's group or its member Session rows in the list below. The `useGroupHiding` stylesheet writer is now a no-op that only clears rules an older build may have left behind, so upgrading cannot keep rows hidden.
3. Defaults unchanged: the pin list still starts expanded; only the fold behaviour it used to drive is gone.
4. Self-checks updated to assert the additive contract instead of the old exclusion: pinned sessions keep their status group, all three groups render, and folding changes nothing outside the pin list.

## [0.3.0-fork.2] - 2026-11-11

1. The explicit pin list (**Global pins**) now renders LAST in the section: live state groups (running / unread / open now) come first, then pinned workspaces, then the pin list. A long pin list no longer pushes the live groups out of sight.
2. A pinned row now carries the same hover affordances as the shipped row: a `...` button that opens the SHIPPED session menu (via `contextMenus.open({ kind: "session" })`), so rename / fork / archive / pin are identical to the native row and include contributions from other plugins. Right-click, the Context Menu key and Shift+F10 open it too.
3. Row actions moved into an absolutely positioned cluster, and the row clips its own overflow: revealing them on hover no longer reflows the title, and they can never paint over the neighbouring rows. The cluster is not rendered at all when it would hold nothing.
4. `contextMenus` added to the plugin inject list; without it the `...` button degrades away and the rest of the section still works.

## [0.3.0-fork.1] - 2026-11-11

Forked from `dsh-pinned-sessions` 0.2.1 as `dsh-session-focus`.

1. The top section now also lists sessions pinned through **DSH's own registry pin set** (`workspaces.pinnedSessionIds`), merged with the plugin's own pins and deduplicated. Host pins are listed first, matching the registry's most-recently-pinned-first order.
2. A Host-pinned row carries `hostPinned` and no longer renders the inline `×`: its unpin entry stays in the shipped "..." menu, so there is no second control that would only clear the local list.
3. The session menu row **Pin globally** is suppressed for a session the Host already pinned, for the same reason.
4. Package renamed to `dsh-session-focus`; plugin id, locale namespace, client module id, CSS style ids, `data-*` host attributes and the persisted store key (`dsh.session-focus.prefs.v1`) follow the new name.

---

Changes inherited from upstream:

## [0.2.1] - 2026-10-20

1. A small chevron on the left of the "Pinned" caption folds that part to its heading; the count stays readable and the folded state persists.
2. While that part is folded, its Sessions return to the Running / Unread / Open now groups, so folding never hides a Session that is still working.
3. Declares `engines.dsh` (`>=0.2.0-rc.2 <0.3.0`); the market shows the host requirement from it and refuses an install it cannot run.
4. Runtime hardening: the anchor resolution is cached instead of rescanning the list on every reconcile tick, an unchanged hide rule is no longer rewritten, a stale pin is pruned after a 60s grace, and the injected CSS fails open with a one-shot warning if it ever stops matching.
5. A pinned row's tooltip carries its last activity time.
6. The self-check covers the selector table, the fold toggle and the pin-pruning action.

## [0.2.0] - 2026-10-04

1. A Session's "..." menu gains **Pin globally / Unpin globally**, registered in the shipped `sidebar.workspaces.session.menu.item` list slot (order 450, after Archive).
2. A workspace's "..." menu gains the same action. DSH declares no slot for that menu, so the row is portaled into the shipped popup, located from the open row's `data-row-key="workspace:<key>"`.
3. The pinned section is now three parts, in this order: globally pinned sessions, the derived Running / Unread / Open now groups, then globally pinned workspaces. A globally pinned session is left out of the status groups; the dot on its pinned row carries that state instead.
4. A globally pinned workspace renders as a collapsible group in the pinned section (its sessions are listed and openable there), and its own group is hidden from the list below while it is pinned. Unpinning restores it.
5. A globally pinned session stays in its own workspace group below, as before.
6. The section is inserted at the top of the list's own scroll container, so a long pinned section scrolls together with the workspace groups instead of clipping its own overflow.
7. Pinned sessions, pinned workspaces and collapsed pinned workspaces persist in the shared client store.

## [0.1.0] - 2026-09-30

Initial release.

1. Pinned section above the workspace groups in the DSH Web sidebar, holding running sessions, sessions that finished while unopened, and the session currently open.
2. Group captions (Running / Unread / Open now), per-group counts, and a status marker per row.
3. Settings → General switch backed by a persisted client store.
4. Shown only in the workspace-grouped views; hidden in the collapsed rail, in the flat list, and while search results are on screen.
5. Self-check harness covering the module protocol, both slot registrations, the group derivation and the rendered tree.