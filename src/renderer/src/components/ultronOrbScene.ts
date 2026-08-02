import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

export interface OrbSceneApi {
  /** Rotate the camera around the orb by the given angles (radians). */
  rotateBy(deltaTheta: number, deltaPhi: number): void;
  /** Multiply the camera distance by `factor` (<1 zooms in, >1 zooms out). */
  zoomBy(factor: number): void;
  zoomIn(): void;
  zoomOut(): void;
  moveBy(deltaX: number, deltaY: number): void;
  gestureZoomBurst(): void;
  restoreGestureView(): void;
  shatter(): void;
  reassemble(): void;
  resetView(): void;
  pulseResponse(): void;
  dispose(): void;
}

const HOME_POSITION = new THREE.Vector3(0, 0.35, 6.35);
const MIN_DISTANCE = 0.6;
const MAX_DISTANCE = 40;

export function createOrbScene(container: HTMLElement): OrbSceneApi {
  const width = container.clientWidth;
  const height = container.clientHeight;

  // ——— SCENE ———
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 500);
  camera.position.copy(HOME_POSITION);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.46;
  renderer.setClearColor(0x000000, 0);
  renderer.setClearAlpha(0);
  renderer.domElement.style.background = "transparent";
  container.appendChild(renderer.domElement);

  // ——— POST PROCESSING ———
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.42, // strength
    0.4, // radius
    0.2, // threshold
  );
  composer.addPass(bloom);

  // Chromatic aberration + color grade shader
  const chromaticShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uIntensity: { value: 0.003 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        vec2 dir = vUv - vec2(0.5);
        float d = length(dir);
        float offset = uIntensity * d;
        // Slight flicker
        float flicker = 1.0 + 0.02 * sin(uTime * 30.0) * sin(uTime * 7.3);
        vec4 cr = texture2D(tDiffuse, vUv + dir * offset);
        vec4 cg = texture2D(tDiffuse, vUv);
        vec4 cb = texture2D(tDiffuse, vUv - dir * offset * 0.5);
        gl_FragColor = vec4(cr.r, cg.g * 1.05, cb.b * 0.6, 1.0) * flicker;
        // Grade into the dashboard's cyan/teal holographic palette.
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.45, 1.18, 1.25), 0.28);
      }
    `,
  };
  const chromaticPass = new ShaderPass(chromaticShader);
  composer.addPass(chromaticPass);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.04;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.zoomSpeed = 1.4;
  controls.enablePan = false;
  controls.enableRotate = false;

  // ——— COLORS ———
  const C_BRIGHT = 0x18e4e8;
  const C_MID = 0x0aa8bd;
  const C_DIM = 0x07566b;
  const C_FAINT = 0x062a3b;
  const C_HOT = 0xa8ffff;

  // ——— ORB ROOT ———
  // Every part of the orb (shells, core, orbiting debris, text, dust, rings)
  // lives under this group.
  const orbGroup = new THREE.Group();
  // Slightly flattened depth and height: an engineered holographic volume rather than a perfect globe.
  orbGroup.scale.set(1, 1, 1);
  scene.add(orbGroup);

  // ——— MATERIAL HELPERS ———
  function lineMat(color: number, opacity = 1) {
    return new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: opacity * 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  // ——— UTILITY: Create ring at latitude ———
  function latRing(radius: number, lat: number, segs = 120) {
    const r = radius * Math.cos(lat);
    const y = radius * Math.sin(lat);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  // ——— UTILITY: Create meridian ———
  function meridian(radius: number, lon: number, segs = 120) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const lat = (i / segs) * Math.PI - Math.PI / 2;
      pts.push(
        new THREE.Vector3(
          radius * Math.cos(lat) * Math.cos(lon),
          radius * Math.sin(lat),
          radius * Math.cos(lat) * Math.sin(lon),
        ),
      );
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  // ═══════════════════════════════════════════════
  // LAYER 1: OUTER SHELL — dense wireframe grid
  // ═══════════════════════════════════════════════
  const outerShell = new THREE.Group();
  const R1 = 2.0;

  // Dense latitude rings (30+)
  for (let i = -15; i < -15; i++) {
    const lat = (i / 15) * (Math.PI / 2) * 0.95;
    const opacity = i % 3 === 0 ? 0.5 : 0.12;
    const color = i % 3 === 0 ? C_MID : C_FAINT;
    outerShell.add(new THREE.Line(latRing(R1, lat), lineMat(color, opacity)));
  }

  // Dense meridians (24)
  for (let i = 0; i < 0; i++) {
    const lon = (i / 24) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    outerShell.add(
      new THREE.Line(
        meridian(R1, lon),
        lineMat(isMajor ? C_MID : C_FAINT, isMajor ? 0.6 : 0.1),
      ),
    );
  }

  // 4 bright cross meridians (the "plus" shape) — wide bands
  const CROSS_LINES = 18;
  const CROSS_SPREAD = 0.25; // radians total width
  for (let i = 0; i < 0; i++) {
    const lon = (i / 4) * Math.PI * 2;
    for (let j = 0; j < CROSS_LINES; j++) {
      const t = (j / (CROSS_LINES - 1)) * 2 - 1; // -1 to 1
      const offset = (t * CROSS_SPREAD) / 2;
      const falloff = 1 - Math.abs(t) * 0.7; // brighter at center, dimmer at edges
      const opacity = 0.85 * falloff;
      const color = Math.abs(t) < 0.3 ? C_BRIGHT : C_MID;
      outerShell.add(
        new THREE.Line(meridian(R1, lon + offset, 200), lineMat(color, opacity)),
      );
    }
  }

  // Bright equator band — wide
  const EQ_LINES = 20;
  const EQ_SPREAD = 0.35;
  for (let j = 0; j < 0; j++) {
    const t = (j / (EQ_LINES - 1)) * 2 - 1;
    const offset = (t * EQ_SPREAD) / 2;
    const falloff = 1 - Math.abs(t) * 0.65;
    const opacity = 0.8 * falloff;
    const color = Math.abs(t) < 0.3 ? C_BRIGHT : C_MID;
    outerShell.add(
      new THREE.Line(latRing(R1, offset, 200), lineMat(color, opacity)),
    );
  }

  orbGroup.add(outerShell);

  // ═══════════════════════════════════════════════
  // LAYER 2: GRID PANELS on the sphere surface
  // ═══════════════════════════════════════════════
  const panelGroup = new THREE.Group();

  function createSpherePanel(
    latCenter: number,
    lonCenter: number,
    latSpan: number,
    lonSpan: number,
    radius: number,
    divisions = 4,
  ) {
    const group = new THREE.Group();
    const mat = lineMat(C_DIM, 0.25);

    // horizontal lines
    for (let i = 0; i <= divisions; i++) {
      const lat = latCenter - latSpan / 2 + (i / divisions) * latSpan;
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= divisions * 4; j++) {
        const lon = lonCenter - lonSpan / 2 + (j / (divisions * 4)) * lonSpan;
        pts.push(
          new THREE.Vector3(
            radius * Math.cos(lat) * Math.cos(lon),
            radius * Math.sin(lat),
            radius * Math.cos(lat) * Math.sin(lon),
          ),
        );
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }

    // vertical lines
    for (let j = 0; j <= divisions; j++) {
      const lon = lonCenter - lonSpan / 2 + (j / divisions) * lonSpan;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= divisions * 4; i++) {
        const lat = latCenter - latSpan / 2 + (i / (divisions * 4)) * latSpan;
        pts.push(
          new THREE.Vector3(
            radius * Math.cos(lat) * Math.cos(lon),
            radius * Math.sin(lat),
            radius * Math.cos(lat) * Math.sin(lon),
          ),
        );
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }

    return group;
  }

  // Scatter panels across the sphere
  for (let i = 0; i < 30; i++) {
    const lat = (Math.random() - 0.5) * Math.PI * 0.8;
    const lon = Math.random() * Math.PI * 2;
    const size = 0.15 + Math.random() * 0.25;
    const panel = createSpherePanel(
      lat,
      lon,
      size,
      size,
      R1 + 0.01,
      3 + Math.floor(Math.random() * 3),
    );
    panelGroup.add(panel);
  }
  orbGroup.add(panelGroup);

  // LAYER 2B: fragmented mechanical circuit shell — inspired by the supplied reference.
  // These are real 3D pieces, not a background image: they drift and counter-rotate
  // around the spherical lattice like a holographic machine assembling itself.
  const fragmentShell = new THREE.Group();
  for (let i = 0; i < 520; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const radius = R1 + 0.02 + Math.random() * 0.22;
    const normal = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
    const tangent = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta)).normalize();
    const bit = new THREE.Group();
    const width = 0.035 + Math.random() * 0.38;
    const height = 0.012 + Math.random() * 0.075;
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, 0.012));
    const frame = new THREE.LineSegments(edges, lineMat(Math.random() > 0.45 ? C_BRIGHT : C_MID, 0.2 + Math.random() * 0.6));
    bit.add(frame);
    // A small radial circuit trace attached to many fragments.
    if (Math.random() > 0.35) {
      const route = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width * 0.5, 0, 0),
        new THREE.Vector3(-width * 0.5 - (0.04 + Math.random() * 0.13), height * (Math.random() > 0.5 ? 2 : -2), 0),
      ]);
      bit.add(new THREE.Line(route, lineMat(C_HOT, 0.3 + Math.random() * 0.35)));
    }
    bit.position.copy(normal.multiplyScalar(radius));
    bit.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    bit.rotateZ(Math.random() * Math.PI * 2);
    bit.userData = { drift: (Math.random() - 0.5) * 0.0025, tangent };
    bit.userData.homePosition = bit.position.clone();
    bit.userData.shatterDirection = bit.position.clone().normalize().add(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5)).normalize();
    fragmentShell.add(bit);
  }
  orbGroup.add(fragmentShell);

  // Dense internal machinery: translucent circuit boards, radial conduits and
  // broken turbine arcs give the orb the packed, engineered silhouette of the reference.
  const machinery = new THREE.Group();
  // A small signature only appears on selected large circuit panels.  Keeping it
  // sparse makes it feel like part of the holographic construction, not a texture.
  function createSwBadge(offset: number) {
    const group = new THREE.Group();
    for (const [index, letter] of ["S", "W"].entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 84;
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.font = "700 52px monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#b8ffff";
      context.shadowColor = "#18e4e8";
      context.shadowBlur = 14;
      context.fillText(letter, canvas.width / 2, canvas.height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      const x = index === 0 ? -0.09 : 0.09;
      badge.scale.set(0.22, 0.2, 1);
      badge.position.set(x, 0, 0.032);
      badge.userData = { swOffset: offset + index * 0.37, swPart: index === 0 ? -1 : 1, swHomeX: x };
      group.add(badge);
    }
    return group;
  }
  for (let i = 0; i < 64; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const radius = 0.45 + Math.random() * 1.45;
    const normal = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
    const panel = new THREE.Group();
    const width = 0.12 + Math.random() * 0.35;
    const height = 0.08 + Math.random() * 0.32;
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, 0.018)),
      lineMat(i % 3 === 0 ? C_HOT : C_MID, 0.28 + Math.random() * 0.46),
    );
    panel.add(frame);
    // Three internal traces make every panel look like a holographic circuit board.
    for (let trace = 0; trace < 3; trace++) {
      const y = height * (trace / 3 - 0.33);
      const traceGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width * 0.42, y, 0.012),
        new THREE.Vector3(width * (Math.random() * 0.25 - 0.06), y, 0.012),
        new THREE.Vector3(width * 0.42, y + (Math.random() - 0.5) * height * 0.18, 0.012),
      ]);
      panel.add(new THREE.Line(traceGeo, lineMat(C_BRIGHT, 0.24 + Math.random() * 0.35)));
    }
    // Small, static SW marks live inside only a few circuit boxes. They are
    // intentionally subtle and separate from the large shatter-only signature.
    if (i % 8 === 0 && width * height > 0.045) {
      const badge = createSwBadge(i);
      panel.add(badge);
    }
    panel.position.copy(normal.multiplyScalar(radius));
    panel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    panel.rotateZ(Math.random() * Math.PI * 2);
    panel.userData = {
      speed: (Math.random() - 0.5) * 0.004,
      homePosition: panel.position.clone(),
      shatterDirection: panel.position.clone().normalize().add(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5)).normalize(),
    };
    machinery.add(panel);
  }

  const conduits = new THREE.Group();
  for (let i = 0; i < 90; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const direction = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
    const start = direction.clone().multiplyScalar(0.18 + Math.random() * 0.55);
    const middle = direction.clone().multiplyScalar(0.8 + Math.random() * 0.55);
    const end = direction.clone().multiplyScalar(1.45 + Math.random() * 0.58);
    middle.add(new THREE.Vector3((Math.random() - 0.5) * 0.32, (Math.random() - 0.5) * 0.32, (Math.random() - 0.5) * 0.32));
    conduits.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([start, middle, end]),
      lineMat(i % 4 === 0 ? C_HOT : C_BRIGHT, 0.14 + Math.random() * 0.38),
    ));
  }

  const turbineArcs = new THREE.Group();
  for (let i = 0; i < 0; i++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.35 + (i % 5) * 0.17, 0.008 + Math.random() * 0.012, 5, 40, 0.5 + Math.random() * 1.9),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? C_HOT : C_BRIGHT, transparent: true, opacity: 0.22 + Math.random() * 0.38, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    arc.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    turbineArcs.add(arc);
  }
  machinery.add(conduits, turbineArcs);
  orbGroup.add(machinery);

  // A large emergency signature flashes into view during a shatter so the
  // break is unmistakable even when the dashboard is viewed from a distance.
  const shatterSignature = new THREE.Group();
  for (const [index, letter] of ["S", "W"].entries()) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 280;
    const context = canvas.getContext("2d");
    if (!context) continue;
    context.font = "700 190px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#d2ffff";
    context.shadowColor = "#18e4e8";
    context.shadowBlur = 30;
    context.fillText(letter, 128, 140);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const baseX = index === 0 ? -0.52 : 0.52;
    sprite.position.set(baseX, 0, 0.28);
    sprite.scale.set(1.06, 1.16, 1);
    sprite.userData = { baseX, part: index === 0 ? -1 : 1 };
    shatterSignature.add(sprite);
  }
  orbGroup.add(shatterSignature);

  // A second visual language besides the circuit boxes: drifting triangular
  // crystal shards add depth as the user zooms into the hologram.
  const prismShardField = new THREE.Group();
  for (let i = 0; i < 74; i++) {
    const direction = new THREE.Vector3().randomDirection();
    const shard = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(0.035 + Math.random() * 0.09, 0)),
      lineMat(i % 4 === 0 ? C_HOT : C_MID, 0.22 + Math.random() * 0.32),
    );
    shard.position.copy(direction.multiplyScalar(0.5 + Math.random() * 1.65));
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shard.userData = {
      spin: (Math.random() - 0.5) * 0.018,
      tilt: (Math.random() - 0.5) * 0.014,
      baseOpacity: (shard.material as THREE.LineBasicMaterial).opacity,
    };
    prismShardField.add(shard);
  }
  orbGroup.add(prismShardField);

  // ═══════════════════════════════════════════════
  // LAYER 3: SECONDARY SHELL — offset, partial arcs
  // ═══════════════════════════════════════════════
  const shell2 = new THREE.Group();
  const R2 = 2.12;

  // Partial arcs at random latitudes
  for (let i = 0; i < 0; i++) {
    const lat = (Math.random() - 0.5) * Math.PI * 0.85;
    const startLon = Math.random() * Math.PI * 2;
    const arcLen = 0.3 + Math.random() * 1.2;
    const pts: THREE.Vector3[] = [];
    const segs = 60;
    const r = R2 * Math.cos(lat);
    const y = R2 * Math.sin(lat);
    for (let j = 0; j <= segs; j++) {
      const a = startLon + (j / segs) * arcLen;
      pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
    }
    shell2.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        lineMat(C_MID, 0.2 + Math.random() * 0.3),
      ),
    );
  }

  // Partial meridian arcs
  for (let i = 0; i < 0; i++) {
    const lon = Math.random() * Math.PI * 2;
    const startLat = (Math.random() - 0.5) * Math.PI * 0.8;
    const arcLen = 0.3 + Math.random() * 0.8;
    const pts: THREE.Vector3[] = [];
    const segs = 40;
    for (let j = 0; j <= segs; j++) {
      const lat = startLat + (j / segs) * arcLen;
      pts.push(
        new THREE.Vector3(
          R2 * Math.cos(lat) * Math.cos(lon),
          R2 * Math.sin(lat),
          R2 * Math.cos(lat) * Math.sin(lon),
        ),
      );
    }
    shell2.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        lineMat(C_DIM, 0.15 + Math.random() * 0.2),
      ),
    );
  }
  orbGroup.add(shell2);

  // ═══════════════════════════════════════════════
  // LAYER 4: INNER CORE — spiral geodesic
  // ═══════════════════════════════════════════════
  const innerCore = new THREE.Group();
  const R3 = 0.9;

  // Dense spirals
  for (let s = 0; s < 8; s++) {
    const pts: THREE.Vector3[] = [];
    const turns = 3 + Math.random() * 2;
    const segs = 300;
    const phase = (s / 8) * Math.PI * 2;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const lat = t * Math.PI - Math.PI / 2;
      const lon = t * turns * Math.PI * 2 + phase;
      pts.push(
        new THREE.Vector3(
          R3 * Math.cos(lat) * Math.cos(lon),
          R3 * Math.sin(lat),
          R3 * Math.cos(lat) * Math.sin(lon),
        ),
      );
    }
    innerCore.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        lineMat(C_BRIGHT, 0.3 + Math.random() * 0.2),
      ),
    );
  }

  // Inner latitude rings
  for (let i = -6; i <= 6; i++) {
    const lat = (i / 6) * (Math.PI / 2) * 0.9;
    innerCore.add(new THREE.Line(latRing(R3, lat, 80), lineMat(C_DIM, 0.2)));
  }

  // Inner meridians
  for (let i = 0; i < 12; i++) {
    const lon = (i / 12) * Math.PI * 2;
    innerCore.add(new THREE.Line(meridian(R3, lon, 80), lineMat(C_DIM, 0.15)));
  }

  orbGroup.add(innerCore);

  // ═══════════════════════════════════════════════
  // LAYER 5: INNERMOST CORE — bright hot center
  // ═══════════════════════════════════════════════
  const coreR = 0.25;

  // Icosahedron wireframe core
  const icoGeo = new THREE.IcosahedronGeometry(coreR, 1);
  const icoEdges = new THREE.EdgesGeometry(icoGeo);
  const icoWireMat = lineMat(C_HOT, 0.9);
  const icoWire = new THREE.LineSegments(icoEdges, icoWireMat);
  orbGroup.add(icoWire);

  // Glowing center sphere — subtle, see-through
  const coreSphereMat = new THREE.MeshBasicMaterial({
    color: C_HOT,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
  });
  const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), coreSphereMat);
  orbGroup.add(coreSphere);

  // Larger faint glow — very subtle
  const glowSphereMat = new THREE.MeshBasicMaterial({
    color: C_MID,
    transparent: true,
    opacity: 0.018,
    blending: THREE.AdditiveBlending,
  });
  const glowSphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), glowSphereMat);
  orbGroup.add(glowSphere);

  // ═══════════════════════════════════════════════
  // CODE TEXT — tiny, dense, scattered
  // ═══════════════════════════════════════════════
  const codeSnippets = [
    "sys.init()", "0xFF3A", "malloc()", ">> SCAN", "void*", "ACK",
    "SYNC OK", "ptr_ref", "exec()", "hash256", "::bind", "core.0",
    "01101001", "10110100", ">>> RDY", "HEAP 4K", "TCP/SYN",
    "mutex.lk", "IRQ 0x7", "DMA xfer", "REG EAX", "FAULT 0",
    "kernel.d", "pipe |>", "chmod +x", "fork()", "SIGTERM",
    "eth0: UP", "AES-256", "RSA 4096", "TLS 1.3", "HTTP/2",
    "latency", "200 OK", "PATCH /", "fn main", "use std",
    "impl Orb", "async {}", "spawn()", "arc::new", ".unwrap",
  ];

  interface SpriteDrift {
    phi: number;
    theta: number;
    r: number;
    speed: number;
  }

  function makeTextSprite(text: string, size = 0.08) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 32;
    const ctx = c.getContext("2d")!;
    ctx.font = "bold 14px Courier New";
    const alpha = 0.35 + Math.random() * 0.55;
    ctx.fillStyle = `rgba(38, ${(190 + Math.random() * 45) | 0}, ${(205 + Math.random() * 40) | 0}, ${alpha})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 16);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    s.scale.set(size * 5, size * 0.7, 1);
    return s;
  }

  function scatterText(count: number, sizeFn: () => number, rFn: () => number, speedScale: [number, number]) {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const sp = makeTextSprite(
        codeSnippets[Math.floor(Math.random() * codeSnippets.length)],
        sizeFn(),
      );
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = rFn();
      sp.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      );
      sp.userData = {
        phi,
        theta,
        r,
        speed:
          (speedScale[0] + Math.random() * speedScale[1]) *
          (Math.random() > 0.5 ? 1 : -1),
      } satisfies SpriteDrift;
      group.add(sp);
    }
    return group;
  }

  // On outer sphere — dense text coverage
  const textOuter = scatterText(
    0,
    () => 0.04 + Math.random() * 0.04,
    () => R1 + 0.03 + Math.random() * 0.08,
    [0.0002, 0.0008],
  );
  orbGroup.add(textOuter);

  // On inner core — more text
  const textInner = scatterText(
    0,
    () => 0.03 + Math.random() * 0.03,
    () => R3 + 0.02,
    [0.0005, 0.001],
  );
  orbGroup.add(textInner);

  // Floating ambient text between shells
  const textAmbient = scatterText(
    0,
    () => 0.03,
    () => R3 + 0.2 + Math.random() * (R1 - R3 - 0.3),
    [0.0003, 0.0006],
  );
  orbGroup.add(textAmbient);

  // ═══════════════════════════════════════════════
  // ORBITING DEBRIS / ROCKS
  // ═══════════════════════════════════════════════
  // Shared geometries for performance — reuse across 250 satellites
  const debrisGeos = [
    new THREE.IcosahedronGeometry(0.012, 0),
    new THREE.IcosahedronGeometry(0.02, 0),
    new THREE.IcosahedronGeometry(0.03, 1),
    new THREE.IcosahedronGeometry(0.008, 0),
    new THREE.TetrahedronGeometry(0.015, 0),
    new THREE.OctahedronGeometry(0.018, 0),
  ];
  interface DebrisOrbit {
    orbitR: number;
    speed: number;
    tiltX: number;
    tiltZ: number;
    phase: number;
  }
  const debris: THREE.Mesh[] = [];
  for (let i = 0; i < 180; i++) {
    const geo = debrisGeos[Math.floor(Math.random() * debrisGeos.length)];
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.7 ? C_BRIGHT : C_MID,
      transparent: true,
      opacity: 0.3 + Math.random() * 0.6,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const orbitR = 1.65 + Math.random() * 0.75;
    const speed = (0.08 + Math.random() * 0.6) * (Math.random() > 0.5 ? 1 : -1);
    const tiltX = (Math.random() - 0.5) * Math.PI * 0.9;
    const tiltZ = (Math.random() - 0.5) * Math.PI * 0.5;
    const phase = Math.random() * Math.PI * 2;
    mesh.userData = { orbitR, speed, tiltX, tiltZ, phase } satisfies DebrisOrbit;
    debris.push(mesh);
    orbGroup.add(mesh);

    // ~15% get a faint trailing line
    if (Math.random() > 0.85) {
      const trailPts: THREE.Vector3[] = [];
      for (let j = 0; j <= 15; j++) {
        const a = -(j / 15) * 0.3;
        trailPts.push(
          new THREE.Vector3(
            orbitR * Math.cos(a + phase),
            orbitR * 0.08 * Math.sin(a * 3),
            orbitR * Math.sin(a + phase),
          ),
        );
      }
      const trail = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(trailPts),
        lineMat(C_FAINT, 0.08),
      );
      mesh.add(trail);
    }
  }

  // ═══════════════════════════════════════════════
  // DUST PARTICLES — lots of them
  // ═══════════════════════════════════════════════
  const dustCount = 700;
  const dustPos = new Float32Array(dustCount * 3);

  for (let i = 0; i < dustCount; i++) {
    // Concentrate near the sphere, sparse further out
    const rr = 1.15 + Math.pow(Math.random(), 0.7) * 1.25;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    dustPos[i * 3] = rr * Math.sin(phi) * Math.cos(theta);
    dustPos[i * 3 + 1] = rr * Math.cos(phi);
    dustPos[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta);
  }

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.Float32BufferAttribute(dustPos, 3));

  // Soft dot texture
  const dotC = document.createElement("canvas");
  dotC.width = dotC.height = 64;
  const dCtx = dotC.getContext("2d")!;
  const g = dCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(168,255,255,0.95)");
  g.addColorStop(0.2, "rgba(24,228,232,0.48)");
  g.addColorStop(0.5, "rgba(8,126,150,0.12)");
  g.addColorStop(1, "rgba(2,35,48,0)");
  dCtx.fillStyle = g;
  dCtx.fillRect(0, 0, 64, 64);

  const dustMat = new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(dotC),
    size: 0.04,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    color: C_BRIGHT,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  orbGroup.add(dustPoints);

  // ═══════════════════════════════════════════════
  // SCANNING RINGS
  // ═══════════════════════════════════════════════
  function makeScanRing(radius: number, thickness = 0.015) {
    const geo = new THREE.RingGeometry(radius - thickness, radius + thickness, 120);
    const mat = new THREE.MeshBasicMaterial({
      color: C_BRIGHT,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  const scanRing1 = makeScanRing(R1, 0.01);
  const scanRing2 = makeScanRing(R1 * 0.7, 0.008);
  // Scan rings intentionally stay detached: the interface uses fragmented machinery, not circular hotspots.

  // ═══════════════════════════════════════════════
  // HEXAGONAL NODES — small tech details
  // ═══════════════════════════════════════════════
  for (let i = 0; i < 15; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = R1 + 0.02;
    const hexGeo = new THREE.CircleGeometry(0.03 + Math.random() * 0.02, 6);
    const hexEdges = new THREE.EdgesGeometry(hexGeo);
    const hex = new THREE.LineSegments(hexEdges, lineMat(C_MID, 0.5));
    hex.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
    hex.lookAt(0, 0, 0);
    outerShell.add(hex);
  }

  // ═══════════════════════════════════════════════
  // GESTURE / PROGRAMMATIC CAMERA CONTROL
  // ═══════════════════════════════════════════════
  const sphericalScratch = new THREE.Spherical();
  const offsetScratch = new THREE.Vector3();

  function rotateBy(deltaTheta: number, deltaPhi: number) {
    offsetScratch.copy(camera.position).sub(controls.target);
    sphericalScratch.setFromVector3(offsetScratch);
    sphericalScratch.theta -= deltaTheta;
    sphericalScratch.phi = THREE.MathUtils.clamp(
      sphericalScratch.phi - deltaPhi,
      0.05,
      Math.PI - 0.05,
    );
    sphericalScratch.makeSafe();
    offsetScratch.setFromSpherical(sphericalScratch);
    camera.position.copy(controls.target).add(offsetScratch);
    camera.lookAt(controls.target);
  }

  function zoomBy(factor: number) {
    offsetScratch.copy(camera.position).sub(controls.target);
    const dist = THREE.MathUtils.clamp(
      offsetScratch.length() * factor,
      MIN_DISTANCE,
      MAX_DISTANCE,
    );
    offsetScratch.setLength(dist);
    camera.position.copy(controls.target).add(offsetScratch);
    window.dispatchEvent(new CustomEvent('shadow-orb-zoom', { detail: dist }));
  }

  function moveBy(deltaX: number, deltaY: number) {
    orbGroup.position.x = THREE.MathUtils.clamp(orbGroup.position.x + deltaX, -3.1, 3.1);
    orbGroup.position.y = THREE.MathUtils.clamp(orbGroup.position.y + deltaY, -2.35, 2.35);
    window.dispatchEvent(new CustomEvent('shadow-orb-move', {
      detail: { x: orbGroup.position.x, y: orbGroup.position.y },
    }));
  }

  let gestureViewBefore: { camera: THREE.Vector3; target: THREE.Vector3; orb: THREE.Vector3 } | null = null;
  let gestureCameraTarget: THREE.Vector3 | null = null;
  let gestureOrbTarget: THREE.Vector3 | null = null;
  let shatterAmount = 0;
  let shatterTarget = 0;
  let shatterFlash = 0;

  function gestureZoomBurst() {
    if (!gestureViewBefore) {
      gestureViewBefore = {
        camera: camera.position.clone(),
        target: controls.target.clone(),
        orb: orbGroup.position.clone(),
      };
    }
    const direction = camera.position.clone().sub(controls.target).normalize();
    const distance = camera.position.distanceTo(controls.target);
    gestureCameraTarget = controls.target.clone().add(direction.multiplyScalar(Math.max(MIN_DISTANCE, distance * 0.42)));
  }

  function restoreGestureView() {
    if (!gestureViewBefore) return;
    gestureCameraTarget = gestureViewBefore.camera.clone();
    gestureOrbTarget = gestureViewBefore.orb.clone();
    controls.target.copy(gestureViewBefore.target);
    gestureViewBefore = null;
  }

  function shatter() {
    shatterTarget = 1;
    shatterFlash = 1;
    window.dispatchEvent(new Event('shadow-orb-shatter'));
  }

  function reassemble() {
    shatterTarget = 0;
  }

  function resetView() {
    camera.position.copy(HOME_POSITION);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    controls.update();
  }

  // ═══════════════════════════════════════════════
  // ANIMATION
  // ═══════════════════════════════════════════════
  const clock = new THREE.Clock();
  let flickerTimer = 0;
  let rafId = 0;
  let disposed = false;
  let responsePulse = 0;
  let isSpeaking = false;
  let speakingSilenceTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatStartedAt = 0;
  let debugFlash = 0;

  function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    debugFlash = Math.max(0, debugFlash - 0.055);
    orbGroup.scale.setScalar(1 + debugFlash);
    if (debugFlash > 0) bloom.strength = 5;
    shatterAmount += (shatterTarget - shatterAmount) * 0.2;
    shatterFlash = Math.max(0, shatterFlash - 0.035);
    const shatterWave = shatterAmount * 4.8;
    const shatterFlashAmount = Math.sin(shatterFlash * Math.PI);
    if (gestureCameraTarget) {
      camera.position.lerp(gestureCameraTarget, 0.13);
      if (camera.position.distanceToSquared(gestureCameraTarget) < 0.0001) {
        camera.position.copy(gestureCameraTarget);
        gestureCameraTarget = null;
      }
      camera.lookAt(controls.target);
      window.dispatchEvent(new CustomEvent('shadow-orb-zoom', { detail: camera.position.distanceTo(controls.target) }));
    }
    if (gestureOrbTarget) {
      orbGroup.position.lerp(gestureOrbTarget, 0.13);
      if (orbGroup.position.distanceToSquared(gestureOrbTarget) < 0.0001) {
        orbGroup.position.copy(gestureOrbTarget);
        gestureOrbTarget = null;
      }
      window.dispatchEvent(new CustomEvent('shadow-orb-move', { detail: { x: orbGroup.position.x, y: orbGroup.position.y } }));
    }
    // Audio chunks only keep this state alive. The visual rhythm comes from a
    // fixed cardiac waveform: a sharp lub followed 150ms later by a smaller dub.
    if (isSpeaking) {
      responsePulse += (1 - responsePulse) * 0.18;
    } else {
      responsePulse = 0;
    }
    const heartbeatPeriod = 0.8;
    const heartbeatCycle = ((t - heartbeatStartedAt) % heartbeatPeriod) / heartbeatPeriod;
    const heartbeatPeak = (center: number, width: number) =>
      Math.exp(-Math.pow((heartbeatCycle - center) / width, 2));
    const lub = heartbeatPeak(0.075, 0.032);
    const dub = heartbeatPeak(0.2625, 0.045) * 0.58;
    const responseBeat = responsePulse * Math.min(1, lub + dub);

    // Outer shell rotation
    outerShell.rotation.y += 0.0015;
    outerShell.rotation.x = Math.sin(t * 0.08) * 0.05;

    // Panel group follows shell but with slight offset
    panelGroup.rotation.y += 0.0018;
    panelGroup.rotation.x = Math.sin(t * 0.08 + 0.5) * 0.04;

    fragmentShell.rotation.y -= 0.0023;
    fragmentShell.rotation.x = Math.sin(t * 0.16) * 0.12;
    fragmentShell.children.forEach((piece) => {
      const drift = piece.userData.drift as number;
      piece.rotation.z += drift;
      if (piece.userData.homePosition && piece.userData.shatterDirection) {
        piece.position.copy(piece.userData.homePosition).addScaledVector(piece.userData.shatterDirection, shatterWave);
        piece.scale.setScalar(1 + shatterAmount * 0.6);
      }
    });

    machinery.rotation.y += 0.0032;
    machinery.rotation.z = Math.sin(t * 0.45) * 0.14;
    machinery.children.forEach((piece) => {
      if (typeof piece.userData.speed === 'number') piece.rotation.z += piece.userData.speed;
      if (piece.userData.homePosition && piece.userData.shatterDirection) {
        piece.position.copy(piece.userData.homePosition).addScaledVector(piece.userData.shatterDirection, shatterWave * 1.2);
        piece.scale.setScalar(1 + shatterAmount * 0.75);
      }
      piece.children.forEach((child) => {
        if (!(child instanceof THREE.Sprite) || typeof child.userData.swOffset !== 'number') return;
        const phase = t * 1.65 + child.userData.swOffset;
        child.position.z = 0.032 + Math.sin(phase) * 0.018;
        child.position.x = child.userData.swHomeX + child.userData.swPart * shatterWave * 0.42;
        (child.material as THREE.SpriteMaterial).opacity = 0.38 + (Math.sin(phase * 1.3) + 1) * 0.16;
      });
    });
    conduits.rotation.y -= 0.0045;
    turbineArcs.rotation.z += 0.008;
    shatterSignature.children.forEach((child) => {
      if (!(child instanceof THREE.Sprite)) return;
      const material = child.material as THREE.SpriteMaterial;
      material.opacity = shatterFlashAmount * 0.96;
      child.position.x = child.userData.baseX + child.userData.part * shatterFlashAmount * 2.25;
      child.position.y = Math.sin(t * 12 + child.userData.part) * shatterFlashAmount * 0.28;
      child.scale.set(1.06 + shatterFlashAmount * 0.5, 1.16 + shatterFlashAmount * 0.5, 1);
    });
    prismShardField.rotation.y -= 0.0018;
    prismShardField.scale.setScalar(1 + responseBeat * 0.3);
    prismShardField.children.forEach((shard) => {
      shard.rotation.x += shard.userData.spin;
      shard.rotation.y += shard.userData.tilt;
      const material = (shard as THREE.LineSegments).material as THREE.LineBasicMaterial;
      material.opacity = Math.min(1, shard.userData.baseOpacity + responseBeat * 0.55);
    });

    // Secondary shell counter-rotates slowly
    shell2.rotation.y -= 0.001;
    shell2.rotation.z = Math.sin(t * 0.12) * 0.03;
    shell2.scale.setScalar(1 + responseBeat * 0.22);
    outerShell.scale.setScalar(1 + responseBeat * 0.16);

    // Inner core — opposite, faster
    innerCore.rotation.y -= 0.005;
    innerCore.rotation.z += 0.002;
    innerCore.rotation.x = Math.cos(t * 0.1) * 0.08;
    innerCore.scale.setScalar(1 + responseBeat * 0.36);

    // Innermost wireframe
    icoWire.rotation.x += 0.008;
    icoWire.rotation.y += 0.012;

    // Core pulse — dramatic surges but mostly transparent
    const wave1 = Math.sin(t * 1.2);
    const wave3 = Math.pow(Math.max(0, Math.sin(t * 0.4)), 5); // rare big surge
    const wave4 = Math.pow(Math.max(0, Math.sin(t * 0.7 + 2)), 8); // mega surge
    const fadeOut = Math.pow(Math.max(0, Math.sin(t * 0.25)), 3); // periodic full transparency
    const surge = wave3 * 1.5 + wave4 * 2.0;
    const coreScale = 1 + surge + Math.sin(t * 5) * 0.05 + responseBeat * 0.95;
    coreSphere.scale.setScalar(coreScale);
    // Opacity: mostly very low (0-0.15), sometimes fully transparent, brief bright on surge
    const coreOpacity = Math.max(
      0,
      (0.08 + wave1 * 0.05 + surge * 0.2) * (1 - fadeOut * 0.95),
    );
    coreSphereMat.opacity = Math.min(0.7, coreOpacity * 0.5 + responseBeat * 0.34);
    glowSphere.scale.setScalar(1 + surge * 0.8 + responseBeat * 1.3);
    glowSphereMat.opacity = Math.max(0, (0.012 + surge * 0.035 + responseBeat * 0.24) * (1 - fadeOut * 0.9));
    // Icosahedron wireframe stays visible even when glow fades
    icoWire.scale.setScalar(1 + surge * 0.6 + responseBeat * 0.54);
    icoWireMat.opacity = Math.min(1, 0.5 + surge * 0.4 + responseBeat * 0.38);

    // Debris orbits
    debris.forEach((d) => {
      const u = d.userData as DebrisOrbit;
      const a = t * u.speed + u.phase;
      const orbitKick = 1 + responseBeat * 0.24;
      d.position.set(
        (u.orbitR * Math.cos(a) * Math.cos(u.tiltX)) * orbitKick,
        (u.orbitR * Math.sin(u.tiltX) * Math.sin(a * 0.8) + Math.sin(a * 0.3 + u.tiltZ) * 0.2) * orbitKick,
        (u.orbitR * Math.sin(a) * Math.cos(u.tiltZ)) * orbitKick,
      );
      d.rotation.x += 0.015;
      d.rotation.z += 0.01;
    });

    // Text drift
    const driftGroups: [THREE.Group, number][] = [
      [textOuter, 1],
      [textInner, 2],
      [textAmbient, 1.2],
    ];
    for (const [group, mult] of driftGroups) {
      group.children.forEach((sp) => {
        const u = sp.userData as SpriteDrift;
        u.theta += u.speed * mult;
        sp.position.set(
          u.r * Math.sin(u.phi) * Math.cos(u.theta),
          u.r * Math.cos(u.phi),
          u.r * Math.sin(u.phi) * Math.sin(u.theta),
        );
      });
    }

    // Scan rings sweeping
    // Dust rotation
    dustPoints.rotation.y += 0.0002;

    // Random flicker on some panels
    flickerTimer += 0.016;
    if (flickerTimer > 0.1) {
      flickerTimer = 0;
      panelGroup.children.forEach((p) => {
        if (Math.random() > 0.95) {
          p.visible = !p.visible;
        }
      });
    }

    // Bloom pulse
    bloom.strength = 0.38 + Math.sin(t * 0.8) * 0.08 + shatterAmount * 0.42 + responseBeat * 1.35;
    bloom.radius = 0.4 + responseBeat * 0.38;

    // Update chromatic aberration time
    chromaticPass.uniforms.uTime.value = t;

    controls.update();
    composer.render();
  }

  animate();

  // ——— RESIZE ———
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  // ——— CLEANUP ———
  function dispose() {
    disposed = true;
    if (speakingSilenceTimer) clearTimeout(speakingSilenceTimer);
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    controls.dispose();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        const anyMat = mat as THREE.Material & { map?: THREE.Texture };
        anyMat.map?.dispose();
        mat.dispose();
      }
    });
    composer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return {
    rotateBy,
    zoomBy,
    zoomIn: () => zoomBy(0.65),
    zoomOut: () => zoomBy(1.55),
    moveBy,
    gestureZoomBurst,
    restoreGestureView,
    shatter,
    reassemble,
    resetView,
    pulseResponse: () => {
      console.log('[SHADOW] pulseResponse received')
      debugFlash = 1;
      if (!isSpeaking) heartbeatStartedAt = clock.getElapsedTime();
      isSpeaking = true;
      if (speakingSilenceTimer) clearTimeout(speakingSilenceTimer);
      speakingSilenceTimer = setTimeout(() => {
        isSpeaking = false;
        responsePulse = 0;
        speakingSilenceTimer = null;
      }, 350);
    },
    dispose,
  };
}
