import * as THREE from '../assets/vendor/three-0.170.0/three.module.min.js';

// Presentation only: all node, route, occurrence, and prose state belongs to
// workflow-map.js. These coordinates express its seven directed edges, not a
// second workflow model.
const POSITIONS = {
  contract: [-5, -5.6], extract: [0, -5.6], verify: [5, -5.6],
  reconcile: [0, 0], recovery: [5, 5.6], escalate: [0, 5.6], output: [-5, 0]
};
const HANDOFFS = {
  'contract>extract': [[-3.25, -5.6], [-1.75, -5.6]],
  'extract>verify': [[1.75, -5.6], [3.25, -5.6]],
  'verify>reconcile': [[5, -4.35], [5, -2.8], [0, -2.8], [0, -1.25]],
  'reconcile>output': [[-1.75, 0], [-3.25, 0]],
  'reconcile>recovery': [[1.75, 0], [5, 0], [5, 4.35]],
  'recovery>verify': [[6.75, 5.6], [8.05, 5.6], [8.05, -5.6], [6.75, -5.6]],
  'reconcile>escalate': [[0, 1.25], [0, 4.35]]
};
const BOUNDS = Object.freeze({
  yaw: Object.freeze([-32, 32]), elevation: Object.freeze([-10, 14]),
  zoom: Object.freeze([0.88, 1.12])
});
const HOME = Object.freeze({ yaw: 0, elevation: 0, zoom: 1 });
const TIMING = Object.freeze({ transition: 1500, camera: 600, packet: 1200, demo: 4800, demoPhase: 1600 });
// Presentation examples only: never replace route data, inspector prose, or
// reported workflow outcomes. Every number below is deliberately invented.
const EXAMPLES = Object.freeze({
  contract: [
    'Start with three required fields: A, B and total.',
    'Fit each field to a numeric rule; attach the total = A + B control.',
    'The contract is assembled before extraction begins.'
  ],
  extract: [
    'Read the invented source: A 100, B 50, reported total 160.',
    'Transfer each source value into its matching record field.',
    'The record is populated, but these values are not yet verified.'
  ],
  verify: [
    'Put the extracted values beside their source evidence.',
    'Link A 100 to supporting evidence; inspect the unclear total separately.',
    'A 100 is supported. Total 160 remains unresolved—not an automatic pass.'
  ],
  reconcile: [
    'Compare the two line items with the reported total of 160.',
    'Recompute 100 + 50 = 150, then compare 150 with 160.',
    'The difference is 10. Flag the mismatch for a controlled next step.'
  ],
  recovery: [
    'Keep A 100 and B 50 fixed; isolate only the flagged total.',
    'Lift the total out for a targeted retry; 150 is only a candidate.',
    'Send the candidate back to re-check. A correction is not yet accepted.'
  ],
  escalate: [
    'Package the unresolved total together with its evidence.',
    'Move that exception packet to a human reviewer.',
    'The packet waits for a decision; the animation does not approve it.'
  ],
  output: [
    'Bring together the record, its evidence and its quality state.',
    'Bundle the three layers without dropping the review state.',
    'The bundle retains quality and review state, including any exceptions—not a universal pass.'
  ]
});
const COLORS = {
  paper: 0xe6ede2, paperSide: 0xb4c4bd, ink: 0x36565c, teal: 0x70cfc0,
  amber: 0xdcb479, base: 0x294851, current: 0x417e7b, visited: 0x285d5e
};
const clamp = THREE.MathUtils.clamp;
const radians = THREE.MathUtils.degToRad;
const cinematicEase = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function element(tag, className, text) {
  const item = document.createElement(tag);
  item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

export function createDocumentQualityScene(options) {
  const { root, mount, model, onSelect, onError } = options;
  const resources = new Set();
  const cleanup = [];
  let renderer;
  let disposed = false;
  let frameID = null;
  let active = false;
  let visible = true;
  let renderCount = 0;
  let reduced = options.reducedMotion;
  let state = null;
  let transition = null;
  let focusMode = 'focus';
  let transitionProgress = 1;
  let transitionDirection = 1;
  let packet = null;
  let cameraState = { ...HOME };
  let cameraPose = { target: new THREE.Vector3(), radius: 32, azimuth: 12, elevation: 55, focus: 0 };
  let width = 1000;
  let height = 680;
  let compact = false;
  let lastHandoff = '';
  let drag = null;
  let demoNode = null;
  let demoStart = null;
  let demoProgress = 1;
  let demoPhase = 2;
  let demoStatus = 'complete';
  let demoPending = false;
  let firstDemo = true;
  const stages = new Map();
  const edges = new Map();

  function track(resource) { resources.add(resource); return resource; }
  function listen(target, type, callback, settings) {
    target.addEventListener(type, callback, settings);
    cleanup.push(() => target.removeEventListener(type, callback, settings));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    if (frameID !== null) cancelAnimationFrame(frameID);
    frameID = null;
    cleanup.forEach(fn => fn());
    resources.forEach(resource => resource.dispose());
    if (renderer) renderer.dispose();
    root.dataset.sceneAnimating = 'false';
    root.dataset.sceneActive = 'false';
    root.dataset.scenePacket = 'false';
  }

  try {
    const walkthrough = element('div', 'ide-scene-walkthrough');
    const walkthroughText = element('div', 'ide-scene-walkthrough-text');
    walkthroughText.append(element('p', 'ide-scene-walkthrough-title', 'Illustrative walkthrough'));
    const walkthroughStatus = element('p', 'ide-scene-walkthrough-status');
    walkthroughStatus.dataset.sceneStatusText = '';
    walkthroughText.append(walkthroughStatus);
    const walkthroughControls = element('div', 'ide-scene-walkthrough-controls');
    walkthroughControls.setAttribute('role', 'group');
    walkthroughControls.setAttribute('aria-label', 'Illustrative walkthrough in the 3D scene');
    for (const [action, label] of [['previous', '← Previous'], ['next', 'Next →'], ['restart', 'Restart'], ['play', 'Play']]) {
      const button = element('button', '', label);
      button.type = 'button';
      button.dataset.sceneAction = action;
      if (action === 'play') button.setAttribute('aria-pressed', 'false');
      listen(button, 'click', () => options.onWalkthrough(action));
      walkthroughControls.append(button);
    }
    walkthrough.append(walkthroughText, walkthroughControls);
    const perspectiveBar = element('div', 'ide-scene-perspective-bar');
    const perspectiveLabel = element('p', '', 'Explore the workflow');
    const perspectiveControls = element('div', 'ide-scene-perspectives');
    perspectiveControls.setAttribute('role', 'group');
    perspectiveControls.setAttribute('aria-label', '3D composition');
    for (const [mode, label] of [['focus', 'Focus stage'], ['overview', 'Overview']]) {
      const button = element('button', '', label);
      button.type = 'button';
      button.dataset.sceneView = mode;
      button.setAttribute('aria-pressed', String(mode === focusMode));
      perspectiveControls.append(button);
    }
    perspectiveBar.append(perspectiveLabel, perspectiveControls);
    const frame = element('div', 'ide-scene-frame');
    frame.dataset.sceneFrame = '';
    const canvas = element('canvas', 'ide-scene-canvas');
    canvas.dataset.sceneCanvas = '';
    canvas.setAttribute('aria-hidden', 'true');
    const caption = element('p', 'ide-scene-caption', 'Document quality / workflow model');
    caption.append(element('strong', '', '07 stages · 03 routes'));
    const focusCaption = element('div', 'ide-scene-focus-caption');
    const focusKind = element('p', 'ide-scene-focus-kind');
    const focusTitle = element('h3', 'ide-scene-focus-title');
    focusTitle.dataset.sceneFocusTitle = '';
    const focusHint = element('p', 'ide-scene-focus-hint', 'Synthetic example · invented values, not a route result.');
    focusCaption.append(focusKind, focusTitle, focusHint);
    const labels = element('ol', 'ide-scene-labels');
    labels.setAttribute('aria-label', '3D workflow stages; choose a stage to inspect');
    const objectLabels = element('div', 'ide-demo-object-labels');
    objectLabels.setAttribute('aria-hidden', 'true');
    frame.append(canvas, caption, focusCaption, labels, objectLabels);
    const demoPanel = element('section', 'ide-demo-panel');
    demoPanel.setAttribute('aria-label', 'Synthetic stage demonstration');
    const demoToolbar = element('div', 'ide-demo-toolbar');
    const demoEyebrow = element('p', 'ide-demo-eyebrow', 'Invented example · explains this stage, not the selected route’s outcome.');
    const replay = element('button', 'ide-demo-replay', 'Replay stage');
    replay.type = 'button';
    replay.dataset.sceneDemoReplay = '';
    const demoPhases = element('div', 'ide-demo-phases');
    demoPhases.setAttribute('role', 'group');
    demoPhases.setAttribute('aria-label', 'Inspect a demonstration phase');
    ['Input', 'Action', 'Output'].forEach((name, index) => {
      const button = element('button', '', `${index + 1} · ${name}`);
      button.type = 'button';
      button.dataset.sceneDemoPhase = index;
      demoPhases.append(button);
    });
    demoToolbar.append(demoEyebrow, demoPhases, replay);
    const demoCaption = element('p', 'ide-demo-action');
    demoCaption.dataset.sceneDemoCaption = '';
    demoCaption.setAttribute('role', 'status');
    demoCaption.setAttribute('aria-live', 'polite');
    const demoTrack = element('div', 'ide-demo-progress');
    demoTrack.setAttribute('aria-hidden', 'true');
    const demoFill = element('span', '');
    demoTrack.append(demoFill);
    demoPanel.append(demoToolbar, demoCaption, demoTrack);
    const footer = element('div', 'ide-scene-footer');
    const cameraButtons = element('div', 'ide-scene-camera');
    cameraButtons.setAttribute('role', 'group');
    cameraButtons.setAttribute('aria-label', '3D camera controls');
    const controls = [
      ['left', 'Rotate left'], ['right', 'Rotate right'],
      ['in', 'Zoom in'], ['out', 'Zoom out'], ['reset', 'Reset view']
    ];
    controls.forEach(([action, title]) => {
      const button = element('button', '', title);
      button.type = 'button';
      button.dataset.sceneCamera = action;
      cameraButtons.append(button);
    });
    const help = element('p', 'ide-scene-help');
    help.id = 'ide-scene-camera-help';
    cameraButtons.setAttribute('aria-describedby', help.id);
    footer.append(cameraButtons, help);
    const pickerWrap = element('div', 'ide-scene-picker-wrap');
    const pickerTitle = element('p', 'ide-scene-picker-title', 'Choose a stage · all 7 remain available');
    pickerTitle.id = 'ide-scene-picker-title';
    const picker = element('ol', 'ide-scene-picker');
    picker.dataset.scenePicker = '';
    picker.setAttribute('aria-labelledby', pickerTitle.id);
    pickerWrap.append(pickerTitle, picker);
    mount.append(walkthrough, perspectiveBar, pickerWrap, frame, demoPanel, footer);

    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'low-power'
    });
    renderer.setPixelRatio(1);
    renderer.setSize(1, 1, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    // Surface shader failures use the same recovery as blocked/lost WebGL.
    renderer.debug.onShaderError = () => { throw new Error('IDE scene shader unavailable'); };

    const world = new THREE.Scene();
    world.background = new THREE.Color(0x0b1c25);
    world.fog = new THREE.Fog(0x0b1c25, 12, 38);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 150);
    world.add(new THREE.HemisphereLight(0xddebe7, 0x27424a, 2.4));
    const sun = new THREE.DirectionalLight(0xffefda, 3.1);
    sun.position.set(-7, 15, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 42;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    world.add(sun);
    const rim = new THREE.DirectionalLight(0xa1dace, 1.8);
    rim.position.set(7, 8, -9);
    world.add(rim);
    const focusLight = new THREE.SpotLight(0xe0f8ee, 32, 32, Math.PI / 5, 0.8, 1.2);
    focusLight.position.set(0, 14, 6);
    world.add(focusLight, focusLight.target);

    function material(color, properties = {}) {
      return track(new THREE.MeshStandardMaterial({
        color, roughness: 0.62, metalness: 0.08, ...properties
      }));
    }
    const paper = material(COLORS.paper, { metalness: 0, roughness: 0.85 });
    const paperSide = material(COLORS.paperSide, { metalness: 0, roughness: 0.9 });
    const ink = material(COLORS.ink);
    const teal = material(COLORS.teal, { roughness: 0.4, metalness: 0.22 });
    const amber = material(COLORS.amber, { roughness: 0.4, metalness: 0.28 });
    const dark = material(0x25434b);
    const paleTeal = material(0xb1ddd2);

    function mesh(group, geometry, mat, x = 0, y = 0, z = 0, casts = false) {
      const item = new THREE.Mesh(track(geometry), mat);
      item.position.set(x, y, z);
      item.castShadow = casts;
      item.receiveShadow = true;
      group.add(item);
      return item;
    }
    function box(group, sx, sy, sz, mat, x = 0, y = 0, z = 0, casts = false) {
      return mesh(group, new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z, casts);
    }
    function cylinder(group, top, bottom, length, mat, x, y, z, casts = false) {
      return mesh(group, new THREE.CylinderGeometry(top, bottom, length, 18), mat, x, y, z, casts);
    }
    function rod(group, a, b, radius, mat) {
      const from = new THREE.Vector3(...a);
      const to = new THREE.Vector3(...b);
      const item = cylinder(group, radius, radius, from.distanceTo(to), mat, 0, 0, 0);
      item.position.copy(from.clone().add(to).multiplyScalar(0.5));
      item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
      return item;
    }
    function slab(group, w, d, thickness, bevel, mat, y = 0) {
      const shape = new THREE.Shape();
      const x = -w / 2, z = -d / 2, r = bevel;
      shape.moveTo(x + r, z);
      shape.lineTo(x + w - r, z);
      shape.quadraticCurveTo(x + w, z, x + w, z + r);
      shape.lineTo(x + w, z + d - r);
      shape.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
      shape.lineTo(x + r, z + d);
      shape.quadraticCurveTo(x, z + d, x, z + d - r);
      shape.lineTo(x, z + r);
      shape.quadraticCurveTo(x, z, x + r, z);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        steps: 1, depth: thickness, bevelEnabled: true,
        bevelThickness: bevel / 3, bevelSize: bevel / 3, bevelSegments: 2, curveSegments: 3
      });
      geometry.rotateX(-Math.PI / 2);
      return mesh(group, geometry, mat, 0, y, 0, true);
    }
    function documentObject(group, x, y, z, scale = 1, lines = 4) {
      const page = new THREE.Group();
      page.position.set(x, y, z);
      page.scale.setScalar(scale);
      page.rotation.x = -0.13;
      page.rotation.y = -0.08;
      group.add(page);
      box(page, 1.16, 1.6, 0.07, paper, 0, 0, 0, true);
      box(page, 0.7, 0.09, 0.025, teal, -0.09, 0.54, 0.053);
      for (let line = 0; line < lines; line += 1) {
        box(page, line === lines - 1 ? 0.48 : 0.8, 0.042, 0.022, ink, -0.07, 0.29 - line * 0.22, 0.052);
      }
      return page;
    }
    function tick(group, x, y, z, size, mat = teal) {
      rod(group, [x - size * 0.4, y, z], [x - size * 0.1, y - size * 0.28, z], size * 0.085, mat);
      rod(group, [x - size * 0.1, y - size * 0.28, z], [x + size * 0.46, y + size * 0.37, z], size * 0.085, mat);
    }
    function dataPanel(group, x, y, z, scale = 1) {
      const panel = new THREE.Group();
      panel.position.set(x, y, z);
      panel.rotation.x = -0.17;
      panel.scale.setScalar(scale);
      group.add(panel);
      box(panel, 1.5, 1.32, 0.1, paperSide, 0, 0, 0, true);
      box(panel, 1.26, 0.16, 0.06, teal, 0, 0.45, 0.08);
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          box(panel, col === 0 ? 0.23 : 0.32, 0.14, 0.065,
            col === 0 ? teal : paper, -0.46 + col * 0.45, 0.16 - row * 0.26, 0.082);
        }
      }
      return panel;
    }
    function person(group, x, z, mat) {
      mesh(group, new THREE.SphereGeometry(0.18, 14, 10), paperSide, x, 1.27, z, true);
      cylinder(group, 0.15, 0.27, 0.5, mat, x, 0.82, z, true);
    }
    function buildObject(id, group) {
      if (id === 'contract') {
        for (let i = 0; i < 3; i += 1) {
          const page = documentObject(group, -0.12 + i * 0.13, 1.27 + i * 0.025, -0.3 + i * 0.1, 1.05, i === 2 ? 4 : 0);
          if (i < 2) page.children[0].material = paperSide;
        }
        box(group, 0.52, 0.13, 0.18, teal, 0.1, 2.13, -0.18, true);
        box(group, 0.62, 0.07, 0.48, dark, 0.72, 0.4, 0.39, true);
        tick(group, 0.74, 0.59, 0.58, 0.4);
      } else if (id === 'extract') {
        documentObject(group, -0.83, 1.14, -0.25, 0.7, 3);
        dataPanel(group, 0.43, 1.28, 0.03, 1.05);
        rod(group, [-0.86, 0.5, 0.5], [0.45, 0.5, 0.5], 0.045, teal);
        const arrow = mesh(group, new THREE.ConeGeometry(0.12, 0.24, 3), teal, 0.52, 0.5, 0.5);
        arrow.rotation.z = -Math.PI / 2;
      } else if (id === 'verify') {
        documentObject(group, -0.32, 1.31, -0.2, 1.03, 4);
        const lens = mesh(group, new THREE.TorusGeometry(0.48, 0.06, 10, 36), teal, 0.43, 1.39, 0.26, true);
        lens.rotation.y = -0.12;
        rod(group, [0.74, 1.02, 0.28], [1.12, 0.53, 0.35], 0.09, dark);
        tick(group, 0.42, 1.4, 0.32, 0.48);
      } else if (id === 'reconcile') {
        cylinder(group, 0.15, 0.27, 1.21, paperSide, 0, 0.98, 0, true);
        box(group, 1.95, 0.105, 0.16, amber, 0, 1.65, 0, true);
        for (const x of [-0.77, 0.77]) {
          rod(group, [x, 1.65, 0], [x, 0.99, 0], 0.025, amber);
          cylinder(group, 0.4, 0.31, 0.085, dark, x, 0.94, 0, true);
          box(group, 0.44, 0.19, 0.42, paper, x, 1.08, 0.03, true);
          box(group, 0.28, 0.09, 0.3, paleTeal, x, 1.22, 0.03);
        }
        box(group, 0.48, 0.065, 0.045, amber, 0, 0.79, 0.27);
        box(group, 0.48, 0.065, 0.045, amber, 0, 0.6, 0.27);
      } else if (id === 'recovery') {
        const page = documentObject(group, -0.15, 1.23, -0.14, 0.85, 3);
        box(page, 0.45, 0.24, 0.04, amber, 0.11, -0.38, 0.074);
        const arc = mesh(group, new THREE.TorusGeometry(0.68, 0.05, 10, 40, Math.PI * 1.55), teal, 0.3, 1.22, 0.23);
        arc.rotation.z = -Math.PI * 0.52;
        const arrow = mesh(group, new THREE.ConeGeometry(0.13, 0.26, 3), teal, -0.37, 1.19, 0.23);
        arrow.rotation.z = -0.12;
        box(group, 0.72, 0.06, 0.58, dark, 0.78, 0.4, 0.13);
      } else if (id === 'escalate') {
        documentObject(group, 0, 1.51, -0.31, 0.8, 3);
        box(group, 2.17, 0.14, 0.81, dark, 0, 0.68, 0.1, true);
        person(group, -0.86, 0.48, paleTeal);
        person(group, 0.86, 0.48, teal);
        rod(group, [0.61, 1.35, -0.34], [0.61, 2.12, -0.34], 0.025, amber);
        box(group, 0.38, 0.26, 0.05, amber, 0.77, 1.97, -0.34);
      } else if (id === 'output') {
        box(group, 2.14, 0.18, 1.05, dark, 0, 0.37, 0.04, true);
        for (let i = 0; i < 3; i += 1) {
          documentObject(group, -0.35 + i * 0.29, 1.18 + i * 0.11, -0.25 + i * 0.17, 0.72, 3);
        }
        box(group, 2.12, 0.32, 0.1, teal, 0, 0.61, 0.61, true);
        tick(group, 0.47, 1.11, 0.51, 0.55);
      }
    }

    const textMaterials = new Map();
    function textFace(group, text, w, h, x = 0, y = 0, z = 0.075, color = '#173c42') {
      const key = color + ':' + text;
      if (!textMaterials.has(key)) {
        const sheet = document.createElement('canvas');
        sheet.width = 512;
        sheet.height = 160;
        const context = sheet.getContext('2d');
        if (!context) throw new Error('Illustrative text unavailable');
        context.clearRect(0, 0, sheet.width, sheet.height);
        context.fillStyle = color;
        context.font = '700 76px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 256, 84, 478);
        const texture = track(new THREE.CanvasTexture(sheet));
        texture.colorSpace = THREE.SRGBColorSpace;
        textMaterials.set(key, track(new THREE.MeshBasicMaterial({
          map: texture, transparent: true, depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -1
        })));
      }
      return mesh(group, new THREE.PlaneGeometry(w, h), textMaterials.get(key), x, y, z);
    }
    function token(group, text, x, y, z, mat = paleTeal, w = 0.9, h = 0.34) {
      const item = new THREE.Group();
      item.position.set(x, y, z);
      group.add(item);
      box(item, w, h, 0.12, mat, 0, 0, 0, true);
      textFace(item, text, w * 0.92, h * 0.9);
      return item;
    }
    function exampleSheet(group, x, z = 0) {
      const sheet = new THREE.Group();
      sheet.position.set(x, 1.22, z);
      group.add(sheet);
      box(sheet, 1.28, 1.66, 0.11, paper, 0, 0, 0, true);
      box(sheet, 1.1, 0.1, 0.045, teal, 0, 0.69, 0.082);
      // Visible folded corner and side sheets give the demonstrations tangible
      // document depth rather than flat UI panels floating over the scene.
      box(sheet, 1.28, 1.66, 0.06, paperSide, -0.055, -0.035, -0.1, true);
      return sheet;
    }
    function lerpPosition(object, a, b, p, arc = 0) {
      object.position.set(
        THREE.MathUtils.lerp(a[0], b[0], p),
        THREE.MathUtils.lerp(a[1], b[1], p) + Math.sin(Math.PI * p) * arc,
        THREE.MathUtils.lerp(a[2], b[2], p)
      );
    }
    function demoArrow(group, a, b, mat = teal) {
      const arrow = new THREE.Group();
      group.add(arrow);
      rod(arrow, a, b, 0.035, mat);
      const end = new THREE.Vector3(...b);
      const direction = end.clone().sub(new THREE.Vector3(...a)).normalize();
      const tip = mesh(arrow, new THREE.ConeGeometry(0.11, 0.2, 3), mat);
      tip.position.copy(end);
      tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      return arrow;
    }
    function buildDemo(id, parent) {
      const group = new THREE.Group();
      group.visible = false;
      parent.add(group);
      const localLabels = [];
      function label(text, x, y, z, tone = 'neutral') {
        const item = element('span', 'ide-demo-object-label', text);
        item.dataset.tone = tone;
        item.dataset.demoObject = id;
        objectLabels.append(item);
        localLabels.push({ item, position: new THREE.Vector3(x, y, z) });
      }
      let update;
      if (id === 'contract') {
        exampleSheet(group, 0, -0.12);
        const fields = ['A', 'B', 'Total'].map((text, i) =>
          token(group, text + ' : #', -1.12, 1.7 - i * 0.47, 0.3, paleTeal, 1.08, 0.36));
        const rule = token(group, 'Total = A + B', 0, 0.51, 0.57, amber, 2.08, 0.31);
        const clasp = box(group, 0.38, 0.12, 0.25, teal, 0, 2.1, -0.1, true);
        label('Required · number', -0.85, 2.23, 0.1);
        label('Output · contract', 0.85, 2.23, 0.1);
        update = (a, b, c) => {
          fields.forEach((field, i) => {
            const q = cinematicEase(clamp(b * 1.65 - i * 0.24, 0, 1));
            lerpPosition(field, [-1.12, 1.7 - i * 0.47, 0.3], [0, 1.7 - i * 0.47, 0.15], q, 0.25);
            field.rotation.z = (1 - q) * -0.12;
          });
          rule.visible = b > 0.35;
          rule.scale.setScalar(Math.max(0.001, c));
          clasp.position.y = 2.45 - c * 0.35;
        };
      } else if (id === 'extract') {
        const source = exampleSheet(group, -0.81, -0.12);
        const record = exampleSheet(group, 0.81, 0.08);
        const values = ['A 100', 'B 50', 'T 160'];
        values.forEach((text, i) => textFace(source, text, 1.06, 0.3, 0, 0.35 - i * 0.43, 0.073));
        const fields = values.map((text, i) => token(group, text, -0.81, 1.57 - i * 0.43, 0.11, i === 2 ? amber : paleTeal, 1.05, 0.34));
        for (let i = 0; i < 3; i += 1) box(record, 1.08, 0.34, 0.03, dark, 0, 0.35 - i * 0.43, 0.071);
        const arrow = demoArrow(group, [-0.52, 0.49, 0.6], [0.58, 0.49, 0.6]);
        label('Input · source sheet', -0.82, 2.23, 0);
        label('Output · record', 0.82, 2.23, 0.15);
        update = (a, b, c) => {
          fields.forEach((field, i) => {
            const q = cinematicEase(clamp(b * 1.8 - i * 0.36, 0, 1));
            field.visible = b > 0 || c > 0;
            lerpPosition(field, [-0.81, 1.57 - i * 0.43, 0.11], [0.81, 1.57 - i * 0.43, 0.28], q, 0.44);
            field.rotation.y = Math.sin(q * Math.PI) * -0.5;
          });
          arrow.visible = b > 0 && c < 1;
        };
      } else if (id === 'verify') {
        const source = exampleSheet(group, -0.82, -0.1);
        textFace(source, 'A 100', 1.06, 0.31, 0, 0.29, 0.075);
        textFace(source, 'T 160 ?', 1.06, 0.31, 0, -0.27, 0.075);
        token(group, 'A 100', 0.86, 1.51, 0.1, paleTeal, 0.96);
        token(group, 'T 160 ?', 0.86, 0.96, 0.1, amber, 0.96);
        const lens = new THREE.Group();
        group.add(lens);
        mesh(lens, new THREE.TorusGeometry(0.35, 0.048, 10, 32), teal);
        rod(lens, [0.22, -0.26, 0], [0.44, -0.53, 0], 0.055, dark);
        const supported = demoArrow(group, [-0.2, 1.51, 0.25], [0.29, 1.51, 0.25]);
        const uncertain = demoArrow(group, [-0.2, 0.95, 0.25], [0.29, 0.95, 0.25], amber);
        const yes = token(group, 'Supported', 0.85, 1.96, 0.26, paleTeal, 1.18, 0.26);
        const no = token(group, 'Unresolved', 0.79, 0.51, 0.35, amber, 1.3, 0.26);
        label('Input · evidence', -0.85, 2.25, 0);
        label('Output · field status', 0.85, 2.25, 0.1);
        update = (a, b, c) => {
          lens.position.set(-0.82 + Math.sin(b * Math.PI) * 0.2, 1.51 - b * 0.56, 0.32);
          supported.visible = b > 0.1;
          uncertain.visible = b > 0.6;
          yes.visible = b > 0.25;
          no.visible = c > 0;
        };
      } else if (id === 'reconcile') {
        cylinder(group, 0.13, 0.26, 0.95, paperSide, 0, 0.88, 0, true);
        const balance = new THREE.Group();
        balance.position.set(0, 1.32, 0);
        group.add(balance);
        box(balance, 2.5, 0.1, 0.2, amber, 0, 0, 0, true);
        for (const x of [-0.9, 0.9]) {
          cylinder(balance, 0.48, 0.4, 0.11, dark, x, -0.26, 0.02, true);
          rod(balance, [x, 0, 0], [x, -0.24, 0], 0.025, amber);
        }
        const aValue = token(group, '100', -1.1, 1.88, 0.23, paleTeal, 0.78, 0.4);
        const bValue = token(group, '+ 50', -0.52, 1.51, 0.36, paleTeal, 0.8, 0.37);
        const sum = token(group, '150', -0.9, 1.74, 0.23, paleTeal, 1.06, 0.43);
        const reported = token(group, '160', 0.91, 1.74, 0.23, amber, 1.06, 0.43);
        const mismatch = token(group, '150 ≠ 160', 0, 0.66, 0.61, amber, 1.93, 0.38);
        const difference = token(group, 'Difference 10', 0, 0.44, 1.14, amber, 2.02, 0.3);
        label('Input · 100 + 50', -0.86, 2.29, 0);
        label('Compare · total 160', 0.86, 2.29, 0);
        update = (a, b, c) => {
          lerpPosition(aValue, [-1.1, 1.88, 0.23], [-0.9, 1.7, 0.23], b);
          lerpPosition(bValue, [-0.52, 1.51, 0.36], [-0.9, 1.7, 0.23], b);
          aValue.visible = b < 0.7;
          bValue.visible = b < 0.7;
          sum.visible = b >= 0.7;
          balance.rotation.z = -c * 0.14;
          sum.position.y = 1.74 + c * 0.13;
          reported.position.y = 1.74 - c * 0.13;
          mismatch.visible = c > 0;
          difference.visible = c > 0.45;
        };
      } else if (id === 'recovery') {
        exampleSheet(group, -0.82, -0.12);
        token(group, 'A 100', -0.82, 1.64, 0.08, paleTeal, 1.07);
        token(group, 'B 50', -0.82, 1.19, 0.08, paleTeal, 1.07);
        const flagged = token(group, 'T 160', -0.82, 0.74, 0.12, amber, 1.07);
        const candidate = token(group, '150 ?', 0.67, 1.21, 0.25, amber, 1.12, 0.42);
        const lens = mesh(group, new THREE.TorusGeometry(0.43, 0.05, 10, 32), teal, 0.83, 1.67, 0.12);
        rod(group, [1.1, 1.33, 0.12], [1.33, 1.03, 0.12], 0.055, dark);
        const back = demoArrow(group, [0.63, 0.62, 0.43], [0.89, 1.1, 0.43], amber);
        const pending = token(group, 'Re-check', 0.79, 0.49, 0.56, amber, 1.23, 0.3);
        label('Input · one flagged field', -0.84, 2.24, 0);
        label('Output · candidate only', 0.84, 2.24, 0);
        update = (a, b, c) => {
          lerpPosition(flagged, [-0.82, 0.74, 0.12], [0.67, 1.21, 0.25], b, 0.62);
          flagged.visible = b < 0.88;
          candidate.visible = b >= 0.88;
          lerpPosition(candidate, [0.67, 1.21, 0.25], [0.83, 1.67, 0.25], c, 0.22);
          lens.rotation.z = 0;
          back.visible = c > 0 && c < 1;
          pending.visible = c > 0.3;
        };
      } else if (id === 'escalate') {
        const packet = new THREE.Group();
        group.add(packet);
        box(packet, 1.02, 1.25, 0.14, paper, 0, 0, 0, true);
        box(packet, 1.02, 1.25, 0.1, paperSide, -0.07, 0.08, -0.13, true);
        token(packet, 'T 160 ?', 0, 0.18, 0.16, amber, 0.95);
        textFace(packet, 'Evidence', 0.91, 0.3, 0, -0.32, 0.085);
        const desk = box(group, 1.5, 0.15, 0.82, dark, 0.7, 0.73, 0.05, true);
        const reviewer = new THREE.Group();
        reviewer.position.y = 0.25;
        group.add(reviewer);
        person(reviewer, 1.16, -0.08, paleTeal);
        const gate = token(group, 'Await decision', 0, 0.5, 1.04, amber, 2.06, 0.32);
        const arrow = demoArrow(group, [-0.72, 0.46, 0.56], [0.72, 0.46, 0.56], amber);
        label('Input · exception packet', -0.82, 2.28, 0);
        label('Output · human review', 0.84, 2.28, 0);
        update = (a, b, c) => {
          lerpPosition(packet, [-0.92, 1.28, 0.18], [0.25, 1.2, 0.5], b, 0.55);
          packet.rotation.y = b * -0.2;
          packet.rotation.x = c * -0.4;
          gate.visible = c > 0;
          arrow.visible = b > 0 && c < 1;
          desk.scale.set(1, 1, 1);
        };
      } else if (id === 'output') {
        box(group, 2.5, 0.18, 1.5, dark, 0, 0.41, 0.15, true);
        const sheets = ['Record', 'Evidence', 'Quality state'].map((text, i) => {
          const sheet = new THREE.Group();
          group.add(sheet);
          box(sheet, 1.39, 1.47, 0.09, i === 2 ? paleTeal : paper, 0, 0, 0, true);
          textFace(sheet, text, 1.23, 0.34, 0, 0.37, 0.069);
          box(sheet, 1.05, 0.035, 0.025, ink, 0, -0.06, 0.065);
          box(sheet, 0.78, 0.035, 0.025, ink, -0.14, -0.29, 0.065);
          return sheet;
        });
        const exception = token(group, 'Review state', 0, 0.8, 0.89, amber, 2.07, 0.36);
        const band = box(group, 2.17, 0.13, 0.11, teal, 0, 0.49, 0.95, true);
        label('Input · three layers', -0.85, 2.78, 0);
        label('Output · reviewable bundle', 0.85, 2.78, 0);
        update = (a, b, c) => {
          sheets.forEach((sheet, i) => {
            lerpPosition(sheet, [-0.96 + i * 0.96, 1.65 + i * 0.12, -0.8 + i * 0.65],
              [-0.86 + i * 0.86, 1.9 - i * 0.48, -0.16 + i * 0.21], b, 0.2);
            sheet.rotation.y = (1 - b) * (i - 1) * 0.18;
            sheet.scale.setScalar(1 - b * 0.22);
          });
          exception.visible = c > 0;
          band.scale.x = Math.max(0.001, c);
        };
      }
      function sample(progress) {
        const t = progress * 3;
        update(cinematicEase(clamp(t, 0, 1)), cinematicEase(clamp(t - 1, 0, 1)), cinematicEase(clamp(t - 2, 0, 1)));
      }
      sample(1);
      return { group, labels: localLabels, sample };
    }

    const ground = material(0x0c222c, { roughness: 0.94, metalness: 0 });
    box(world, 200, 0.1, 200, ground, 0, -0.83, 0);
    const board = new THREE.Group();
    world.add(board);
    slab(board, 18.5, 15.8, 0.36, 0.3, material(0x1c3942), -0.7);
    slab(board, 18.25, 15.55, 0.075, 0.27, material(0x26434b), -0.3);
    // A thin perimeter and recessed lanes make the miniature read as one
    // operating model, not unrelated floating objects.
    for (const x of [-8.8, 8.8]) box(board, 0.025, 0.012, 14.5, ink, x, -0.2, 0);
    for (const z of [-7.3, 7.3]) box(board, 17.6, 0.012, 0.025, ink, 0, -0.2, z);

    function createLabel(node, isPicker) {
      const item = element('li', isPicker ? '' : 'ide-scene-label-item');
      const button = element('button', isPicker ? '' : 'ide-scene-label');
      button.type = 'button';
      button.dataset.sceneNode = node.id;
      button.dataset.decision = String(Boolean(node.decision));
      button.setAttribute('aria-controls', 'wm-ide-inspector-title');
      const heading = element('span', 'ide-scene-label-heading');
      const index = element('span', 'ide-scene-label-index', String(node.source + 1).padStart(2, '0'));
      index.setAttribute('aria-hidden', 'true');
      heading.append(index, element('span', 'ide-scene-label-name', node.label));
      button.append(heading, element('span', 'ide-scene-label-state'));
      item.append(button);
      if (!isPicker) {
        const number = element('span', 'ide-scene-number', String(node.source + 1).padStart(2, '0'));
        number.setAttribute('aria-hidden', 'true');
        item.append(number);
      }
      listen(button, 'click', () => onSelect(node.id));
      (isPicker ? picker : labels).append(item);
      return { item, button };
    }
    model.nodes.forEach(node => {
      const [x, z] = POSITIONS[node.id];
      const group = new THREE.Group();
      group.userData.nodeId = node.id;
      group.position.set(x, 0, z);
      world.add(group);
      // Station docks stay connected while the selected stage rises above one.
      const dock = new THREE.Group();
      dock.position.set(x, 0, z);
      world.add(dock);
      slab(dock, 3.43, 2.43, 0.06, 0.14, dark, -0.11);
      cylinder(dock, 0.3, 0.4, 0.65, material(0x335c61), 0, 0.1, 0);
      const stageMaterial = material(COLORS.base, { roughness: 0.45, metalness: 0.22 });
      slab(group, 3.28, 2.26, 0.22, 0.16, stageMaterial, 0.03);
      slab(group, 3.13, 2.1, 0.035, 0.12, material(0x36565b), 0.28);
      const railMaterial = material(node.decision ? COLORS.amber : 0x718c90);
      box(group, 2.82, 0.034, 0.04, railMaterial, 0, 0.28, 1.08);
      if (node.decision) {
        const marker = box(group, 0.16, 0.025, 0.16, amber, -1.32, 0.32, 0.75);
        marker.rotation.y = Math.PI / 4;
      }
      const illustration = new THREE.Group();
      group.add(illustration);
      buildObject(node.id, illustration);
      // Each station owns its object finishes so the foreground can separate
      // from the receding world without hiding or removing any workflow node.
      const finishes = new Map();
      group.traverse(object => {
        if (!object.isMesh || object.material === stageMaterial || object.material === railMaterial) return;
        const original = object.material;
        if (!finishes.has(original)) finishes.set(original, {
          material: track(original.clone()), color: original.color.clone()
        });
        object.material = finishes.get(original).material;
      });
      stages.set(node.id, {
        group, stageMaterial, railMaterial, finishes: [...finishes.values()], exposure: 1,
        illustration, demo: buildDemo(node.id, group),
        label: createLabel(node, false), picker: createLabel(node, true), node
      });
    });

    function roundedCurve(points) {
      const path = new THREE.CurvePath();
      const vertices = points.map(([x, z]) => new THREE.Vector3(x, -0.02, z));
      let previous = vertices[0];
      for (let i = 1; i < vertices.length - 1; i += 1) {
        const corner = vertices[i];
        const before = vertices[i - 1];
        const after = vertices[i + 1];
        const distance = Math.min(0.28, corner.distanceTo(before) / 3, corner.distanceTo(after) / 3);
        const a = corner.clone().add(before.clone().sub(corner).normalize().multiplyScalar(distance));
        const b = corner.clone().add(after.clone().sub(corner).normalize().multiplyScalar(distance));
        path.add(new THREE.LineCurve3(previous, a));
        path.add(new THREE.QuadraticBezierCurve3(a, corner, b));
        previous = b;
      }
      path.add(new THREE.LineCurve3(previous, vertices[vertices.length - 1]));
      return path;
    }
    model.edges.forEach(edge => {
      const id = edge.from + '>' + edge.to;
      if (!HANDOFFS[id]) throw new Error('IDE handoff geometry is incomplete');
      const curve = roundedCurve(HANDOFFS[id]);
      const length = curve.getLength();
      const railMaterial = material(0x4e6870, { roughness: 0.65 });
      const solid = mesh(world, new THREE.TubeGeometry(curve, Math.max(8, Math.ceil(length * 5)), 0.035, 6, false), railMaterial);
      const dashMaterial = material(0x9db9bb);
      const dashed = new THREE.Group();
      const count = Math.max(2, Math.ceil(length / 0.29));
      for (let i = 0; i < count; i += 1) {
        const a = curve.getPointAt(i / count);
        const b = curve.getPointAt((i + 0.5) / count);
        rod(dashed, a.toArray(), b.toArray(), 0.04, dashMaterial);
      }
      world.add(dashed);
      const end = curve.getPointAt(1);
      const tangent = curve.getTangentAt(1).normalize();
      const arrowMaterial = material(0x738a90);
      const arrow = mesh(world, new THREE.ConeGeometry(0.13, 0.32, 3), arrowMaterial);
      arrow.position.copy(end.clone().addScaledVector(tangent, -0.13));
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      const highlight = mesh(world, solid.geometry.clone(), material(0xa8f0dc, { emissive: 0x276d61, emissiveIntensity: 0.35 }));
      highlight.scale.set(1, 1, 1);
      highlight.visible = false;
      edges.set(id, { ...edge, curve, solid, dashed, railMaterial, arrowMaterial, highlight });
    });
    const packetObject = new THREE.Group();
    box(packetObject, 0.34, 0.09, 0.43, paper, 0, 0, 0, true);
    box(packetObject, 0.19, 0.018, 0.055, teal, 0, 0.058, -0.06);
    box(packetObject, 0.19, 0.018, 0.032, ink, 0, 0.058, 0.06);
    world.add(packetObject);
    packetObject.visible = false;

    function updateDemoUI() {
      if (!state) return;
      const description = EXAMPLES[demoNode || state.node];
      const text = focusMode === 'overview'
        ? 'Overview shows route connections. Choose Focus stage to watch the synthetic example.'
        : demoPending ? 'Moving to the selected stage; its three-part example starts when the camera settles.'
          : description[demoPhase];
      if (demoCaption.textContent !== text) demoCaption.textContent = text;
      demoPhases.querySelectorAll('button').forEach(button => {
        const current = Number(button.dataset.sceneDemoPhase) === demoPhase;
        button.setAttribute('aria-pressed', String(current));
        button.disabled = focusMode !== 'focus';
      });
      replay.disabled = reduced || focusMode !== 'focus';
      replay.textContent = reduced ? 'Static example' : 'Replay stage';
      demoFill.style.transform = `scaleX(${demoProgress})`;
      root.dataset.sceneDemoNode = demoNode || state.node;
      root.dataset.sceneDemoPhase = ['input', 'action', 'output'][demoPhase];
      root.dataset.sceneDemoProgress = demoProgress.toFixed(3);
      root.dataset.sceneDemoStatus = demoStatus;
    }
    function renderDemoObjects() {
      if (!state) return;
      stages.forEach((stage, id) => {
        const selected = focusMode === 'focus' && id === state.node;
        stage.demo.group.visible = selected;
        stage.illustration.visible = !selected;
        if (selected) stage.demo.sample(demoProgress);
        stage.demo.labels.forEach(label => {
          label.item.hidden = !selected || Boolean(transition);
        });
      });
      renderer.shadowMap.needsUpdate = true;
      updateDemoUI();
    }
    function finishDemo() {
      demoNode = state?.node || demoNode;
      demoStart = null;
      demoPending = false;
      demoProgress = 1;
      demoPhase = 2;
      demoStatus = reduced ? 'static' : 'complete';
      renderDemoObjects();
    }
    function prepareDemo() {
      demoNode = state.node;
      demoStart = null;
      const animate = active && visible && !document.hidden && !reduced && focusMode === 'focus';
      demoPending = animate;
      demoProgress = animate ? 0 : 1;
      demoPhase = animate ? 0 : 2;
      demoStatus = animate ? 'waiting' : reduced ? 'static' : 'complete';
      renderDemoObjects();
      queueFrame();
    }
    function sampleDemo(now) {
      if (demoPending && !transition) {
        demoStart = now;
        demoPending = false;
        demoStatus = 'running';
      }
      if (demoStart !== null) {
        demoProgress = clamp((now - demoStart) / TIMING.demo, 0, 1);
        demoPhase = Math.min(2, Math.floor(demoProgress * 3));
        if (demoProgress === 1) { demoStart = null; demoStatus = 'complete'; }
        renderDemoObjects();
      }
    }
    function placeDemoLabels() {
      if (!state || focusMode !== 'focus' || transition) return;
      const stage = stages.get(state.node);
      stage.group.updateWorldMatrix(true, false);
      const points = stage.demo.labels.map(label => {
        const anchor = stage.group.localToWorld(label.position.clone());
        return { ...label, screen: screenPoint(anchor.x, anchor.y, anchor.z) };
      }).sort((a, b) => a.screen.x - b.screen.x);
      const labelWidth = Math.min(154, (width - 36) / 2);
      // Two named anchors per demonstration. Resolve horizontally at all camera
      // offsets; names stay readable rather than inheriting 3D text foreshortening.
      let previousRight = 8;
      points.forEach((label, i) => {
        const remaining = (points.length - i) * (labelWidth + 8);
        const x = clamp(label.screen.x - labelWidth / 2, previousRight, width - remaining);
        label.item.style.width = labelWidth + 'px';
        const y = clamp(label.screen.y - label.item.offsetHeight - 14, width < 900 ? 116 : 66, height - 70);
        label.item.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
        previousRight = x + labelWidth + 8;
      });
    }

    function syncDiagnostics() {
      root.dataset.sceneNode = state ? state.node : '';
      root.dataset.sceneActive = String(active && visible && !document.hidden && !disposed);
      root.dataset.sceneAnimating = String(Boolean(active && visible && !document.hidden && (transition || packet || demoStart !== null || demoPending)));
      root.dataset.scenePacket = String(Boolean(packet && packetObject.visible));
      root.dataset.sceneHandoff = lastHandoff;
      root.dataset.sceneCameraYaw = cameraState.yaw.toFixed(2);
      root.dataset.sceneCameraElevation = cameraState.elevation.toFixed(2);
      root.dataset.sceneCameraZoom = cameraState.zoom.toFixed(2);
      root.dataset.sceneRenderCount = String(renderCount);
      root.dataset.sceneReducedMotion = String(reduced);
      root.dataset.sceneFocusMode = focusMode;
      root.dataset.sceneTransitionProgress = transitionProgress.toFixed(3);
      root.dataset.sceneTransitionDirection = String(transitionDirection);
    }
    Object.defineProperty(root, 'ideSceneDiagnostics', {
      configurable: true,
      get: () => Object.freeze({
        mode: root.dataset.sceneMode, status: root.dataset.sceneStatus,
        node: state?.node, route: state?.route, step: state?.step, view: state?.view,
        playing: Boolean(state?.playing), active, visible, disposed, reducedMotion: reduced,
        animationActive: root.dataset.sceneAnimating === 'true',
        packetEdge: packet ? packet.edge : null, lastHandoff,
        packetProgress: packet ? clamp((performance.now() - packet.start) / TIMING.packet, 0, 1) : null,
        camera: Object.freeze({ ...cameraState }), bounds: BOUNDS, timing: TIMING,
        cameraType: 'PerspectiveCamera', focusMode,
        cameraPosition: Object.freeze(camera.position.toArray()),
        cameraTarget: Object.freeze(cameraPose.target.toArray()),
        cameraPose: Object.freeze({
          radius: cameraPose.radius, azimuth: cameraPose.azimuth,
          elevation: cameraPose.elevation, focus: cameraPose.focus, fov: camera.fov
        }),
        transitionProgress, transitionDirection,
        demoNode, demoPhase: ['input', 'action', 'output'][demoPhase],
        demoPhaseIndex: demoPhase, demoProgress, demoStatus, demoPending,
        demoActive: demoStart !== null,
        demoObjectPositions: Object.freeze(Object.fromEntries([...stages].map(([id, stage]) => [
          id, Object.freeze(stage.demo.group.children.filter(item => item.isGroup).map(item =>
            Object.freeze(item.position.toArray())))
        ]))),
        stageTransforms: Object.freeze(Object.fromEntries([...stages].map(([id, stage]) => [id, Object.freeze({
          position: Object.freeze(stage.group.position.toArray()),
          rotation: Object.freeze([stage.group.rotation.x, stage.group.rotation.y, stage.group.rotation.z]),
          scale: stage.group.scale.x, exposure: stage.exposure
        })]))),
        labelLayout: compact ? 'compact' : 'full', renderCount,
        drawCalls: renderer.info.render.calls, pixelRatio: renderer.getPixelRatio()
      })
    });

    const project = new THREE.Vector3();
    function screenPoint(x, y, z) {
      project.set(x, y, z).project(camera);
      return { x: (project.x + 1) * width / 2, y: (1 - project.y) * height / 2 };
    }
    function applyCamera() {
      const yaw = radians(cameraPose.azimuth);
      const elevation = radians(cameraPose.elevation);
      camera.position.set(
        Math.sin(yaw) * Math.cos(elevation) * cameraPose.radius,
        Math.sin(elevation) * cameraPose.radius,
        Math.cos(yaw) * Math.cos(elevation) * cameraPose.radius
      ).add(cameraPose.target);
      camera.lookAt(cameraPose.target);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      world.fog.near = THREE.MathUtils.lerp(35, 11, cameraPose.focus);
      world.fog.far = THREE.MathUtils.lerp(85, 31, cameraPose.focus);
      focusLight.position.set(cameraPose.target.x - 3, 13, cameraPose.target.z + 6);
      focusLight.target.position.copy(cameraPose.target);
      cameraButtons.querySelector('[data-scene-camera="left"]').disabled = cameraState.yaw <= BOUNDS.yaw[0] + 0.01;
      cameraButtons.querySelector('[data-scene-camera="right"]').disabled = cameraState.yaw >= BOUNDS.yaw[1] - 0.01;
      cameraButtons.querySelector('[data-scene-camera="in"]').disabled = cameraState.zoom >= BOUNDS.zoom[1] - 0.001;
      cameraButtons.querySelector('[data-scene-camera="out"]').disabled = cameraState.zoom <= BOUNDS.zoom[0] + 0.001;
    }
    function placeLabels() {
      // The native seven-stage strip is always available. Spatial labels are
      // only decorative overview numbers: a close-up never inherits overlapping
      // background labels or hides the user's only route to another stage.
      compact = true;
      root.dataset.sceneLabels = 'compact';
      root.dataset.sceneFocusMode = focusMode;
      labels.setAttribute('aria-hidden', 'true');
      stages.forEach(stage => {
        stage.group.updateWorldMatrix(true, false);
        const anchor = stage.group.localToWorld(new THREE.Vector3(0, 0.33, 1.08));
        const p = screenPoint(anchor.x, anchor.y, anchor.z);
        stage.label.item.style.transform = `translate(${(p.x - 12).toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        stage.label.item.dataset.current = String(stage.node.id === state?.node);
      });
      pickerWrap.setAttribute('aria-hidden', 'false');
      perspectiveControls.querySelectorAll('[data-scene-view]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.sceneView === focusMode));
      });
      help.textContent = reduced
        ? 'Reduced motion: instant perspective poses. Stage selection and manual camera controls remain available.'
        : focusMode === 'focus'
          ? 'Drag to look around the foreground stage. Overview shows every directed handoff; Next brings the next stage forward.'
          : 'All seven stages and their directed handoffs. Choose Focus stage for an immersive close-up.';
    }
    function desiredPose() {
      if (focusMode === 'overview') return {
        target: new THREE.Vector3(0, 0.5, 0),
        radius: Math.max(32, 29 / (width / height)) / cameraState.zoom,
        azimuth: 12 + cameraState.yaw * 0.45,
        elevation: 55 + cameraState.elevation * 0.5, focus: 0
      };
      const [x, z] = POSITIONS[state.node];
      const azimuth = 30 + cameraState.yaw;
      const target = new THREE.Vector3(x, width < 760 ? 4.85 : 4.4, z);
      // Reserve editorial title space on wide screens without obscuring the
      // geometry. Mobile centers the selected platform in its own safe area.
      if (width >= 760) target.add(new THREE.Vector3(
        -Math.cos(radians(azimuth)) * 1.25, 0, Math.sin(radians(azimuth)) * 1.25
      ));
      return {
        target, radius: Math.max(10.8, 8.7 / (width / height)) / cameraState.zoom,
        azimuth, elevation: 24 + cameraState.elevation, focus: 1
      };
    }
    function desiredStage(stage) {
      const chosen = stage.node.id === state.node;
      const focus = focusMode === 'focus';
      return {
        y: chosen ? focus ? 2.65 : 0.4 : 0,
        rx: chosen && focus ? -0.055 : 0,
        ry: chosen && focus ? radians(10 + [-8, 6, -4, 8, -6, 4, -2][stage.node.source]) : 0,
        rz: 0, scale: focus ? chosen ? 1.36 : 0.82 : 1,
        exposure: focus ? chosen ? 1 : 0.36 : 1
      };
    }
    function captureStage(stage) {
      return {
        y: stage.group.position.y, rx: stage.group.rotation.x,
        ry: stage.group.rotation.y, rz: stage.group.rotation.z,
        scale: stage.group.scale.x, exposure: stage.exposure
      };
    }
    function applyStage(stage, pose) {
      stage.group.position.y = pose.y;
      stage.group.rotation.set(pose.rx, pose.ry, pose.rz);
      stage.group.scale.setScalar(pose.scale);
      stage.exposure = pose.exposure;
      stage.finishes.forEach(finish => {
        finish.material.color.copy(finish.color).multiplyScalar(pose.exposure);
      });
    }
    function sampleTransition(now) {
      if (!transition) return;
      const t = clamp((now - transition.start) / transition.duration, 0, 1);
      const p = cinematicEase(t);
      const arc = Math.sin(Math.PI * p);
      transitionProgress = t;
      cameraPose.target.lerpVectors(transition.from.target, transition.to.target, p);
      for (const key of ['radius', 'azimuth', 'elevation', 'focus']) {
        cameraPose[key] = THREE.MathUtils.lerp(transition.from[key], transition.to[key], p);
      }
      // Pull out, orbit over the handoff, then dolly into the new foreground.
      // The sine envelope is zero at both ends, including on interruption.
      // Leave room for the tilted foreground platform during the widest turn,
      // not just for the upright object in its final close-up.
      cameraPose.radius += arc * transition.sweep * 4.8;
      cameraPose.target.y -= arc * transition.sweep * 0.65;
      cameraPose.azimuth += arc * transition.direction * transition.sweep * 38;
      cameraPose.elevation += arc * transition.sweep * 8;
      stages.forEach((stage, id) => {
        const a = transition.stages[id].from, b = transition.stages[id].to;
        const pose = {};
        for (const key of Object.keys(a)) pose[key] = THREE.MathUtils.lerp(a[key], b[key], p);
        if (id === transition.selected) {
          pose.y += arc * transition.sweep * 0.68;
          // Counter-turn against the camera orbit: the viewer sees the side
          // thickness and layered objects rotate into their final frontal pose.
          pose.ry -= arc * transition.direction * transition.sweep * 0.96;
          pose.rx += arc * transition.sweep * 0.16;
          pose.rz -= arc * transition.direction * transition.sweep * 0.1;
          pose.scale += arc * transition.sweep * 0.08;
        }
        applyStage(stage, pose);
      });
      renderer.shadowMap.needsUpdate = true;
      if (t >= 1) { transition = null; transitionProgress = 1; }
    }
    function beginTransition(direction = 1, choreograph = true) {
      sampleTransition(performance.now());
      finishDemo();
      transitionDirection = direction;
      if (reduced || !active || !visible || document.hidden) { settle(); return; }
      transition = {
        start: performance.now(), duration: choreograph ? TIMING.transition : TIMING.camera,
        from: { ...cameraPose, target: cameraPose.target.clone() }, to: desiredPose(),
        direction, sweep: choreograph ? focusMode === 'focus' ? 1 : 0.32 : 0,
        selected: state.node,
        stages: Object.fromEntries([...stages].map(([id, stage]) => [id, {
          from: captureStage(stage), to: desiredStage(stage)
        }]))
      };
      transitionProgress = 0;
      queueFrame();
      syncDiagnostics();
    }
    function settle() {
      transition = null;
      transitionProgress = 1;
      packet = null;
      packetObject.visible = false;
      if (state) {
        cameraPose = desiredPose();
        stages.forEach(stage => applyStage(stage, desiredStage(stage)));
        applyCamera();
        finishDemo();
      }
      edges.forEach(edge => { edge.highlight.visible = false; });
      renderer.shadowMap.needsUpdate = true;
      syncDiagnostics();
    }
    function cancelFrame() {
      if (frameID !== null) cancelAnimationFrame(frameID);
      frameID = null;
    }
    function syncVisibility(bounds = frame.getBoundingClientRect()) {
      // Intersection records can describe an earlier hidden/layout state.
      // Always use the current box, including when scroll restoration or a
      // display-mode change does not create a new threshold crossing.
      const next = bounds.width > 0 && bounds.height > 0 &&
        bounds.bottom > 0 && bounds.top < innerHeight &&
        bounds.right > 0 && bounds.left < innerWidth;
      if (next === visible) return;
      visible = next;
      if (!visible) { cancelFrame(); settle(); }
      else {
        if (active && firstDemo) { firstDemo = false; prepareDemo(); }
        queueFrame();
      }
      syncDiagnostics();
    }
    function queueFrame() {
      if (disposed || !active || !visible || document.hidden || frameID !== null) return;
      frameID = requestAnimationFrame(draw);
    }
    function draw(now) {
      frameID = null;
      if (disposed || !active || !visible || document.hidden) return;
      try {
        sampleTransition(now);
        sampleDemo(now);
        if (packet) {
          const t = clamp((now - packet.start) / TIMING.packet, 0, 1);
          const edge = edges.get(packet.edge);
          const point = edge.curve.getPointAt(t);
          const tangent = edge.curve.getTangentAt(t);
          packetObject.position.copy(point);
          packetObject.position.y += 0.19;
          packetObject.rotation.y = Math.atan2(tangent.x, tangent.z);
          packetObject.visible = true;
          if (t >= 1) {
            edge.highlight.visible = false;
            packetObject.visible = false;
            packet = null;
          }
        }
        applyCamera();
        placeLabels();
        renderDemoObjects();
        placeDemoLabels();
        renderer.render(world, camera);
        renderCount += 1;
        syncDiagnostics();
        if (transition || packet || demoStart !== null || demoPending) queueFrame();
      } catch (error) { onError(error); }
    }
    function resize() {
      if (disposed) return;
      const bounds = frame.getBoundingClientRect();
      syncVisibility(bounds);
      if (!bounds.width || !bounds.height) return;
      width = bounds.width;
      height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2200000 / (width * height)));
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      if (!transition && state) cameraPose = desiredPose();
      applyCamera();
      placeLabels();
      placeDemoLabels();
      queueFrame();
    }
    function setState(next) {
      if (disposed || !next) return;
      const previous = state;
      const moved = previous && previous.node !== next.node;
      const routeChanged = previous && previous.route !== next.route;
      const occurrenceChanged = previous && previous.step !== next.step;
      if (moved || routeChanged || (previous && (previous.view !== next.view || (previous.playing && !next.playing && previous.step === next.step)))) {
        // Preserve in-flight heights for smooth handoff; cancel the old packet.
        packet = null;
        packetObject.visible = false;
        edges.forEach(edge => { edge.highlight.visible = false; });
      }
      state = { ...next };
      const route = model.routes.find(item => item.id === state.route);
      const terminal = state.step === route.steps.length - 1;
      walkthroughStatus.textContent = route.label + ' · Step ' + (state.step + 1) + ' of ' + route.steps.length +
        ' · ' + stages.get(state.node).node.label + (terminal ? ' · End of route' : state.playing ? ' · Playing' : '');
      walkthroughControls.querySelector('[data-scene-action="previous"]').disabled = state.step === 0;
      walkthroughControls.querySelector('[data-scene-action="next"]').disabled = terminal;
      const mirroredPlay = walkthroughControls.querySelector('[data-scene-action="play"]');
      mirroredPlay.disabled = reduced || terminal;
      mirroredPlay.textContent = state.playing ? 'Pause' : 'Play';
      mirroredPlay.setAttribute('aria-pressed', String(state.playing));
      const visited = route.steps.slice(0, state.step);
      const canAnimate = !reduced && active && visible && !document.hidden;
      if ((moved || occurrenceChanged) && canAnimate) {
        const direction = previous.route === state.route
          ? Math.sign(state.step - previous.step) || 1
          : Math.sign(stages.get(state.node).node.source - stages.get(previous.node).node.source) || 1;
        beginTransition(direction);
      } else if (!previous || !canAnimate) settle();
      if (moved || occurrenceChanged || routeChanged) {
        firstDemo = false;
        prepareDemo();
      } else if (previous && !previous.playing && state.playing && canAnimate) prepareDemo();
      const focused = stages.get(state.node).node;
      focusKind.textContent = 'Stage ' + String(focused.source + 1).padStart(2, '0') + ' / ' + focused.kind;
      focusTitle.textContent = focused.label;
      stages.forEach((stage, id) => {
        const current = id === state.node;
        const status = current ? 'current' : visited.includes(id) ? 'visited' : route.steps.includes(id) ? 'ahead' : 'other';
        const text = current ? 'Current stage' : status === 'visited' ? 'Visited on this route' : status === 'ahead' ? 'Ahead on this route' : 'Explore another route';
        stage.stageMaterial.color.setHex(current ? COLORS.current : status === 'visited' ? COLORS.visited : COLORS.base);
        stage.railMaterial.color.setHex(current || status === 'visited' ? COLORS.teal : stage.node.decision ? COLORS.amber : 0x718c90);
        for (const { button } of [stage.label, stage.picker]) {
          button.dataset.routeState = status;
          button.dataset.stateText = text;
          button.setAttribute('aria-pressed', String(current));
          if (current) button.setAttribute('aria-current', 'step');
          else button.removeAttribute('aria-current');
          button.querySelector('.ide-scene-label-state').textContent = text;
        }
      });
      edges.forEach(edge => {
        let onRoute = false, walked = false;
        route.steps.forEach((id, i) => {
          if (id === edge.from && route.steps[i + 1] === edge.to) {
            onRoute = true;
            if (i < state.step) walked = true;
          }
        });
        edge.dashed.visible = onRoute && !walked;
        edge.railMaterial.color.setHex(walked ? 0x76cdbb : onRoute ? 0x3e5962 : 0x526d73);
        edge.arrowMaterial.color.setHex(walked ? 0x98e8cf : onRoute ? 0xb4ccca : 0x647d84);
      });
      const handoff = previous ? previous.node + '>' + state.node : '';
      if (previous && previous.route === state.route && previous.step + 1 === state.step && edges.has(handoff)) {
        lastHandoff = handoff;
        if (canAnimate) {
          packet = { edge: handoff, start: performance.now() };
          edges.get(handoff).highlight.visible = true;
        }
      } else if (moved || routeChanged) lastHandoff = '';
      if (!moved && previous && (previous.view !== state.view || (previous.playing && !state.playing && !occurrenceChanged))) settle();
      renderer.shadowMap.needsUpdate = true;
      syncDiagnostics();
      queueFrame();
    }
    function setActive(value) {
      if (disposed) return;
      active = value;
      if (!value) {
        drag = null;
        canvas.dataset.dragging = 'false';
        cancelFrame();
        settle();
      } else {
        resize();
        if (firstDemo && visible) { firstDemo = false; prepareDemo(); }
        queueFrame();
      }
      syncDiagnostics();
    }
    function setReducedMotion(value) {
      reduced = value;
      settle();
      setState(state);
      queueFrame();
    }
    function moveCamera(next, animate = true) {
      if (disposed) return;
      const destination = {
        yaw: clamp(next.yaw, ...BOUNDS.yaw),
        elevation: clamp(next.elevation, ...BOUNDS.elevation),
        zoom: clamp(next.zoom, ...BOUNDS.zoom)
      };
      cameraState = destination;
      if (animate) beginTransition(1, false);
      else settle();
      queueFrame();
      syncDiagnostics();
    }
    listen(cameraButtons, 'click', event => {
      const button = event.target.closest('[data-scene-camera]');
      if (!button || button.disabled) return;
      options.onPause();
      const next = { ...cameraState };
      if (button.dataset.sceneCamera === 'left') next.yaw -= 8;
      if (button.dataset.sceneCamera === 'right') next.yaw += 8;
      if (button.dataset.sceneCamera === 'in') next.zoom += 0.06;
      if (button.dataset.sceneCamera === 'out') next.zoom -= 0.06;
      moveCamera(button.dataset.sceneCamera === 'reset' ? HOME : next);
    });
    listen(perspectiveControls, 'click', event => {
      const button = event.target.closest('[data-scene-view]');
      if (!button || button.dataset.sceneView === focusMode) return;
      options.onPause();
      sampleTransition(performance.now());
      focusMode = button.dataset.sceneView;
      beginTransition(focusMode === 'focus' ? 1 : -1);
      if (focusMode === 'focus') prepareDemo();
      else finishDemo();
      placeLabels();
    });
    listen(replay, 'click', () => {
      if (replay.disabled) return;
      options.onPause();
      settle();
      prepareDemo();
    });
    listen(demoPhases, 'click', event => {
      const button = event.target.closest('[data-scene-demo-phase]');
      if (!button || button.disabled) return;
      options.onPause();
      settle();
      demoPhase = Number(button.dataset.sceneDemoPhase);
      demoProgress = (demoPhase + 1) / 3;
      demoStatus = reduced ? 'static' : 'inspecting';
      renderDemoObjects();
      queueFrame();
    });
    const raycaster = new THREE.Raycaster();
    listen(canvas, 'pointerdown', event => {
      if (event.button !== 0 || event.pointerType === 'touch' || !active) return;
      options.onPause();
      sampleTransition(performance.now());
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: { ...cameraState }, moved: false };
      canvas.setPointerCapture(event.pointerId);
      canvas.dataset.dragging = 'true';
    });
    listen(canvas, 'pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 5) drag.moved = true;
      if (drag.moved) moveCamera({
        ...drag.camera, yaw: drag.camera.yaw - dx * 0.12,
        elevation: drag.camera.elevation + dy * 0.035
      }, false);
    });
    listen(canvas, 'pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const wasClick = !drag.moved;
      drag = null;
      canvas.dataset.dragging = 'false';
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (wasClick) {
        const bounds = canvas.getBoundingClientRect();
        raycaster.setFromCamera(new THREE.Vector2(
          (event.clientX - bounds.left) / bounds.width * 2 - 1,
          -(event.clientY - bounds.top) / bounds.height * 2 + 1
        ), camera);
        const hits = raycaster.intersectObjects([...stages.values()].map(stage => stage.group), true);
        if (hits.length) {
          let object = hits[0].object;
          while (object && !object.userData.nodeId) object = object.parent;
          if (object) onSelect(object.userData.nodeId);
        }
      }
    });
    const cancelDrag = () => { drag = null; canvas.dataset.dragging = 'false'; };
    listen(canvas, 'pointercancel', cancelDrag);
    listen(canvas, 'lostpointercapture', cancelDrag);
    listen(canvas, 'webglcontextlost', event => {
      event.preventDefault();
      onError(new Error('IDE scene context lost'));
    });
    function visibilityChanged() {
      if (document.hidden) { cancelFrame(); settle(); }
      else { resize(); queueFrame(); }
      syncDiagnostics();
    }
    listen(document, 'visibilitychange', visibilityChanged);
    listen(window, 'pagehide', () => { cancelFrame(); settle(); });
    listen(window, 'pageshow', () => { resize(); queueFrame(); });
    listen(window, 'resize', resize, { passive: true });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(resize);
      observer.observe(frame);
      cleanup.push(() => observer.disconnect());
    }
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(() => syncVisibility(), { threshold: 0 });
      observer.observe(frame);
      cleanup.push(() => observer.disconnect());
    }
    listen(window, 'scroll', () => syncVisibility(), { passive: true });
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!disposed) { placeLabels(); queueFrame(); } });
    setState(options.initialState);
    applyCamera();
    renderer.shadowMap.needsUpdate = true;
    renderer.render(world, camera);
    if (renderer.getContext().isContextLost()) throw new Error('IDE scene context unavailable');
    renderCount += 1;
    syncDiagnostics();
    return {
      setState, setActive, setReducedMotion, dispose,
      focusNode(id) {
        const stage = stages.get(id);
        if (!stage) return;
        const control = stage.picker.button;
        control.focus({ preventScroll: true });
        control.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      }
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
