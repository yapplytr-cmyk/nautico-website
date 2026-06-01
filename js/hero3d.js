/* ═══════════════════════════════════════════════════════════════
   NAUTICO website — Hero 3D Midnight Express viewer
   Big glowing-glass boat, slow auto-rotate + entrance spin-in.
   Reuses the app's vendored Three.js r128 (local, no CDN).
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function ready() { return window.THREE && THREE.GLTFLoader; }

  // Glowing-glass shader (cyan, fresnel edges, gentle breathing pulse)
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
      if (THREE.DRACOLoader) { var d = new THREE.DRACOLoader(); d.setDecoderPath('assets/vendor/draco/'); loader.setDRACOLoader(d); }
    } catch (e) {}
    return loader;
  }

  function init() {
    var container = document.getElementById('hero3d');
    if (!container || !ready()) return;

    var W = container.clientWidth || 600, H = container.clientHeight || 500;
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 1000);
    camera.position.set(2.2, 1.2, 5.4);

    var holo = makeHolo();
    var backMat = new THREE.MeshBasicMaterial({
      color: 0x04121f, side: THREE.BackSide,
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2
    });

    var model = null;
    var targetScale = 1;      // final fitted scale
    var baseY = 0;            // centered Y after recenter
    var spinY = -0.9;         // start rotated, settle to ~0 facing
    var entrance = 0;         // 0..1 entrance progress

    makeLoader().load('assets/boat-midnight.glb', function (gltf) {
      model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
      if (!model) return;
      var box = new THREE.Box3().setFromObject(model);
      var c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      var maxDim = Math.max(sz.x, sz.y, sz.z) || 1;
      targetScale = 5.0 / maxDim;             // big hero presence
      model.scale.setScalar(targetScale * 0.7); // start a touch small, grow in
      box.setFromObject(model); box.getCenter(c);
      model.position.set(-c.x, -c.y, -c.z);
      baseY = -c.y;

      model.traverse(function (o) {
        if (o.isMesh && o.geometry) {
          o.material = holo.mat;
          var shell = new THREE.Mesh(o.geometry, backMat);
          shell.renderOrder = -1;
          o.add(shell);
        }
      });
      scene.add(model);
      container.classList.add('hero3d-loaded');
    }, undefined, function (err) {
      console.log('Nautico hero3d load failed', err && err.message);
      container.classList.add('hero3d-failed');
    });

    function resize() {
      W = container.clientWidth || 600; H = container.clientHeight || 500;
      renderer.setSize(W, H);
      camera.aspect = W / H; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    var t0 = performance.now();
    function animate(now) {
      requestAnimationFrame(animate);
      var dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      holo.uniforms.uTime.value = now / 1000;
      if (model) {
        if (entrance < 1) {
          entrance = Math.min(1, entrance + dt * 0.5);
          var e = 1 - Math.pow(1 - entrance, 3); // easeOutCubic
          model.scale.setScalar(targetScale * (0.7 + 0.3 * e));
        }
        spinY += dt * 0.35;                 // slow continuous rotation
        model.rotation.y = spinY;
        model.position.y = baseY + Math.sin(now / 1400) * 0.06; // gentle bob
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  }

  // Wait for THREE to be present (scripts load just above this one)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 60); });
  } else {
    setTimeout(init, 60);
  }
})();
