# AI Consulting Portfolio

A public, static portfolio for Sarthak Banga. It contains generalized interactive case studies on secure enterprise AI adoption, document intelligence, evaluation systems, and governed workflow automation.

## Local preview

Open `index.html` in a browser, or serve the repository root with any static HTTP server.

## Case studies

- `case-studies/ide-quality/` — Intelligent Document Extraction: a generalized case study on structured extraction, independent verification, deterministic controls, bounded recovery, escalation, and human review.
- `case-studies/governed-ai-exchange/`: Governed AI-to-Client Delivery. Reusable capability, internal review, and controlled external distribution.
- `case-studies/microsoft-365-ai-integration/`: AI Integration for Microsoft 365. Identity-aware discovery, supported retrieval, and separate action capabilities. Recommended workflow safeguards are explicitly distinguished from connector-enforced behavior.
- `case-studies/bounded-ai-remediation/`: Bounded AI-Assisted Remediation. A guided issue-to-fix workflow with permitted-change boundaries, source-based reproduction, independent checking, and reviewable delivery. Includes two invented examples that distinguish a technical investigation from a business-schema decision.

Cases 02, 03, and 04 use native expandable sections and executive/technical workflow views. With JavaScript disabled, their executive narratives and expandable sections remain available. The remediation page's two illustrative boundary examples are also readable without JavaScript. These are explanatory case studies, not live product demonstrations, and do not connect to workplace systems.

## Site assets

Each case study has its own social preview PNG and editable SVG, with canonical and social metadata. The new pages reuse the IDE page's base case-study stylesheet, with additive styles and a shared view-switch script. The original IDE narrative and controls are unchanged.

## Interactive workflow maps

Each case study now has a distinct schematic map directly after its hero, anchored at `#interactive-flow`. The maps use `styles/workflow-map.css`, `scripts/workflow-map-data.js`, and `scripts/workflow-map.js`; no dependencies, network calls, build step, or storage are required.

- Choose a route with the native route buttons, then select any stage or use **Previous**, **Next**, **Restart**, and **Play/Pause**. Playback is opt-in and advances the illustration only, never a live process. The end of each route is explicit.
- Visited connectors are teal; dashed connectors are upcoming on the selected route. Other routes remain legible. Current and visited stages also have text labels, and decisions or recommended safeguards have amber boundaries. Expand **Read the selected route** for an ordered text equivalent, including repeated stages in loops.
- Stage buttons support Tab, Enter, and Space, with `aria-pressed`, `aria-current`, and visible focus. Selecting a node outside the current route switches to a route containing it; the route selector and description update together. Repeated nodes retain their current occurrence or select their next occurrence.
- The light inspector reuses the existing approved stage prose. Its local Executive/Technical switches use `data-map-view`, not the original `data-view`; changing the inspector view preserves the selected route and stage and pauses playback to allow reading.
- **Read full stage** selects the matching original narrative view, opens the corresponding original accordion, and focuses its button or summary. IDE continues to use its original generated `.stage-button` mechanism; the other cases retain native `details`.
- On small screens, nodes become a legible vertical map with connector lanes outside the buttons. Tapping a node brings its inspector into view. **Jump to stage inspector** and **Back to selected node** provide explicit navigation without a sticky overlay.
- Manual selection, route changes, narrative navigation, and a hidden tab stop playback. Reduced-motion preferences disable timed playback and smooth map scrolling; Previous and Next remain available. `ResizeObserver` redraws the decorative, `aria-hidden` canvas from actual button geometry, including when text or viewport sizes change.
- Without JavaScript, no map controls are rendered. A brief fallback links to the existing narrative. The IDE page additionally offers verbatim executive stage passages as a no-JavaScript fallback; the other native accordions and both invented remediation boundary examples remain usable.

Routes are explanatory rather than product guarantees. The Microsoft 365 map prominently labels review and clarification as recommended workflow safeguards, not universally connector-enforced behavior. Delivery keeps human release responsibility and reusable-capability contribution distinct. IDE recovery is one bounded illustrative pass, and remediation ends at a reviewable proposal or a visible decision boundary, never direct production deployment.

### Map QA hooks

`[data-workflow-map]` exposes `data-map-ready`, `data-map-selected-route`, `data-map-current`, zero-based `data-map-step`, and `data-map-playing`. Controls use `[data-map-route]`, `[data-map-node]`, `[data-map-view]`, `[data-map-action]`, and `[data-map-read]`. The action values are `previous`, `next`, `restart`, `play`, and `locate`. Original narrative controls and the two remediation scenarios are intentionally independent.

### IDE-only immersive 3D scene

The IDE page progressively enhances its existing map with a real WebGL miniature document-quality world. `scripts/ide-workflow-scene-loader.js`, `scripts/ide-workflow-scene.js`, and `styles/ide-workflow-scene.css` are loaded only by `case-studies/ide-quality/index.html`. The shared renderer contains only an opt-in event bridge, gated by **both** `data-workflow-map="ide"` and `data-ide-scene`. No other case-study layout or behavior is enhanced.

- **Content and state:** The same seven nodes, seven directed edges, three route descriptions/endings, approved stage prose, and source-stage handoffs remain owned by `workflow-map.js` and the unchanged data. The scene adds raised platforms, document stacks, structured record cells, an independent evidence lens/check, deterministic balance controls, a targeted correction/recovery arrow, a human-review desk, and a reviewable output tray. These are generalized procedural geometry, not workplace assets.
- **Display modes:** Desktop viewports of 900 CSS pixels or more default to 3D. Smaller viewports and forced-colors mode default to the original 2D map, with an explicit 3D opt-in. No Three.js module is loaded on that default 2D path. The persistent **3D scene / 2D map** switch preserves route, occurrence, node, inspector detail level, and camera settings; a switch pauses playback and settles scene motion. Explicit display choices last for this page visit only; there is no storage dependency.
- **Readability:** Initial wide-screen 3D uses projected light HTML stage buttons, not canvas text. Smaller scenes, high browser zoom, or camera angles that would cause label/neighbor collisions automatically use small noninteractive numbered anchors plus a full native stage picker below the scene. Full labels are never shrunk below the existing UI type size. The picker, stage controls, camera buttons, and mode buttons retain 44-pixel minimum interactive targets.
- **Inspector and walkthrough:** In 3D only, the original inspector sits below the full-width scene in a two-column desktop arrangement. Its Executive/Technical state remains independent of the original narrative. Mirrored **Previous / Next / Restart / Play-Pause** controls sit immediately above the scene, beside route/step/node status, so users can watch handoffs without scrolling to the inspector. These dispatch to the original state machine and its original 4,200 ms playback timer; there is no second route state or timer. The original live-region status, route reading list, terminal copy, and **Read full stage / Back to selected node** remain authoritative and intact.
- **Camera:** Orthographic miniature view; home yaw 6°, elevation 55°, zoom 1. Bounds: yaw −12° to +12°, elevation 49° to 61°, zoom 0.88 to 1.12. Desktop mouse/pen dragging uses −0.06° horizontal yaw and +0.035° vertical elevation per CSS pixel. Rotate buttons move 4°; zoom buttons move 0.06; Reset restores home. Touch scrolling and pinch zoom remain browser-owned; there is no wheel listener, scroll hijacking, auto-orbit, or autonomous bobbing.
- **Finite animation:** A newly selected station rises 0.46 world units over 480 ms. Camera-button transitions take 320 ms. A small document packet travels for 1,100 ms along the actual directed rail only when advancing one occurrence on the same route; it never invents a reverse edge for Previous or a shortcut for arbitrary selection. Recovery returns on the right-hand `recovery → verify` rail. Static teal visited rails remain after travel. Reduced motion keeps static 3D and manual camera controls, removes lift/camera interpolation and packet travel, and retains the existing disabled timed-playback behavior.
- **Rendering budget:** Rendering is demand-driven, with no idle animation loop. RAF stops outside the viewport, on a hidden tab, and in 2D; skipped transitions settle to the latest state rather than replaying on return. The existing guided walkthrough remains the state owner when the scene is offscreen. Device pixel ratio is capped at 1.5 and the canvas at approximately 2.2 million pixels. Lighting uses a single 1,024-pixel shadow map, low-segment procedural geometry, and no textures or post-processing.
- **Progressive fallback:** The original map is retained until the module successfully renders a test frame. A blocked stylesheet leaves the original map entirely alone. Blocked module loads, WebGL initialization/shader failures, a 12-second loading timeout, or context loss restore the complete 2D map and disable the unavailable 3D choice for that visit. No-JavaScript narrative fallbacks are unchanged. Use an HTTP static server to test modules; opening local HTML directly may intentionally fall back to 2D.
- **Vendoring:** Three.js **0.170.0 / r170**, unmodified `three.module.min.js` (691,648 bytes), is stored at `assets/vendor/three-0.170.0/`. Its complete MIT license is included as `LICENSE` beside the module. The package was acquired as `three@0.170.0`; there is no CDN, runtime network dependency, package installation, bundler, or build step required for GitHub Pages.

#### IDE bridge and diagnostic hooks

All bridge events are dispatched/listened on the IDE map root and do not bubble:

- `workflowmap:change` emits `{ map: 'ide', node, route, step, view, playing }` after the original state renderer finishes.
- `workflowmap:request` accepts `{ action: 'snapshot' }`, `{ action: 'pause' }`, `{ action: 'redraw' }`, `{ action: 'select', node, focusInspector }`, or `{ action: 'walkthrough', command }` where command is `previous`, `next`, `restart`, or `play`. Node IDs and commands are validated by the existing renderer. Selection does not click or focus hidden 2D controls.
- Cancelable `workflowmap:locate` carries `{ node }`; the 3D handler focuses the visible stage label or compact picker instead of a hidden original map button.

Scene selectors: `[data-scene-mount]`, `[data-scene-frame]`, `[data-scene-canvas]`, `[data-scene-mode-button="3d|2d"]`, `[data-scene-node]`, `[data-scene-picker]`, `[data-scene-camera="left|right|in|out|reset"]`, `[data-scene-action="previous|next|restart|play"]`, and `[data-scene-status-text]`. There are full and picker copies of each `[data-scene-node]`; scope to the visible `.ide-scene-labels` or `.ide-scene-picker`.

The root exposes `data-scene-mode`, `data-scene-status`, `data-scene-node`, `data-scene-active`, `data-scene-animating`, `data-scene-packet`, `data-scene-handoff`, `data-scene-labels`, `data-scene-camera-yaw`, `data-scene-camera-elevation`, `data-scene-camera-zoom`, `data-scene-render-count`, and `data-scene-reduced-motion`. Read-only `root.ideSceneDiagnostics` returns a frozen snapshot with the original route/step/view, camera/bounds, animation timings, current packet edge/progress, render count, draw calls, and pixel ratio. Wait for `data-scene-active="true"` and at least one frame after scrolling into view before taking a screenshot; initialization itself may happen offscreen.

## Publishing guardrails

This repository is public. Do not add confidential or proprietary content, including:

- Employer/client names, branding, property information, tenant data, deal data, documents, screenshots, user information, or internal URLs.
- Internal repositories, source code, prompts, model identifiers, configuration, architecture topology, security controls, API schemas/endpoints, credentials, logs, or deployment details.
- Non-approved metrics, universal accuracy claims, or statements that imply unrestricted autonomous production changes.

Keep all case studies generalized, accurate, and approved for external publication. Use the footer confidentiality statement when sharing a case study externally.
