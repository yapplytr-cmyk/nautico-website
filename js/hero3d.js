/* ═══════════════════════════════════════════════════════════════
   NAUTICO website — interactive 3D boat viewers (Three.js r128)
   • Glowing-glass material (cyan, fresnel, breathing pulse)
   • Cinematic entrance: camera flies front → engines → settles
   • Mouse hover: boat turns toward the cursor direction
   • Touch: boat follows the finger
   • Reusable: createBoat({ id, url }) — used for Midnight (hero) + others
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function ready() { return window.THREE && THREE.GLTFLoader; }

  function makeHolo() {
    var uniforms = { uTime: { value: 0 } };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms, transparent: true, depthWrite: true, depthTest: true, side: THREE.FrontSide,
      vertexShader: [
        'varying vec3 vN; varying vec3 vView;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vView = normalize(cameraPosition - wp.xyz);',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'varying vec3 vN; varying vec3 vView;',
        'void main(){',
        '  vec3 N = normalize(vN); vec3 V = normalize(vView);',
        '  float ndv  = clamp(dot(N, V), 0.0, 1.0);',
        '  float fres = pow(1.0 - ndv, 1.7);',
        '  vec3 L  = normalize(vec3(0.4, 0.85, 0.55));',
        '  vec3 H  = normalize(L + V);',
        '  float spec  = pow(max(dot(N, H),  0.0), 55.0) * 2.2;',
        '  float lambert = clamp(dot(N, L), 0.0, 1.0) * 0.6 + 0.4;',
        '  vec3 bodyDark = vec3(0.05, 0.40, 0.66);',
        '  vec3 bodyLit  = vec3(0.48, 0.95, 1.0);',
        '  vec3 body = mix(bodyDark, bodyLit, lambert);',
        '  vec3 edge = vec3(0.88, 1.0, 1.0);',
        '  float pulse = 0.5 + 0.5 * sin(uTime * 1.4);',
        '  vec3 col  = mix(body, edge, fres * 0.85);',
        '  col += edge * pow(fres, 2.3) * (0.85 + 0.7 * pulse);',
        '  col += vec3(0.10, 0.32, 0.45) * (0.55 + 0.45 * pulse);',
        '  col += vec3(1.0) * spec;',
        '  col *= 0.92 + 0.13 * pulse;',
        '  float alpha = clamp(mix(0.30, 1.0, fres) + spec * 0.7 + 0.12, 0.0, 1.0);',
        '  gl_FragColor = vec4(col, alpha);',
        '}'
      ].join('\n')
    });
    return { mat: mat, uniforms: uniforms };
  }

  function makeLoader() {
    var loader = new THREE.GLTFLoader();
    try {
      if (THREE.DRACOLoader) {
        var d = new THREE.DRACOLoader();
        d.setDecoderPath('assets/vendor/draco/');
        loader.setDRACOLoader(d);
      }
    } catch (e) {}
    return loader;
  }

  // Build one boat viewer in the element with id=`opts.id`, loading `opts.url`.
  function createBoat(opts) {
    var container = document.getElementById(opts.id);
    if (!container || !ready()) return;

    var W = container.clientWidth || 600, H = container.clientHeight || 460;
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 1000);

    var holo = makeHolo();
    var backMat = new THREE.MeshBasicMaterial({
      color: 0x04121f, side: THREE.BackSide,
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2
    });

    var pivot = null;               // group centred on the boat
    var ready3d = false;

    // ── Cinematic camera keyframes (pos + lookAt), eased over time ──
    // Plays once on load: sweep along the side → past the engines (stern) →
    // around the bow (front) → settle to the hero 3/4 framing.
    var SETTLE = { pos: new THREE.Vector3(0, 1.5, 9.0), look: new THREE.Vector3(0, 0, 0) };
    // Camera holds a single calm hero framing the whole time.
    camera.position.copy(SETTLE.pos);
    camera.lookAt(SETTLE.look);

    // Smooth entrance: the boat eases up + fades in, then drifts slowly.
    var entrance = 0;               // 0..1
    var curYaw = 0, curPitch = 0;   // eased rotation

    makeLoader().load(opts.url, function (gltf) {
      var loaded = gltf.scene || (gltf.scenes && gltf.scenes[0]);
      if (!loaded) return;

      var box = new THREE.Box3().setFromObject(loaded);
      var sz = box.getSize(new THREE.Vector3());
      var maxDim = Math.max(sz.x, sz.y, sz.z) || 1;
      loaded.scale.setScalar((opts.fit || 6.0) / maxDim);   // BIGGER hero presence
      box.setFromObject(loaded);
      loaded.position.sub(box.getCenter(new THREE.Vector3())); // centre at origin

      var meshes = [];
      loaded.traverse(function (o) { if (o.isMesh && o.geometry) meshes.push(o); });
      meshes.forEach(function (o) {
        o.material = holo.mat;
        var shell = new THREE.Mesh(o.geometry, backMat);
        shell.renderOrder = -1;
        o.add(shell);
      });

      pivot = new THREE.Group();
      pivot.add(loaded);
      scene.add(pivot);
      ready3d = true;
      container.classList.add('hero3d-loaded');
    }, undefined, function (err) {
      console.error('Nautico 3D load failed (' + opts.url + '):', err);
      var l = container.querySelector('.cc-hero-3d-loading');
      if (l) l.textContent = '3D unavailable';
      container.classList.add('hero3d-failed');
    });

    function resize() {
      W = container.clientWidth || 600; H = container.clientHeight || 460;
      renderer.setSize(W, H);
      camera.aspect = W / H; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    var t0 = performance.now();
    function animate(now) {
      requestAnimationFrame(animate);
      var dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      holo.uniforms.uTime.value = now / 1000;

      if (ready3d) {
        // gentle entrance (slow scale-in)
        if (entrance < 1) {
          entrance = Math.min(1, entrance + dt * 0.45);
          var e = 1 - Math.pow(1 - entrance, 3);  // easeOutCubic
          pivot.scale.setScalar(0.9 + 0.1 * e);
        }
        // GLOBAL pointer steer: NauticoPointer.x/y are -1..1 across the page.
        var px = (window.NauticoPointer && window.NauticoPointer.x) || 0;
        var py = (window.NauticoPointer && window.NauticoPointer.y) || 0;
        var targetYaw = px * 0.6;                 // boat turns toward cursor
        var targetPitch = py * 0.22;
        curYaw += (targetYaw - curYaw) * 0.05;    // slow, smooth easing
        curPitch += (targetPitch - curPitch) * 0.05;
        // very slow idle drift layered under the steer
        pivot.rotation.y = curYaw + Math.sin(now / 7000) * 0.18;
        pivot.rotation.x = curPitch;
        pivot.position.y = Math.sin(now / 2200) * 0.04;  // soft bob
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  }

  // ── Global pointer tracking (whole page → all boats follow it) ──
  if (!window.NauticoPointer) {
    window.NauticoPointer = { x: 0, y: 0 };
    var setP = function (cx, cy) {
      window.NauticoPointer.x = (cx / window.innerWidth) * 2 - 1;
      window.NauticoPointer.y = (cy / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', function (e) { setP(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('touchmove', function (e) { if (e.touches[0]) setP(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  }

  // Boot each declared viewer once THREE + the container are ready.
  function bootOne(spec, tries) {
    tries = tries || 0;
    var c = document.getElementById(spec.id);
    var sized = c && c.clientHeight > 40 && c.clientWidth > 40;
    if (ready() && sized) { createBoat(spec); return; }
    if (tries < 100) { setTimeout(function () { bootOne(spec, tries + 1); }, 100); }
  }

  function bootAll() {
    // Hero = Midnight (big). Section boats added by index.html data hooks.
    var specs = [{ id: 'hero3d', url: 'assets/boat-midnight.glb', fit: 6.2 }];
    var nodes = document.querySelectorAll('[data-boat3d]');
    nodes.forEach(function (n) {
      if (n.id === 'hero3d') return;
      specs.push({ id: n.id, url: n.getAttribute('data-boat3d'), fit: parseFloat(n.getAttribute('data-fit')) || 5.4 });
    });
    specs.forEach(function (s) { bootOne(s, 0); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  } else { bootAll(); }
})();
