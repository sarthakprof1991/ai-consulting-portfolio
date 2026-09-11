(function () {
  'use strict';
  var control = document.querySelector('[data-view-switch]');
  if (!control) return;
  var buttons = control.querySelectorAll('[data-view]');
  var passages = document.querySelectorAll('[data-audience]');
  function setView(view) {
    buttons.forEach(function (button) {
      var selected = button.dataset.view === view;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    passages.forEach(function (passage) {
      passage.hidden = passage.dataset.audience !== view;
    });
    var status = document.querySelector('[data-view-status]');
    if (status) status.textContent = (view === 'executive' ? 'Executive' : 'Technical') +
      ' workflow view selected. Open stages remain open.';
  }
  buttons.forEach(function (button) {
    button.addEventListener('click', function () { setView(button.dataset.view); });
  });
  setView('executive');
  control.hidden = false;
}());

