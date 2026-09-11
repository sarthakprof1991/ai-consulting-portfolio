(function () {
  'use strict';

  var data = window.WorkflowMapData;
  if (!data) return;

  function element(tag, className, text) {
    var item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function initWorkflowMap(root) {
    var model = data[root.dataset.workflowMap];
    var app = root.querySelector('[data-map-body]');
    if (!model || !app) return;
    var prefix = 'wm-' + root.dataset.workflowMap;
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var mobile = window.matchMedia('(max-width: 700px)');
    var state = { route: model.routes[0], step: 0, view: 'executive', playing: false };
    var timer = null;
    var frame = null;
    var nodeButtons = {};
    var nodeData = {};
    var passages = [];

    function sourceStages() {
      return Array.from(document.querySelectorAll('.workflow-section .pipeline > .stage'));
    }

    // Retain the original native paragraphs, without copying the global
    // data-audience attributes into the independent inspector.
    var stages = sourceStages();
    if (!stages.length) return;
    model.nodes.forEach(function (node) {
      nodeData[node.id] = node;
      var stage = stages[node.source];
      if (!stage) return;
      stage.id = 'workflow-stage-' + (node.source + 1);
      if (passages[node.source]) return;
      if (model.passages) {
        var original = model.passages[node.source];
        passages[node.source] = {
          title: original.title,
          executive: [element('p', '', original.executive)],
          technical: [element('p', '', original.technical)]
        };
      } else {
        var executive = stage.querySelector('[data-audience="executive"]');
        var technical = stage.querySelector('[data-audience="technical"]');
        if (!executive || !technical) return;
        passages[node.source] = {
          title: stage.querySelector('.stage-title').textContent,
          executive: Array.from(executive.children),
          technical: Array.from(technical.children)
        };
      }
    });
    if (model.nodes.some(function (node) { return !passages[node.source]; })) return;

    app.innerHTML =
      '<div class="wm-route-bar">' +
        '<p class="wm-toolbar-label" id="' + prefix + '-route-label">Choose a schematic route</p>' +
        '<div class="wm-routes" data-map-routes role="group" aria-labelledby="' + prefix + '-route-label"></div>' +
        '<p class="wm-route-description" data-map-route-description id="' + prefix + '-route-description"></p>' +
        '<details class="wm-route-reading"><summary>Read the selected route</summary>' +
          '<ol class="wm-route-list" data-map-route-list aria-label="Selected route in order"></ol>' +
        '</details>' +
      '</div>' +
      '<div class="wm-workspace">' +
        '<div class="wm-surface">' +
          '<div class="wm-surface-header"><p class="wm-surface-title"></p>' +
            '<a data-map-jump href="#' + prefix + '-inspector-title">Jump to stage inspector ↓</a></div>' +
          '<div class="wm-diagram" data-map-diagram>' +
            '<canvas class="wm-connectors" data-map-canvas aria-hidden="true"></canvas>' +
            '<ol class="wm-nodes" data-map-nodes aria-label="Workflow stages; choose a stage to inspect"></ol>' +
          '</div>' +
          '<ul class="wm-legend" aria-label="Diagram key">' +
            '<li><span class="wm-key" aria-hidden="true"></span>Current</li>' +
            '<li><span class="wm-key wm-key-visited" aria-hidden="true"></span>Visited</li>' +
            '<li><span class="wm-key wm-key-ahead" aria-hidden="true"></span>Ahead on route</li>' +
            '<li><span class="wm-key wm-key-decision" aria-hidden="true"></span>Decision / safeguard</li>' +
          '</ul>' +
          '<p class="wm-diagram-help">Arrows show possible handoffs. Select a stage to read it; other routes remain available.</p>' +
        '</div>' +
        '<aside class="wm-inspector" data-map-inspector aria-labelledby="' + prefix + '-inspector-title">' +
          '<p class="wm-toolbar-label" data-map-source-label></p>' +
          '<h3 class="wm-inspector-title wm-inspector-heading" id="' + prefix + '-inspector-title" data-map-title tabindex="-1"></h3>' +
          '<div class="wm-view" role="group" aria-label="Stage inspector detail level">' +
            '<button type="button" data-map-view="executive" aria-pressed="true">Executive</button>' +
            '<button type="button" data-map-view="technical" aria-pressed="false">Technical</button>' +
          '</div>' +
          '<p class="wm-inspector-note" data-map-note hidden></p>' +
          '<div class="wm-inspector-copy" data-map-copy></div>' +
          '<div class="wm-stage-links">' +
            '<a class="wm-link wm-link-primary" data-map-read>Read full stage <span aria-hidden="true">↗</span></a>' +
            '<button class="wm-link" type="button" data-map-action="locate">Back to selected node ↑</button>' +
          '</div>' +
          '<div class="wm-walkthrough">' +
            '<p class="wm-toolbar-label">Guided walkthrough</p>' +
            '<p class="wm-status" data-map-status role="status" aria-live="polite" aria-atomic="true"></p>' +
            '<div class="wm-controls" role="group" aria-label="Guided walkthrough controls">' +
              '<button type="button" data-map-action="previous">← Previous</button>' +
              '<button type="button" data-map-action="next">Next →</button>' +
              '<button type="button" data-map-action="restart">Restart</button>' +
              '<button type="button" data-map-action="play" aria-pressed="false">Play</button>' +
            '</div>' +
            '<p class="wm-motion-note" data-map-motion-note></p>' +
          '</div>' +
        '</aside>' +
      '</div>';

    var diagram = app.querySelector('[data-map-diagram]');
    var canvas = app.querySelector('[data-map-canvas]');
    var context = canvas.getContext('2d');
    var title = app.querySelector('[data-map-title]');
    var copy = app.querySelector('[data-map-copy]');
    var note = app.querySelector('[data-map-note]');
    var status = app.querySelector('[data-map-status]');
    var routeList = app.querySelector('[data-map-route-list]');
    var readLink = app.querySelector('[data-map-read]');
    var playButton = app.querySelector('[data-map-action="play"]');
    var routeButtons = [];
    app.querySelector('.wm-surface-title').textContent = model.name + ' / schematic';

    model.routes.forEach(function (route) {
      var button = element('button', '', route.label);
      button.type = 'button';
      button.dataset.mapRoute = route.id;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-describedby', prefix + '-route-description');
      button.addEventListener('click', function () { selectRoute(route); });
      routeButtons.push(button);
      app.querySelector('[data-map-routes]').appendChild(button);
    });

    model.nodes.forEach(function (node) {
      var item = element('li', 'wm-node-item');
      item.style.setProperty('--map-col', node.col);
      item.style.setProperty('--map-row', node.row);
      var button = element('button', 'wm-node');
      button.type = 'button';
      button.id = prefix + '-node-' + node.id;
      button.dataset.mapNode = node.id;
      button.dataset.decision = String(Boolean(node.decision));
      button.setAttribute('aria-controls', prefix + '-inspector-title');
      button.setAttribute('aria-pressed', 'false');
      button.appendChild(element('span', 'wm-node-kind', node.kind));
      button.appendChild(element('span', 'wm-node-label', node.label));
      button.appendChild(element('span', 'wm-node-state'));
      button.addEventListener('click', function () {
        selectNode(node.id);
        if (mobile.matches) focusAndScroll(title);
      });
      nodeButtons[node.id] = button;
      item.appendChild(button);
      app.querySelector('[data-map-nodes]').appendChild(item);
    });

    function selectedNode() { return nodeData[state.route.steps[state.step]]; }

    function stopPlayback() {
      window.clearTimeout(timer);
      timer = null;
      state.playing = false;
    }

    function selectRoute(route) {
      stopPlayback();
      state.route = route;
      state.step = 0;
      renderState();
    }

    function selectNode(id) {
      stopPlayback();
      // An off-route node selects a route that actually visits it. The route
      // selector, description, breadcrumb and status all reflect that change.
      if (state.route.steps.indexOf(id) === -1) {
        state.route = model.routes.find(function (route) { return route.steps.indexOf(id) !== -1; });
        state.step = 0;
      }
      // Repeated stages retain their current occurrence when already selected.
      // Otherwise prefer the next occurrence, or the first earlier occurrence.
      var nextOccurrence = state.route.steps.indexOf(id, state.step);
      state.step = nextOccurrence === -1 ? state.route.steps.indexOf(id) : nextOccurrence;
      renderState();
    }

    function moveStep(delta) {
      stopPlayback();
      state.step = Math.max(0, Math.min(state.route.steps.length - 1, state.step + delta));
      renderState();
    }

    function schedulePlayback() {
      timer = window.setTimeout(function () {
        if (document.hidden || motion.matches || !state.playing) {
          stopPlayback();
          renderState();
          return;
        }
        if (state.step < state.route.steps.length - 1) state.step += 1;
        if (state.step === state.route.steps.length - 1) stopPlayback();
        renderState();
        if (state.playing) schedulePlayback();
      }, 4200);
    }

    function togglePlayback() {
      if (state.playing) stopPlayback();
      else if (!motion.matches && !document.hidden && state.step < state.route.steps.length - 1) {
        state.playing = true;
        schedulePlayback();
      }
      renderState();
    }

    function focusAndScroll(target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: motion.matches ? 'auto' : 'smooth', block: 'center' });
    }

    function openSourceStage(event) {
      stopPlayback();
      renderState();
      // Use the existing view mechanism only when explicitly reading the full
      // stage; the inspector's view switches never change the original view.
      var originalView = document.querySelector('.view-switch [data-view="' + state.view + '"]');
      if (originalView && originalView.getAttribute('aria-pressed') !== 'true') originalView.click();
      var currentStages = sourceStages(); // IDE re-renders on its own view change.
      currentStages.forEach(function (stage, index) { stage.id = 'workflow-stage-' + (index + 1); });
      var stage = currentStages[selectedNode().source];
      if (!stage) return;
      event.preventDefault();
      var control = stage.querySelector('.stage-button');
      if (stage.tagName === 'DETAILS') stage.open = true;
      else if (control.getAttribute('aria-expanded') !== 'true') control.click();
      stage.style.scrollMarginTop = '24px';
      control.focus({ preventScroll: true });
      stage.scrollIntoView({ behavior: motion.matches ? 'auto' : 'smooth', block: 'start' });
    }

    function renderState() {
      var node = selectedNode();
      var terminal = state.step === state.route.steps.length - 1;
      var visited = state.route.steps.slice(0, state.step);
      root.dataset.mapCurrent = node.id;
      root.dataset.mapSelectedRoute = state.route.id;
      root.dataset.mapStep = String(state.step);
      root.dataset.mapPlaying = String(state.playing);
      routeButtons.forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.mapRoute === state.route.id));
      });
      app.querySelector('[data-map-route-description]').textContent = state.route.description;
      routeList.replaceChildren();
      state.route.steps.forEach(function (id, index) {
        var item = element('li', '', nodeData[id].label);
        if (index === state.step) item.setAttribute('aria-current', 'step');
        routeList.appendChild(item);
      });
      model.nodes.forEach(function (item) {
        var button = nodeButtons[item.id];
        var current = item.id === node.id;
        var routeState = current ? 'current' : visited.indexOf(item.id) !== -1 ? 'visited' :
          state.route.steps.indexOf(item.id) !== -1 ? 'ahead' : 'other';
        button.dataset.routeState = routeState;
        button.setAttribute('aria-pressed', String(current));
        if (current) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
        button.querySelector('.wm-node-state').textContent = current ? 'Current stage' :
          routeState === 'visited' ? 'Visited on this route' :
          routeState === 'ahead' ? 'Ahead on this route' : 'Explore another route';
      });
      title.textContent = node.title || passages[node.source].title;
      app.querySelector('[data-map-source-label]').textContent = 'Stage ' +
        String(node.source + 1).padStart(2, '0') + ' / ' + (node.decision ? 'Decision & context' : 'Stage inspector');
      app.querySelectorAll('[data-map-view]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.mapView === state.view));
      });
      copy.replaceChildren();
      passages[node.source][state.view].forEach(function (paragraph) {
        copy.appendChild(paragraph.cloneNode(true));
      });
      note.hidden = !node.note;
      note.textContent = node.note || '';
      readLink.href = '#workflow-stage-' + (node.source + 1);
      readLink.setAttribute('aria-label', 'Read full stage: ' + passages[node.source].title);
      app.querySelector('[data-map-action="previous"]').disabled = state.step === 0;
      app.querySelector('[data-map-action="next"]').disabled = terminal;
      playButton.disabled = motion.matches || terminal;
      playButton.textContent = state.playing ? 'Pause' : 'Play';
      playButton.setAttribute('aria-pressed', String(state.playing));
      status.textContent = state.route.label + ' · Step ' + (state.step + 1) + ' of ' +
        state.route.steps.length + ' · ' + node.label + '. ' +
        (terminal ? 'End of route. ' + state.route.end :
          state.playing ? 'Playing the illustration.' : 'Paused. Use Next to continue.');
      app.querySelector('[data-map-motion-note]').textContent = motion.matches
        ? 'Reduced motion is on. Use Previous and Next; timed playback is disabled.'
        : 'Play advances the illustration only. Nothing is run or changed.';
      queueDraw();
    }

    function edgeState(edge) {
      var routeEdge = false;
      var visitedEdge = false;
      state.route.steps.forEach(function (id, index) {
        if (id === edge.from && state.route.steps[index + 1] === edge.to) {
          routeEdge = true;
          if (index < state.step) visitedEdge = true;
        }
      });
      return visitedEdge ? 'visited' : routeEdge ? 'ahead' : 'other';
    }

    function queueDraw() {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(function () {
        frame = null;
        drawConnectors();
      });
    }

    function drawConnectors() {
      if (!context) return; // Ordered route and node controls still work.
      var bounds = diagram.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      var geometry = {};
      model.nodes.forEach(function (node) {
        var rect = nodeButtons[node.id].getBoundingClientRect();
        geometry[node.id] = {
          left: rect.left - bounds.left, right: rect.right - bounds.left,
          top: rect.top - bounds.top, bottom: rect.bottom - bounds.top,
          x: rect.left - bounds.left + rect.width / 2,
          y: rect.top - bounds.top + rect.height / 2
        };
      });
      // Draw the muted routes first so the walked path stays visible at crossings.
      ['other', 'ahead', 'visited'].forEach(function (layer) {
        model.edges.forEach(function (edge, index) {
          if (edgeState(edge) !== layer) return;
          var points = connectorPoints(edge, geometry, bounds.width, index);
          drawArrow(points, layer);
        });
      });
    }

    function connectorPoints(edge, geometry, width, index) {
      var a = geometry[edge.from];
      var b = geometry[edge.to];
      var from = nodeData[edge.from];
      var to = nodeData[edge.to];
      var points;
      if (mobile.matches) {
        var orderA = model.nodes.indexOf(from);
        var orderB = model.nodes.indexOf(to);
        if (orderB === orderA + 1) {
          return [[a.x, a.bottom + 3], [b.x, b.top - 5]];
        }
        // Long skips and returns use separate outer lanes, never a line through
        // an intervening node. Native source order remains legible on phones.
        var right = orderB > orderA;
        var lane = 9 + (index % 3) * 10;
        var x = right ? width - lane : lane;
        return [[right ? a.right + 3 : a.left - 3, a.y],
          [x, a.y], [x, b.y], [right ? b.right + 5 : b.left - 5, b.y]];
      }
      if (edge.via) {
        var rightSide = edge.via === 'right';
        var outer = rightSide ? width - 10 - (edge.lane || 0) * 8 : 10 + (edge.lane || 0) * 8;
        return [[rightSide ? a.right + 3 : a.left - 3, a.y],
          [outer, a.y], [outer, b.y], [rightSide ? b.right + 5 : b.left - 5, b.y]];
      }
      if (from.row === to.row) {
        return from.col < to.col ? [[a.right + 3, a.y], [b.left - 5, b.y]] :
          [[a.left - 3, a.y], [b.right + 5, b.y]];
      }
      if (from.col === to.col) {
        return from.row < to.row ? [[a.x, a.bottom + 3], [b.x, b.top - 5]] :
          [[a.x, a.top - 3], [b.x, b.bottom + 5]];
      }
      if (from.row < to.row) {
        var middle = (a.bottom + b.top) / 2;
        points = [[a.x, a.bottom + 3], [a.x, middle], [b.x, middle], [b.x, b.top - 5]];
      } else {
        var reverseMiddle = (a.top + b.bottom) / 2;
        points = [[a.x, a.top - 3], [a.x, reverseMiddle], [b.x, reverseMiddle], [b.x, b.bottom + 5]];
      }
      return points;
    }

    function drawArrow(points, layer) {
      var color = layer === 'visited' ? '#7acac1' : layer === 'ahead' ? '#8dabb0' : '#44616a';
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = layer === 'visited' ? 2.6 : 1.6;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.setLineDash(layer === 'ahead' ? [4, 5] : []);
      context.beginPath();
      context.moveTo(points[0][0], points[0][1]);
      for (var i = 1; i < points.length - 1; i += 1) {
        var previous = points[i - 1], point = points[i], next = points[i + 1];
        var inLength = Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        var outLength = Math.hypot(next[0] - point[0], next[1] - point[1]);
        var radius = Math.min(8, inLength / 2, outLength / 2);
        if (!inLength || !outLength) { context.lineTo(point[0], point[1]); continue; }
        context.lineTo(point[0] - (point[0] - previous[0]) / inLength * radius,
          point[1] - (point[1] - previous[1]) / inLength * radius);
        context.quadraticCurveTo(point[0], point[1],
          point[0] + (next[0] - point[0]) / outLength * radius,
          point[1] + (next[1] - point[1]) / outLength * radius);
      }
      var end = points[points.length - 1], before = points[points.length - 2];
      context.lineTo(end[0], end[1]);
      context.stroke();
      context.setLineDash([]);
      var angle = Math.atan2(end[1] - before[1], end[0] - before[0]);
      var size = layer === 'visited' ? 8 : 7;
      context.beginPath();
      context.moveTo(end[0], end[1]);
      context.lineTo(end[0] - size * Math.cos(angle - Math.PI / 6), end[1] - size * Math.sin(angle - Math.PI / 6));
      context.lineTo(end[0] - size * Math.cos(angle + Math.PI / 6), end[1] - size * Math.sin(angle + Math.PI / 6));
      context.closePath();
      context.fill();
    }

    app.querySelectorAll('[data-map-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        // The route and occurrence are stable; pause to allow time to read.
        stopPlayback();
        state.view = button.dataset.mapView;
        renderState();
      });
    });
    app.querySelector('[data-map-action="previous"]').addEventListener('click', function () { moveStep(-1); });
    app.querySelector('[data-map-action="next"]').addEventListener('click', function () { moveStep(1); });
    app.querySelector('[data-map-action="restart"]').addEventListener('click', function () { selectRoute(state.route); });
    playButton.addEventListener('click', togglePlayback);
    app.querySelector('[data-map-action="locate"]').addEventListener('click', function () {
      stopPlayback();
      renderState();
      focusAndScroll(nodeButtons[selectedNode().id]);
    });
    app.querySelector('[data-map-jump]').addEventListener('click', function (event) {
      event.preventDefault();
      stopPlayback();
      renderState();
      focusAndScroll(title);
    });
    readLink.addEventListener('click', openSourceStage);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { stopPlayback(); renderState(); }
    });
    window.addEventListener('pagehide', stopPlayback);
    function motionChanged() { stopPlayback(); renderState(); }
    if (motion.addEventListener) motion.addEventListener('change', motionChanged);
    else motion.addListener(motionChanged);
    window.addEventListener('resize', queueDraw, { passive: true });
    if ('ResizeObserver' in window) {
      var observer = new ResizeObserver(queueDraw);
      observer.observe(diagram);
      Object.keys(nodeButtons).forEach(function (id) { observer.observe(nodeButtons[id]); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueDraw);
    app.hidden = false;
    var fallback = root.querySelector('[data-map-fallback]');
    if (fallback) fallback.hidden = true;
    root.dataset.mapReady = 'true';
    renderState();
  }

  document.querySelectorAll('[data-workflow-map]').forEach(initWorkflowMap);
}());
