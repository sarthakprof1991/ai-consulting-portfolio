(function () {
  var selectedView = 'executive';
  var stages = [
    { title: 'Define the data contract', executive: 'Agree the required business fields, acceptable evidence, and escalation rules before extraction begins.', technical: 'Translate domain needs into versioned schemas, required/conditional fields, stable entities, source references, and rule-backed acceptance criteria.' },
    { title: 'Extract into a structured result', executive: 'Convert a complex document into a consistent, usable structure rather than a free-form summary.', technical: 'Use document-aware ingestion, layout context, schema-constrained extraction, and isolated groups for different sections or record types.' },
    { title: 'Verify independently', executive: 'A separate evaluation step checks whether important values are supported by source evidence.', technical: 'Keep the checker independent from the producer; assess evidence support, contradictions, missingness, and citation-to-entity alignment.' },
    { title: 'Reconcile deterministic relationships', executive: 'Apply repeatable business checks such as totals, subtotals, categories, and financial relationships.', technical: 'Run rule-based validation and reconciliation outside model judgment so known numeric and structural constraints are deterministic.' },
    { title: 'Recover only where needed', executive: 'Use targeted remediation when the system finds uncertainty or a correctable exception.', technical: 'Bound recovery to unresolved fields or records, preserve source grounding, and re-check every adopted correction instead of re-running everything.' },
    { title: 'Escalate disagreements safely', executive: 'When the system cannot resolve an issue reliably, use a stronger independent review or a human decision.', technical: 'Apply integrity checks and a separate arbitration path for unresolved conflicts; preserve exception states rather than forcing an answer.' },
    { title: 'Expose reviewable, downstream-ready data', executive: 'Make validated output usable for authorized workflows while retaining a path for human review.', technical: 'Persist structured results, quality metadata, review artifacts, and access-aware interfaces for downstream analytics and AI-assisted queries.' }
  ];
  function renderPipeline() {
    var pipeline = document.querySelector('[data-pipeline]');
    if (!pipeline) return;
    pipeline.innerHTML = stages.map(function (stage, index) {
      var summary = selectedView === 'executive' ? stage.executive : stage.technical;
      return '<article class="stage" data-stage>' +
        '<button class="stage-button" type="button" aria-expanded="false" aria-controls="stage-panel-' + index + '">' +
        '<span class="stage-index">0' + (index + 1) + '</span><span><span class="stage-title">' + stage.title + '</span><span class="stage-summary">' + summary + '</span></span><span class="stage-symbol" aria-hidden="true">+</span></button>' +
        '<div class="stage-panel" id="stage-panel-' + index + '"><p><strong>' + (selectedView === 'executive' ? 'Business intent: ' : 'Implementation intent: ') + '</strong>' + summary + '</p></div></article>';
    }).join('');
    pipeline.querySelectorAll('[data-stage]').forEach(function (stage) {
      stage.querySelector('button').addEventListener('click', function () {
        var open = stage.classList.toggle('open');
        stage.querySelector('button').setAttribute('aria-expanded', String(open));
      });
    });
  }
  document.querySelectorAll('.view-button').forEach(function (button) {
    button.setAttribute('aria-pressed', String(button.getAttribute('data-view') === selectedView));
    button.addEventListener('click', function () {
      selectedView = button.getAttribute('data-view');
      document.querySelectorAll('.view-button').forEach(function (item) {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      renderPipeline();
    });
  });
  renderPipeline();
}());
