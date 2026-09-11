(function () {
  'use strict';
  var picker = document.querySelector('[data-boundary-picker]');
  if (!picker) return;
  var buttons = picker.querySelectorAll('[data-boundary]');
  var scenarios = document.querySelectorAll('[data-scenario]');
  var status = document.querySelector('[data-boundary-status]');
  function selectScenario(value) {
    buttons.forEach(function (button) {
      var selected = button.dataset.boundary === value;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    scenarios.forEach(function (scenario) {
      scenario.hidden = scenario.dataset.scenario !== value;
    });
    if (status) status.textContent = value === 'technical'
      ? 'Illustrative route: investigate within the permitted change scope.'
      : 'Illustrative route: pause for a business decision.';
  }
  buttons.forEach(function (button) {
    button.addEventListener('click', function () { selectScenario(button.dataset.boundary); });
  });
  selectScenario('technical');
  picker.hidden = false;
}());
