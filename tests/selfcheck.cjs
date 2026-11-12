/**
 * Local self-check for this plugin — loads the shipped client source through a
 * stubbed dynamic-module protocol, runs apply() against a fake Cordis ctx, and
 * exercises the section derivation and the rendered tree.
 */
const fs = require('fs')
const vm = require('vm')
const path = require('path')
const assert = require('assert')

const CLIENT = path.join(__dirname, '..', 'client.js')
let source = fs.readFileSync(CLIENT, 'utf8')
source = source.replace(
  'exports.name = "dsh-session-focus";',
  'exports.__debug = { deriveSections: deriveSections, baseName: baseName, toggleIn: toggleIn, cssEscape: cssEscape, PinnedSection: PinnedSection, dotOf: dotOf, SELECTORS: SELECTORS };\n        exports.name = "dsh-session-focus";',
)

let captured = null
const sandbox = {
  console,
  window: { __ModuleLoader__: { load: (options) => { captured = options } }, setInterval: () => 0, clearInterval: () => {} },
  document: {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, setAttribute() {}, appendChild() {} }),
    getElementById: () => null,
    head: { appendChild() {} },
    body: { children: [] },
  },
  MutationObserver: class { observe() {} disconnect() {} },
  KeyboardEvent: class {},
  setInterval: () => 0,
  clearInterval: () => {},
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'client.js' })

assert.ok(captured !== null, 'module loader entry was not captured')
assert.strictEqual(captured.id, 'dsh-session-focus')

const h = (type, props, ...children) => ({ type, props: props || {}, children })
const fakeReact = {
  createElement: h,
  Fragment: 'Fragment',
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
}
const fakeStore = { defineStore: (spec) => ({ spec }) }
const fakePrimitives = {
  MenuItemButton: (props) => h('menuitem-button', props, props.children),
  IconPinFillRegular: (props) => h('pin-fill', props),
  IconPinOutlineRegular: (props) => h('pin-outline', props),
}
const moduleExports = captured.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react-dom') return { createPortal: (children, container, key) => ({ portal: children, container, key }) }
  if (name === '@deepseek-ai/dsh-client-store') return fakeStore
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return fakePrimitives
  throw new Error('unexpected require: ' + name)
})

assert.strictEqual(typeof moduleExports.apply, 'function')
// Arrays built inside the vm realm have a different Array prototype; compare by value.
assert.strictEqual(moduleExports.inject.join(','), 'slots,locale,contextMenus')

// ---- apply() wiring -------------------------------------------------------
const registrations = []
let localeDicts = null
const SLOTS = ['shell.overlay', 'sidebar.workspaces.session.menu.item', 'settings.general.item']
const ctx = {
  effect: (factory) => { factory(); return () => {} },
  locale: { register: (ns, dicts) => { assert.strictEqual(ns, 'session-focus'); localeDicts = dicts; return () => {} } },
  slots: {
    inject: (name, callback) => {
      assert.ok(SLOTS.includes(name), 'unexpected slot ' + name)
      callback()
      return () => {}
    },
    register: (options, component) => { registrations.push({ options, component }); return () => {} },
  },
  get: (name) => (name === 'uiWorkspace' ? { openSession: () => {} } : undefined),
}
moduleExports.apply(ctx)

assert.strictEqual(registrations.length, 3, 'expected three registrations')
const bySlot = (name) => registrations.find(r => r.options.name === name)
const overlay = bySlot('shell.overlay')
const sessionMenu = bySlot('sidebar.workspaces.session.menu.item')
const settings = bySlot('settings.general.item')
assert.ok(overlay && sessionMenu && settings, 'missing registration')
assert.strictEqual(overlay.options.id, 'session-focus')
assert.strictEqual(overlay.options.locale, 'session-focus')
assert.strictEqual(sessionMenu.options.order, 450, 'the menu row sits after the shipped rows (100/200/300/400)')
assert.strictEqual(sessionMenu.options.locale, 'session-focus')
assert.strictEqual(typeof overlay.options.inject, 'function', 'overlay needs the openSession face')
assert.strictEqual(Object.keys(overlay.options.inject()).join(','), 'openSession,openMenu')
assert.ok(localeDicts && localeDicts.zh && localeDicts.en, 'dictionaries not registered')
const handles = new Set([overlay.options.store, sessionMenu.options.store, settings.options.store])
assert.strictEqual(handles.size, 1, 'all three rows must share one store handle')
assert.ok(overlay.options.store.spec.persist, 'the shared store persists')
assert.strictEqual(typeof overlay.options.store.spec.actions.toggleSession, 'function')
assert.strictEqual(typeof overlay.options.store.spec.actions.toggleWorkspace, 'function')
assert.strictEqual(typeof overlay.options.store.spec.actions.toggleWorkspaceOpen, 'function')
assert.strictEqual(typeof overlay.options.store.spec.actions.pruneSessions, 'function')
const pruned = { pinnedSessions: ['a', 'b', 'c'] }
overlay.options.store.spec.actions.pruneSessions(pruned, ['b'])
assert.strictEqual(pruned.pinnedSessions.join(','), 'a,c', 'a stale pin is dropped and the rest keep their order')
const initial = overlay.options.store.spec.init()
assert.strictEqual(initial.enabled, true)
assert.strictEqual(initial.pinnedSessions.join(','), '')
assert.strictEqual(initial.pinnedWorkspaces.join(','), '')
assert.strictEqual(initial.sessionPinsCollapsed, false, 'the global-pin group starts expanded')
assert.strictEqual(typeof overlay.options.store.spec.actions.toggleSessionPinsCollapsed, 'function')
const pinsDraft = { sessionPinsCollapsed: undefined }
overlay.options.store.spec.actions.toggleSessionPinsCollapsed(pinsDraft)
assert.strictEqual(pinsDraft.sessionPinsCollapsed, true, 'one click collapses the global-pin group')
overlay.options.store.spec.actions.toggleSessionPinsCollapsed(pinsDraft)
assert.strictEqual(pinsDraft.sessionPinsCollapsed, false, 'the next click expands it again')

// ---- derivation -----------------------------------------------------------
const { deriveSections, baseName, toggleIn, cssEscape, PinnedSection, dotOf, SELECTORS } = moduleExports.__debug

// ---- shipped-DOM selectors -------------------------------------------------
assert.strictEqual(SELECTORS.region, '[data-slot="sidebar.workspaces"]', 'the region selector is pinned by test')
assert.strictEqual(SELECTORS.workspaceRow, '[data-row-key^="workspace:"]', 'the workspace row selector is pinned by test')
assert.ok(SELECTORS.scrollerToken.test('_9lTDKa_list'), 'the scroller class token matches a scoped `list` class')
assert.ok(!SELECTORS.scrollerToken.test('_9lTDKa_listArea'), 'the list area is not mistaken for the scroller')
assert.ok(SELECTORS.railToken.test('_9lTDKa_root _9lTDKa_rail'), 'the rail class token matches a scoped `rail` class')
assert.ok(!SELECTORS.railToken.test('_9lTDKa_root'), 'a normal root is not the rail')
const eq = (actual, expected, message) => assert.strictEqual(actual.join('|'), expected.join('|'), message)

const summary = (id, extra) => Object.assign({
  id, displayTitle: 'S-' + id, blank: false, updatedAt: 1000, retainedBy: {}, cwd: 'D:\\ws\\proj',
}, extra)
const list = {
  ids: ['run', 'unread', 'open', 'plain', 'arch', 'sub', 'blankOpen'],
  byId: {
    run: summary('run', { updatedAt: 900 }),
    unread: summary('unread', { updatedAt: 800 }),
    open: summary('open', { updatedAt: 700, retainedBy: { mainView: 1 } }),
    plain: summary('plain', { updatedAt: 600 }),
    arch: summary('arch', { updatedAt: 500 }),
    sub: summary('sub', { updatedAt: 400, origin: 'subagent' }),
    blankOpen: summary('blankOpen', { updatedAt: 300, blank: true, displayTitle: '' }),
  },
}
const statuses = new Map([
  ['run', { running: true, completionUnread: false }],
  ['unread', { running: false, completionUnread: true }],
  ['open', { running: false, completionUnread: false }],
  ['plain', { running: false, completionUnread: false }],
])
const workspaces = {
  items: [
    { workspaceId: 'ws-proj', title: 'proj', path: 'D:\\ws\\proj', sessionIds: ['run', 'unread', 'open', 'plain'] },
    { workspaceId: 'ws-other', title: 'other', path: 'D:\\ws\\other', sessionIds: ['arch', 'sub', 'blankOpen'] },
  ],
  archivedSessionIds: ['arch'],
}

const derived = deriveSections(list, statuses, workspaces, {})
eq(derived.sessionPins.map(r => r.id), [])
eq(derived.statusGroups.map(g => g.key), ['group.running', 'group.unread', 'group.current'])
eq(derived.statusGroups[0].rows.map(r => r.id), ['run'])
eq(derived.statusGroups[1].rows.map(r => r.id), ['unread'])
eq(derived.statusGroups[2].rows.map(r => r.id), ['open'])
eq(derived.workspacePins.map(w => w.key), [])
assert.strictEqual(derived.statusGroups[0].rows[0].dot, 'dshps-dot-running')
assert.strictEqual(derived.statusGroups[1].rows[0].dot, 'dshps-dot-unread')
assert.strictEqual(derived.statusGroups[2].rows[0].dot, 'dshps-dot-current')
assert.strictEqual(derived.statusGroups[0].rows[0].where, 'proj')
// The open Session is the one the main view retains: that row is `selected`,
// exactly the flag the shipped row uses for its own highlight.
assert.strictEqual(derived.statusGroups[2].rows[0].id, 'open')
assert.strictEqual(derived.statusGroups[2].rows[0].selected, true, 'the open Session row is selected')
assert.strictEqual(derived.statusGroups[0].rows[0].selected, false, 'a merely running Session is not selected')

// ---- the three groups are mutually exclusive (upstream rule) ---------------
// A Session is reported under the most important fact that applies to it, in the
// order running > unread > open now. It never occupies two groups at once.
const busyList = {
  ids: ['busy'],
  byId: { busy: { displayTitle: 'S-busy', updatedAt: 5, cwd: 'D:\\ws\\proj', retainedBy: { mainView: 1 } } },
}
const busyStatuses = new Map([['busy', { running: true }]])
const busy = deriveSections(busyList, busyStatuses, workspaces, {})
eq(busy.statusGroups.map(g => g.key), ['group.running'], 'a running open Session is reported under Running only')
eq(busy.statusGroups[0].rows.map(r => r.id), ['busy'])

// Running outranks a stale unread flag: the Session is listed under Running only.
const resumedStatuses = new Map([['unread', { running: true, completionUnread: true }]])
const resumed = deriveSections(
  { ids: ['unread'], byId: { unread: { displayTitle: 'S-unread', updatedAt: 4, cwd: 'D:\\ws\\proj', retainedBy: {} } } },
  resumedStatuses, workspaces, {},
)
eq(resumed.statusGroups.map(g => g.key), ['group.running'], 'a resumed Session is listed under Running only')

// Unread outranks open now: an unread Session that is also the open one is
// listed under Unread only.
const unreadOpenStatuses = new Map([['open', { completionUnread: true }]])
const unreadOpen = deriveSections(list, unreadOpenStatuses, workspaces, {})
eq(unreadOpen.statusGroups.map(g => g.key), ['group.unread'], 'an unread open Session is listed under Unread only')

// explicit pins: order kept, archived/subagent/unknown members dropped, and the
// pin list is ADDITIVE — a pinned Session stays in its own status group too, so
// opening the pinned list never moves a row out of the groups below it.
const pinned = deriveSections(list, statuses, workspaces, {
  pinnedSessions: ['plain', 'run', 'arch', 'sub', 'gone'],
  pinnedWorkspaces: ['ws-other', 'ws-missing'],
})
eq(pinned.sessionPins.map(r => r.id), ['plain', 'run'])
assert.strictEqual(pinned.sessionPins[1].dot, 'dshps-dot-running', 'a pinned row carries its own state dot')
eq(pinned.statusGroups.map(g => g.key), ['group.running', 'group.unread', 'group.current'], 'pinned Sessions keep their status group')
eq(pinned.statusGroups[0].rows.map(r => r.id), ['run'], 'a pinned running Session is still listed under Running')
eq(pinned.statusGroups[1].rows.map(r => r.id), ['unread'])
eq(pinned.workspacePins.map(w => w.key), ['ws-other'])
assert.strictEqual(pinned.workspacePins[0].title, 'other')
eq(pinned.workspacePins[0].sessions.map(r => r.id), [], 'archived, subagent and non-current blank members are dropped')

// collapsing the explicit pins changes nothing else: the state groups are the
// same either way, which is the whole point of an additive pin list.
const folded = deriveSections(list, statuses, workspaces, {
  pinnedSessions: ['run'],
  sessionPinsCollapsed: true,
})
eq(folded.sessionPins.map(r => r.id), ['run'])
eq(folded.statusGroups[0].rows.map(r => r.id), ['run'], 'a collapsed pin group leaves the state groups untouched')
eq(folded.statusGroups.map(g => g.key), ['group.running', 'group.unread', 'group.current'])

// blank Sessions appear only while they are the open one
list.byId.open.retainedBy = {}
list.byId.blankOpen.retainedBy = { mainView: 1 }
const blankCurrent = deriveSections(list, statuses, workspaces, { pinnedWorkspaces: ['ws-other'] })
eq(blankCurrent.workspacePins[0].sessions.map(r => r.id), ['blankOpen'])
assert.strictEqual(blankCurrent.workspacePins[0].sessions[0].blank, true)
list.byId.blankOpen.retainedBy = {}
list.byId.open.retainedBy = { mainView: 1 }

// absent/partial inputs never throw
eq(deriveSections(null, null, null, null).statusGroups, [])
eq(deriveSections({ ids: [], byId: {} }, new Map(), {}, {}).statusGroups, [])
eq(deriveSections(list, statuses, workspaces, { pinnedSessions: null, pinnedWorkspaces: undefined }).sessionPins.map(r => r.id), [])

// ---- helpers --------------------------------------------------------------
assert.strictEqual(baseName('D:\\ws\\proj\\'), 'proj')
assert.strictEqual(baseName('/home/me/proj'), 'proj')
eq(toggleIn(['a', 'b'], 'c'), ['c', 'a', 'b'])
eq(toggleIn(['a', 'b'], 'a'), ['b'])
eq(toggleIn(undefined, 'x'), ['x'])
assert.strictEqual(cssEscape('ws-"quoted"\\path'), 'ws-\\"quoted\\"\\\\path')
assert.strictEqual(dotOf({ running: true }, false), 'dshps-dot-running')
assert.strictEqual(dotOf({ completionUnread: true }, true), 'dshps-dot-unread')
assert.strictEqual(dotOf(undefined, true), 'dshps-dot-current')
assert.strictEqual(dotOf(undefined, false), '')

// A row with no state of its own must render an EMPTY cell. The base `.dshps-dot`
// class therefore paints nothing; a grey base fill would put a dot on every
// already-read Session, while the hollow ring for the open one is unchanged.
const cssText = fs.readFileSync(CLIENT, 'utf8')
const baseDotRule = /\.dshps-dot\{[^}]*\}/.exec(cssText)
assert.ok(baseDotRule !== null, 'the base dot rule exists')
assert.ok(
  /background:\s*transparent/.test(baseDotRule[0]),
  'the base dot paints nothing, so an already-read row shows no marker',
)
assert.ok(
  !/background:\s*var\(--dsw-alias-label-(tertiary|secondary)\)/.test(baseDotRule[0]),
  'the base dot does not fall back to a grey fill',
)
const currentDotRule = /\.dshps-dot-current\{[^}]*\}/.exec(cssText)
assert.ok(currentDotRule !== null, 'the open Session still has its own ring rule')
assert.ok(
  /box-shadow:inset/.test(currentDotRule[0]),
  'the open Session keeps its hollow ring unchanged',
)

// ---- presentation ---------------------------------------------------------
const t = (key, params) => (params ? key + ':' + JSON.stringify(params) : key)
const parts = {
  sessionPins: pinned.sessionPins,
  statusGroups: pinned.statusGroups,
  workspacePins: pinned.workspacePins,
}
const openedMenus = []
const tree = PinnedSection({
  parts,
  collapsedWorkspaces: [],
  sessionPinsCollapsed: false,
  collapsedStatusGroups: [],
  toggleStatusGroup: () => {},
  toggleSessionPinsCollapsed: () => {},
  t,
  openSession: () => {},
  openMenu: (sessionId, displayTitle, point) => { openedMenus.push({ sessionId, displayTitle, point }); return true; },
  unpinSession: () => {},
  unpinWorkspace: () => {},
  toggleWorkspaceOpen: () => {},
})
assert.strictEqual(tree.type, 'div')
assert.strictEqual(tree.children[0].children[0], 'heading')
// Order: live state groups first, then pinned workspaces, then the explicit
// pin list last, so a long pin list never pushes the live groups away.
assert.strictEqual(tree.children[1].length, 3, 'all three state groups sit directly under the heading')
assert.strictEqual(tree.children[1][0].type.name, 'StatusGroup')
assert.strictEqual(tree.children[3].type.name, 'SessionPinGroup')
// Every group now renders through CollapsibleGroup + GroupCaption, so the caption
// is reached the same way for the state groups and the pin list.
const renderGroup = (element) => {
  // Group component -> CollapsibleGroup element -> its rendered div (caption + rows).
  const collapsible = element.type(element.props)
  const rendered = collapsible.type(collapsible.props)
  const captionElement = rendered.children[0]
  return {
    caption: captionElement.type(captionElement.props),
    rows: rendered.children[1],
  }
}
const pinGroup = renderGroup(tree.children[3])
const pinCaption = pinGroup.caption
// The whole caption row is the control, so the collapse state and the click
// handler live on the row itself; the chevron is a decorative glyph in its gutter.
assert.strictEqual(pinCaption.props.className, 'dshps-groupHeader', 'the caption row itself is the collapse control')
assert.strictEqual(pinCaption.props.role, 'button')
assert.strictEqual(pinCaption.props.tabIndex, 0)
assert.strictEqual(pinCaption.props['aria-expanded'], 'true')
assert.strictEqual(typeof pinCaption.props.onClick, 'function', 'clicking anywhere on the row toggles it')
assert.strictEqual(pinCaption.children[0].props.className, 'dshps-groupChevron dshps-groupChevronOpen', 'the chevron is decorative and mirrors the state')
assert.strictEqual(pinCaption.children[0].props['aria-hidden'], 'true')
assert.strictEqual(pinCaption.children[1].children[0], 'group.sessionPins')
const pinRows = pinGroup.rows.map(element => element.type(element.props))
assert.strictEqual(pinRows.length, 2)
assert.strictEqual(pinRows[0].children[1].children[0], 'S-plain')
const pinRow = pinRows[1]
assert.strictEqual(pinRow.props.className, 'dshps-row', 'an unselected row carries no selected class')
assert.strictEqual(pinRow.props['aria-selected'], 'false')
assert.strictEqual(pinRow.children[0].children[0].props.className, 'dshps-dot dshps-dot-running')
assert.strictEqual(pinRow.children[1].children[0], 'S-run')
// The hover cluster carries exactly one control: the shipped session menu
// trigger. There is no hand-built archive/pin pair, so no duplicate
// implementation of the row actions.
const actionCluster = pinRow.children[3]
assert.strictEqual(actionCluster.props.className, 'dshps-actions')
assert.strictEqual(actionCluster.children.length, 1, 'the cluster holds one control, not a parallel button pair')
const moreButton = actionCluster.children[0]
assert.strictEqual(moreButton.props.className, 'dshps-action')
assert.strictEqual(moreButton.props['aria-haspopup'], 'menu', 'the one control opens the shipped session menu')
assert.strictEqual(moreButton.children[0], '…')
assert.strictEqual(pinRow.props.onContextMenu !== undefined, true, 'right-click opens the shipped session menu')

// Clicking that one control really opens the shipped menu for this Session —
// the row does not perform archive/pin itself.
moreButton.props.onClick({ currentTarget: { getBoundingClientRect: () => ({ left: 10, bottom: 20 }) }, preventDefault() {}, stopPropagation() {} })
assert.strictEqual(openedMenus.length, 1, 'the hover control opens the shipped session menu')
assert.strictEqual(openedMenus[0].sessionId, 'run')
const collapsedPins = renderGroup(Object.assign({}, tree.children[3], {
  props: Object.assign({}, tree.children[3].props, { collapsed: true }),
}))
assert.strictEqual(collapsedPins.rows, null, 'a collapsed global-pin group renders no rows')
const collapsedCaption = collapsedPins.caption
assert.strictEqual(collapsedCaption.props.className, 'dshps-groupHeader', 'the collapsed caption is still the whole-row control')
assert.strictEqual(collapsedCaption.props['aria-expanded'], 'false')
assert.strictEqual(collapsedCaption.children[0].props.className, 'dshps-groupChevron')
assert.strictEqual(collapsedCaption.children[2].children[0], '2', 'the count stays readable while collapsed')
const statusList = tree.children[1]
assert.strictEqual(statusList.length, 3, 'all three state groups render (pinning never removes a Session from them)')
assert.strictEqual(statusList[0].type.name, 'StatusGroup')
// The open Session lives in the "Open now" group; its rendered row must carry
// the shipped selected treatment, not a bespoke one.
const currentGroup = renderGroup(statusList[2])
const currentRow = currentGroup.rows[0].type(currentGroup.rows[0].props)
assert.strictEqual(currentRow.props.className, 'dshps-row dshps-selected', 'the open Session row carries the selected class')
assert.strictEqual(currentRow.props['aria-selected'], 'true', 'the open Session row is marked selected for assistive tech')
// A status group folds through the SAME caption component as the pin list.
const runningGroup = renderGroup(statusList[0])
const runningCaption = runningGroup.caption
assert.strictEqual(runningCaption.props.className, 'dshps-groupHeader', 'a status group caption is the same whole-row control')
assert.strictEqual(runningCaption.props.role, 'button')
assert.strictEqual(typeof runningCaption.props.onClick, 'function')
assert.strictEqual(runningCaption.children[1].children[0], 'group.running')
const foldedByKey = renderGroup(Object.assign({}, statusList[0], {
  props: Object.assign({}, statusList[0].props, { collapsed: true }),
}))
assert.strictEqual(foldedByKey.rows, null, 'a collapsed status group renders no rows')

// ---- one fold mechanism for every group -----------------------------------
// The state groups, the pinned-workspaces caption and the pin list must all go
// through the same caption contract; otherwise they drift apart again.
const allGroups = [
  statusList[0], statusList[1], statusList[2],      // running / unread / open now
  tree.children[3],                                  // global pins
]
for (const element of allGroups) {
  const rendered = renderGroup(element)
  const caption = rendered.caption
  assert.strictEqual(caption.props.className, 'dshps-groupHeader', 'every group caption is the same component')
  assert.strictEqual(caption.props.role, 'button')
  assert.strictEqual(caption.props.tabIndex, 0)
  assert.strictEqual(typeof caption.props.onClick, 'function', 'every group folds from its whole caption row')
  assert.strictEqual(typeof caption.props.onKeyDown, 'function', 'every group folds from the keyboard too')
  assert.strictEqual(caption.props['aria-expanded'], 'true', 'every group starts expanded')
  assert.strictEqual(caption.children[0].props['aria-hidden'], 'true', 'every chevron is decorative')
  const folded = renderGroup(Object.assign({}, element, {
    props: Object.assign({}, element.props, { collapsed: true }),
  }))
  assert.strictEqual(folded.rows, null, 'every group hides its rows when folded')
  assert.strictEqual(folded.caption.props['aria-expanded'], 'false')
}

// The pinned-workspaces block is a plain div wrapping a GroupCaption element, so
// it is checked through its caption element directly.
const workspaceCaptionElement = tree.children[2].children[0]
assert.strictEqual(workspaceCaptionElement.type.name, 'GroupCaption', 'the pinned-workspaces caption is the shared component')
assert.strictEqual(workspaceCaptionElement.props.collapsed, false)
assert.strictEqual(typeof workspaceCaptionElement.props.onToggle, 'function')

// Folding is tracked per group key, not by one shared boolean.
const foldedKeys = []
const sectionWithFolds = PinnedSection({
  parts,
  collapsedWorkspaces: [],
  sessionPinsCollapsed: false,
  collapsedStatusGroups: ['group.unread'],
  toggleStatusGroup: (key) => foldedKeys.push(key),
  toggleSessionPinsCollapsed: () => foldedKeys.push('pins'),
  t,
  openSession: () => {},
  unpinSession: () => {},
  unpinWorkspace: () => {},
  toggleWorkspaceOpen: () => {},
})
const statusesAfterFold = sectionWithFolds.children[1]
for (const element of statusesAfterFold) renderGroup(element)
const unreadFolded = renderGroup(statusesAfterFold[1])
const runningOpen = renderGroup(statusesAfterFold[0])
assert.strictEqual(unreadFolded.rows, null, 'only the folded group collapses')
assert.notStrictEqual(runningOpen.rows, null, 'a sibling group stays expanded')
assert.strictEqual(runningOpen.caption.props['aria-expanded'], 'true')
const workspaceSection = tree.children[2]
assert.strictEqual(workspaceSection.props.className, 'dshps-group')
const workspaceCaption = workspaceSection.children[0].type(workspaceSection.children[0].props)
assert.strictEqual(workspaceCaption.children[1].children[0], 'group.workspacePins', 'the pinned-workspaces caption folds the same way')
assert.strictEqual(workspaceCaption.props.role, 'button')
const wsGroupElement = workspaceSection.children[1][0]
const wsGroup = wsGroupElement.type(wsGroupElement.props)
assert.strictEqual(wsGroup.props.className, 'dshps-wsGroup')
const header = wsGroup.children[0]
assert.strictEqual(header.props.role, 'button')
assert.strictEqual(header.props['aria-expanded'], 'true')
assert.strictEqual(header.children[1].children[0], 'other')
assert.strictEqual(header.children[2].children[0], '0')
const wsSessions = wsGroup.children[1]
assert.strictEqual(wsSessions.props.className, 'dshps-wsSessions')
assert.strictEqual(wsSessions.children.length, 1)
// a collapsed pinned workspace renders no session rows
const collapsedGroup = wsGroupElement.type(Object.assign({}, wsGroupElement.props, { collapsed: true }))
assert.strictEqual(collapsedGroup.children[1], null)
assert.strictEqual(PinnedSection({ parts: { sessionPins: [], statusGroups: [], workspacePins: [] }, collapsedWorkspaces: [], t, openSession: () => {} }), null)

console.log('ALL CHECKS PASSED')
