(function () {
  'use strict';

  // Schematic labels and routes, not a model of a live system.
  // Source numbers are zero-based positions in the existing narrative pipeline.
  // Native-details passages are read directly from the page by workflow-map.js.
  var safeguard = 'Review and clarification are recommended workflow safeguards, not universal connector-enforced behavior.';
  window.WorkflowMapData = {
    ide: {
      name: 'Document quality',
      nodes: [
        { id: 'contract', label: 'Data contract', kind: 'Starting point', source: 0, col: 1, row: 1 },
        { id: 'extract', label: 'Structured extraction', kind: 'Produce', source: 1, col: 2, row: 1 },
        { id: 'verify', label: 'Independent verification', kind: 'Check evidence', source: 2, col: 3, row: 1 },
        { id: 'reconcile', label: 'Deterministic reconciliation', kind: 'Quality boundary', source: 3, col: 2, row: 2, decision: true },
        { id: 'recovery', label: 'Targeted recovery', kind: 'Bounded return', source: 4, col: 3, row: 3 },
        { id: 'escalate', label: 'Escalation & review', kind: 'Unresolved exception', source: 5, col: 2, row: 3, decision: true },
        { id: 'output', label: 'Reviewable output', kind: 'Review retained', source: 6, col: 1, row: 2 }
      ],
      edges: [
        { from: 'contract', to: 'extract' },
        { from: 'extract', to: 'verify' },
        { from: 'verify', to: 'reconcile' },
        { from: 'reconcile', to: 'output' },
        { from: 'reconcile', to: 'recovery' },
        { from: 'recovery', to: 'verify', via: 'right', lane: 0 },
        { from: 'reconcile', to: 'escalate' }
      ],
      routes: [
        { id: 'validated', label: 'Validated path', steps: ['contract', 'extract', 'verify', 'reconcile', 'output'],
          description: 'Illustrative path through evidence and deterministic checks to reviewable output; not a guarantee that every result is error-free.',
          end: 'End of illustration: reviewable output, with a path for human review retained.' },
        { id: 'recovery', label: 'Recovery loop', steps: ['contract', 'extract', 'verify', 'reconcile', 'recovery', 'verify', 'reconcile', 'output'],
          description: 'One illustrative recovery pass returns to independent verification and reconciliation. This bounded walkthrough does not imply that every correction succeeds.',
          end: 'End of this illustrative pass. Unresolved exceptions still need an escalation route.' },
        { id: 'unresolved', label: 'Unresolved exception', steps: ['contract', 'extract', 'verify', 'reconcile', 'recovery', 'verify', 'reconcile', 'escalate'],
          description: 'The exception remains unresolved after an illustrative re-check. Follow the escalation handoff rather than force an answer.',
          end: 'Review handoff: preserve the exception. Escalation does not bypass human responsibility.' }
      ],
      // Verbatim from ide-quality/case-study.js; kept separate from short map labels.
      passages: [
        { title: 'Define the data contract', executive: 'Agree the required business fields, acceptable evidence, and escalation rules before extraction begins.', technical: 'Translate domain needs into versioned schemas, required/conditional fields, stable entities, source references, and rule-backed acceptance criteria.' },
        { title: 'Extract into a structured result', executive: 'Convert a complex document into a consistent, usable structure rather than a free-form summary.', technical: 'Use document-aware ingestion, layout context, schema-constrained extraction, and isolated groups for different sections or record types.' },
        { title: 'Verify independently', executive: 'A separate evaluation step checks whether important values are supported by source evidence.', technical: 'Keep the checker independent from the producer; assess evidence support, contradictions, missingness, and citation-to-entity alignment.' },
        { title: 'Reconcile deterministic relationships', executive: 'Apply repeatable business checks such as totals, subtotals, categories, and financial relationships.', technical: 'Run rule-based validation and reconciliation outside model judgment so known numeric and structural constraints are deterministic.' },
        { title: 'Recover only where needed', executive: 'Use targeted remediation when the system finds uncertainty or a correctable exception.', technical: 'Bound recovery to unresolved fields or records, preserve source grounding, and re-check every adopted correction instead of re-running everything.' },
        { title: 'Escalate disagreements safely', executive: 'When the system cannot resolve an issue reliably, use a stronger independent review or a human decision.', technical: 'Apply integrity checks and a separate arbitration path for unresolved conflicts; preserve exception states rather than forcing an answer.' },
        { title: 'Expose reviewable, downstream-ready data', executive: 'Make validated output usable for authorized workflows while retaining a path for human review.', technical: 'Persist structured results, quality metadata, review artifacts, and access-aware interfaces for downstream analytics and AI-assisted queries.' }
      ]
    },
    delivery: {
      name: 'Governed delivery',
      nodes: [
        { id: 'capability', label: 'Reusable capability', kind: 'Starting point', source: 0, col: 1, row: 1 },
        { id: 'draft', label: 'Application draft', kind: 'Create', source: 1, col: 2, row: 1 },
        { id: 'preview', label: 'Internal preview', kind: 'Inspect', source: 2, col: 3, row: 1 },
        { id: 'release', label: 'Explicit release decision', kind: 'Human decision', source: 3, col: 3, row: 2, decision: true },
        { id: 'share', label: 'Intended-audience sharing', kind: 'After approval', source: 4, col: 3, row: 3 },
        { id: 'reuse', label: 'Contribute reusable work', kind: 'Separate reuse path', source: 5, col: 1, row: 2,
          note: 'This separate contribution path does not mean that every delivered application becomes a reusable capability.' },
        { id: 'revise', label: 'Revise the draft', kind: 'Illustrative return', source: 1, col: 2, row: 2, decision: true,
          title: 'Revise before release', note: 'Schematic return to the draft and internal preview; release responsibility remains with a person.' }
      ],
      edges: [
        { from: 'capability', to: 'draft' },
        { from: 'draft', to: 'preview' },
        { from: 'preview', to: 'release' },
        { from: 'release', to: 'share' },
        { from: 'release', to: 'revise' },
        { from: 'revise', to: 'draft' },
        { from: 'draft', to: 'reuse' },
        { from: 'reuse', to: 'capability' }
      ],
      routes: [
        { id: 'sharing', label: 'Reviewed sharing', steps: ['capability', 'draft', 'preview', 'release', 'share'],
          description: 'Follow a draft through internal preview and a human release decision before intended-audience sharing.',
          end: 'End of illustration: intended-audience delivery after the separate release decision.' },
        { id: 'revision', label: 'Revise before release', steps: ['capability', 'draft', 'preview', 'release', 'revise', 'draft', 'preview', 'release', 'share'],
          description: 'One illustrative revision returns to the draft and preview. A person still decides whether the revised application is appropriate to share.',
          end: 'End of this revision illustration; a revision is not itself release authorization.' },
        { id: 'contribution', label: 'Separate reuse loop', steps: ['capability', 'draft', 'reuse', 'capability'],
          description: 'Explore contribution of reusable know-how as a separate loop, not automatic conversion of every delivered application into a reusable capability.',
          end: 'End of the reuse loop. Capability contribution and application release are distinct.' }
      ]
    },
    m365: {
      name: 'Identity, intent & action',
      nodes: [
        { id: 'identity', label: 'Identity context', kind: 'Starting point', source: 0, col: 1, row: 1 },
        { id: 'resolve', label: 'Resolve the target', kind: 'Identify destination', source: 1, col: 2, row: 1 },
        { id: 'retrieve', label: 'Retrieve context', kind: 'Read', source: 2, col: 3, row: 1 },
        { id: 'separate', label: 'Answer or action?', kind: 'Decision boundary', source: 3, col: 3, row: 2, decision: true, note: safeguard },
        { id: 'review', label: 'Review proposed action', kind: 'Recommended safeguard', source: 4, col: 3, row: 3, decision: true, note: safeguard },
        { id: 'report', label: 'Report observed result', kind: 'Recommended safeguard', source: 5, col: 2, row: 3 },
        { id: 'pause', label: 'Pause & clarify', kind: 'Recommended safeguard', source: 1, col: 1, row: 2, decision: true,
          title: 'Pause when the target is ambiguous', note: safeguard }
      ],
      edges: [
        { from: 'identity', to: 'resolve' },
        { from: 'resolve', to: 'retrieve' },
        { from: 'retrieve', to: 'separate' },
        { from: 'separate', to: 'report' },
        { from: 'separate', to: 'review' },
        { from: 'review', to: 'report' },
        { from: 'resolve', to: 'pause' }
      ],
      routes: [
        { id: 'answer', label: 'Read & answer', steps: ['identity', 'resolve', 'retrieve', 'separate', 'report'],
          description: 'The read path ends with an answer and an account of the observed result, not a consequential change.',
          end: 'End of the read illustration. Report what is known, including visible limitations.' },
        { id: 'action', label: 'Proposed action', steps: ['identity', 'resolve', 'retrieve', 'separate', 'review', 'report'],
          description: 'Explore the recommended review boundary for a proposed consequential action. Review is not a universal connector-enforced prompt, and the final report is not a success guarantee.',
          end: 'End of illustration: report the observed result, which may include a blocked or uncertain step.' },
        { id: 'ambiguity', label: 'Ambiguity / pause', steps: ['identity', 'resolve', 'pause'],
          description: 'Recommended safeguard: pause for clarification when the intended target is ambiguous, rather than treating a plausible match as authorization.',
          end: 'Clarification handoff. This recommended pause is not a claim of connector-enforced behavior.' }
      ]
    },
    remediation: {
      name: 'Permitted change & review',
      nodes: [
        { id: 'issue', label: 'Reported issue', kind: 'Starting point', source: 0, col: 1, row: 1 },
        { id: 'reproduce', label: 'Reproduce with source', kind: 'Investigate', source: 1, col: 2, row: 1 },
        { id: 'scope', label: 'Classify & explain change', kind: 'Permitted-change boundary', source: 2, col: 3, row: 1, decision: true },
        { id: 'candidate', label: 'Candidate fix', kind: 'Within permitted scope', source: 3, col: 3, row: 2 },
        { id: 'check', label: 'Independent check', kind: 'Assess, not assume', source: 4, col: 2, row: 2, decision: true },
        { id: 'pr', label: 'Reviewable pull request', kind: 'Not production deployment', source: 5, col: 1, row: 2 },
        { id: 'business', label: 'Pause for business decision', kind: 'Schema-change boundary', source: 2, col: 3, row: 3, decision: true,
          title: 'Pause for a business-schema decision', note: 'Schematic boundary: a business-schema change does not proceed through the candidate-fix path.' },
        { id: 'uncertain', label: 'Unresolved check', kind: 'Recommended pause', source: 4, col: 2, row: 3, decision: true,
          title: 'Pause with an unresolved check', note: 'Recommended workflow safeguard: retain unresolved checks for review rather than equating a candidate correction with permission to release.' }
      ],
      edges: [
        { from: 'issue', to: 'reproduce' },
        { from: 'reproduce', to: 'scope' },
        { from: 'scope', to: 'candidate' },
        { from: 'candidate', to: 'check' },
        { from: 'check', to: 'pr' },
        { from: 'scope', to: 'business', via: 'right', lane: 0 },
        { from: 'check', to: 'uncertain' }
      ],
      routes: [
        { id: 'permitted', label: 'Permitted fix', steps: ['issue', 'reproduce', 'scope', 'candidate', 'check', 'pr'],
          description: 'Follow an eligible candidate through an independent check to a reviewable pull request. This does not assert that every check succeeds or that the change is deployed.',
          end: 'Reviewable proposal, not production deployment. Review and release remain separate decisions.' },
        { id: 'schema', label: 'Business-schema boundary', steps: ['issue', 'reproduce', 'scope', 'business'],
          description: 'A change to the agreed business schema pauses for a business decision rather than proceeding to a candidate fix.',
          end: 'Business decision required. The remediation path does not silently change the agreed schema.' },
        { id: 'unresolved', label: 'Unresolved check', steps: ['issue', 'reproduce', 'scope', 'candidate', 'check', 'uncertain'],
          description: 'Recommended pause: an unresolved independent check is not evidence of permission to release a candidate.',
          end: 'Pause for review of the unresolved check. No successful fix or release is implied.' }
      ]
    }
  };
}());
