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

## Publishing guardrails

This repository is public. Do not add confidential or proprietary content, including:

- Employer/client names, branding, property information, tenant data, deal data, documents, screenshots, user information, or internal URLs.
- Internal repositories, source code, prompts, model identifiers, configuration, architecture topology, security controls, API schemas/endpoints, credentials, logs, or deployment details.
- Non-approved metrics, universal accuracy claims, or statements that imply unrestricted autonomous production changes.

Keep all case studies generalized, accurate, and approved for external publication. Use the footer confidentiality statement when sharing a case study externally.
