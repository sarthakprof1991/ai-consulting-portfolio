(function () {
  'use strict';

  var root = document.querySelector('[data-workflow-map="ide"][data-ide-scene]');
  if (!root || root.dataset.mapReady !== 'true' || !window.WorkflowMapData) return;
  // A blocked enhancement stylesheet must never replace a working map.
  if (getComputedStyle(root).getPropertyValue('--ide-scene-styles').trim() !== 'ready') return;
  var moduleURL = new URL('ide-workflow-scene.js?v=1', document.currentScript.src).href;
  var diagram = root.querySelector('[data-map-diagram]');
  var surface = root.querySelector('.wm-surface');
  var compact = window.matchMedia('(max-width: 899px)');
  var forcedColors = window.matchMedia('(forced-colors: active)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var state;
  var scene = null;
  var pending = null;
  var loadTimer = null;
  var failed = false;
  var explicitChoice = false;
  var wanted = compact.matches || forcedColors.matches ? '2d' : '3d';
  var toolbar = document.createElement('div');
  toolbar.className = 'ide-scene-toolbar';
  toolbar.innerHTML =
    '<div class="ide-scene-modes" role="group" aria-label="Workflow display">' +
      '<button type="button" data-scene-mode-button="3d" aria-pressed="false">3D scene</button>' +
      '<button type="button" data-scene-mode-button="2d" aria-pressed="true">2D map</button>' +
    '</div>' +
    '<p class="ide-scene-mode-note" data-scene-mode-note role="status" aria-live="polite"></p>';
  surface.insertBefore(toolbar, diagram);
  var mount = document.createElement('div');
  mount.className = 'ide-scene-mount';
  mount.dataset.sceneMount = '';
  mount.hidden = true;
  surface.insertBefore(mount, diagram);
  var note = toolbar.querySelector('[data-scene-mode-note]');
  var buttons = toolbar.querySelectorAll('[data-scene-mode-button]');
  root.dataset.sceneMode = '2d';
  root.dataset.sceneStatus = 'idle';
  root.dataset.sceneAnimating = 'false';

  function request(action, detail) {
    root.dispatchEvent(new CustomEvent('workflowmap:request', {
      detail: Object.assign({ action: action }, detail || {})
    }));
  }

  function updateNote() {
    if (failed) note.textContent = '3D is unavailable in this browser. The complete 2D map and stage inspector remain available.';
    else if (pending && wanted === '3d') note.textContent = 'Loading the 3D scene. The 2D map stays available until it is ready.';
    else if (root.dataset.sceneMode === '3d') note.textContent = compact.matches
      ? 'Compact 3D: numbered stages keep the scene clear. Choose a full stage label below; use buttons to rotate or zoom.'
      : 'A dimensional view of the same workflow. Select a stage to inspect it; switch to 2D at any time.';
    else if (compact.matches && !explicitChoice) note.textContent = '2D is the default on smaller screens for readable labels. Choose 3D scene to explore the numbered scene and stage picker.';
    else if (forcedColors.matches && !explicitChoice) note.textContent = '2D is the default in high-contrast mode. You can still choose the 3D scene.';
    else note.textContent = 'The complete 2D map. Switching views keeps your route, stage, and inspector detail level.';
  }

  function setMode(mode, stop) {
    if (stop) request('pause');
    if (scene) scene.setActive(false);
    var focusInDiagram = diagram.contains(document.activeElement);
    var focusInScene = mount.contains(document.activeElement);
    root.dataset.sceneMode = mode;
    diagram.hidden = mode === '3d';
    mount.hidden = mode !== '3d';
    buttons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.sceneModeButton === mode));
    });
    if (mode === '3d' && scene) {
      scene.setState(state);
      scene.setActive(true);
    } else request('redraw');
    if ((mode === '3d' && focusInDiagram) || (mode === '2d' && focusInScene)) {
      toolbar.querySelector('[data-scene-mode-button="' + mode + '"]').focus({ preventScroll: true });
    }
    updateNote();
  }

  function fallback() {
    if (failed) return;
    failed = true;
    pending = null;
    window.clearTimeout(loadTimer);
    wanted = '2d';
    root.dataset.sceneStatus = 'unavailable';
    root.dataset.sceneAnimating = 'false';
    toolbar.querySelector('[data-scene-mode-button="3d"]').disabled = true;
    // Restore the original surface before disposing any failed GPU resources.
    setMode('2d', true);
    if (scene) { scene.dispose(); scene = null; }
    mount.replaceChildren();
    updateNote();
  }

  function choose3D() {
    if (failed) return;
    if (scene) { setMode('3d', true); return; }
    if (pending) { updateNote(); return; }
    root.dataset.sceneStatus = 'loading';
    // Dynamic import is deliberate: module/CDN/WebGL failure cannot break 2D.
    pending = import(moduleURL);
    updateNote();
    loadTimer = window.setTimeout(fallback, 12000);
    pending.then(function (module) {
      if (failed) return;
      scene = module.createDocumentQualityScene({
        root: root, mount: mount, model: window.WorkflowMapData.ide,
        initialState: state, reducedMotion: reducedMotion.matches,
        onSelect: function (id) {
          request('select', { node: id, focusInspector: compact.matches });
        },
        onWalkthrough: function (command) { request('walkthrough', { command: command }); },
        onPause: function () { if (state && state.playing) request('pause'); },
        onError: fallback
      });
      window.clearTimeout(loadTimer);
      pending = null;
      root.dataset.sceneStatus = 'ready';
      // Commit only after the module has successfully rendered a test frame.
      if (wanted === '3d') setMode('3d', true);
      else updateNote();
    }).catch(fallback);
  }

  root.addEventListener('workflowmap:change', function (event) {
    state = event.detail;
    if (scene) scene.setState(state);
  });
  root.addEventListener('workflowmap:locate', function (event) {
    if (!scene || root.dataset.sceneMode !== '3d') return;
    event.preventDefault();
    scene.focusNode(event.detail.node);
  });
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      explicitChoice = true;
      wanted = button.dataset.sceneModeButton;
      request('pause');
      if (wanted === '3d') choose3D();
      else setMode('2d', false);
    });
  });
  function mediaChanged() {
    if (!explicitChoice && !failed) {
      wanted = compact.matches || forcedColors.matches ? '2d' : '3d';
      if (wanted === '3d') choose3D();
      else setMode('2d', true);
    }
    updateNote();
  }
  function motionChanged() { if (scene) scene.setReducedMotion(reducedMotion.matches); }
  [compact, forcedColors].forEach(function (media) {
    if (media.addEventListener) media.addEventListener('change', mediaChanged);
    else media.addListener(mediaChanged);
  });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', motionChanged);
  else reducedMotion.addListener(motionChanged);
  request('snapshot');
  updateNote();
  if (wanted === '3d') choose3D();
}());
