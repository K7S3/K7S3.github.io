/* Nova Bastion 3D - title-screen demo vista
 *
 * NB.DemoVista: a self-contained three.js cinematic used behind the title
 * screen. It renders a stylized colony at night: the Command Spire ringed
 * by turrets and walls on a grid plain, with drifting dust and a slow
 * orbiting camera. The game controller starts it on boot and stops it when
 * a sector begins.
 *
 *   var v = new NB.DemoVista(canvas); // throws when WebGL is unavailable
 *   v.start(); v.stop(); v.resize();
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function DemoVista(canvas){
  if (!window.THREE) throw new Error('three.js not loaded');
  var gl = null;
  try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); } catch (e){}
  if (!gl) throw new Error('WebGL unavailable');

  this.cv = canvas;
  this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  this.scene = new THREE.Scene();
  this.scene.background = new THREE.Color(0x04060d);
  this.scene.fog = new THREE.Fog(0x04060d, 70, 200);
  this.camera = new THREE.PerspectiveCamera(52, 1, 0.5, 500);

  var hemi = new THREE.HemisphereLight(0x3a5a8a, 0x05070f, 1.0);
  this.scene.add(hemi);
  var dir = new THREE.DirectionalLight(0x88aaff, 0.6);
  dir.position.set(40, 80, 20);
  this.scene.add(dir);
  var amber = new THREE.PointLight(0xffb347, 1.6, 70);
  amber.position.set(0, 20, 0);
  this.scene.add(amber);
  var cyan = new THREE.PointLight(0x22d3ee, 2.4, 80);
  cyan.position.set(0, 26, 0);
  this.scene.add(cyan);
  this._cyan = cyan;

  /* ground + grid */
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0x0a0d1a, roughness: 0.95, metalness: 0.1 }));
  ground.rotation.x = -Math.PI / 2;
  this.scene.add(ground);
  var grid = new THREE.GridHelper(140, 70, 0x1a4a5a, 0x0d1e30);
  grid.position.y = 0.03;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  this.scene.add(grid);

  /* the Spire */
  var spire = new THREE.Group();
  var body = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.4, 22, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.55, metalness: 0.65,
      emissive: 0x22d3ee, emissiveIntensity: 0.3 }));
  body.position.y = 11;
  spire.add(body);
  var i, ring;
  for (i = 0; i < 3; i++){
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.4 + i * 1.1, 0.16, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.75 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 6 + i * 5;
    spire.add(ring);
  }
  var crown = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.2),
    new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 2.2 }));
  crown.position.y = 24;
  spire.add(crown);
  this._crown = crown;
  this.scene.add(spire);

  /* turret ring */
  var turretCols = ['#22d3ee', '#facc15', '#fb923c', '#f472b6', '#7dd3fc', '#c084fc', '#4ade80', '#e879f9'];
  var boxGeo = new THREE.BoxGeometry(1.6, 1, 1.6);
  for (i = 0; i < 8; i++){
    var a = (i / 8) * Math.PI * 2 + 0.4;
    var col = new THREE.Color(turretCols[i]);
    var base = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
      color: 0x232c44, roughness: 0.6, metalness: 0.5 }));
    base.scale.y = 2.2;
    base.position.set(Math.cos(a) * 16, 1.1, Math.sin(a) * 16);
    this.scene.add(base);
    var tip = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.4 }));
    tip.position.set(Math.cos(a) * 16, 2.9, Math.sin(a) * 16);
    this.scene.add(tip);
  }

  /* wall arc */
  var wallGeo = new THREE.BoxGeometry(3.8, 1.6, 1.2);
  var wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.8, metalness: 0.3 });
  for (i = 0; i < 14; i++){
    var wa = Math.PI * 0.7 + (i / 14) * Math.PI * 0.6;
    var wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(Math.cos(wa) * 26, 0.8, Math.sin(wa) * 26);
    wall.rotation.y = -wa;
    this.scene.add(wall);
  }

  /* drifting dust */
  var dustN = 320;
  var dustPos = new Float32Array(dustN * 3);
  for (i = 0; i < dustN; i++){
    dustPos[i * 3] = (Math.random() - 0.5) * 150;
    dustPos[i * 3 + 1] = Math.random() * 30 + 1;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 150;
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  this._dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0x66d5ee, size: 0.35, transparent: true, opacity: 0.7 }));
  this.scene.add(this._dust);

  /* ember motes on the far side (the Rust, watching) */
  var embN = 120;
  var embPos = new Float32Array(embN * 3);
  for (i = 0; i < embN; i++){
    var ea = Math.PI * 1.1 + Math.random() * Math.PI * 0.8;
    var er = 55 + Math.random() * 30;
    embPos[i * 3] = Math.cos(ea) * er;
    embPos[i * 3 + 1] = Math.random() * 6 + 0.5;
    embPos[i * 3 + 2] = Math.sin(ea) * er;
  }
  var embGeo = new THREE.BufferGeometry();
  embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
  this.scene.add(new THREE.Points(embGeo, new THREE.PointsMaterial({
    color: 0xff5a36, size: 0.5, transparent: true, opacity: 0.85 })));

  this._angle = 0.8;
  this._running = false;
  this._raf = 0;
  this._last = 0;
  this.resize();
}

DemoVista.prototype.resize = function(){
  var w = this.cv.clientWidth || 960, h = this.cv.clientHeight || 600;
  this.renderer.setSize(w, h, false);
  this.camera.aspect = w / Math.max(1, h);
  this.camera.updateProjectionMatrix();
};

DemoVista.prototype._frame = function(t){
  if (!this._running) return;
  var dt = this._last ? Math.min(0.05, (t - this._last) / 1000) : 0.016;
  this._last = t;
  this._angle += dt * 0.07;
  var r = 46;
  this.camera.position.set(Math.sin(this._angle) * r, 26, Math.cos(this._angle) * r);
  this.camera.lookAt(0, 8, 0);
  this._crown.rotation.y += dt * 0.8;
  this._cyan.intensity = 2.2 + Math.sin(t / 700) * 0.5;
  this._dust.rotation.y += dt * 0.01;
  this.renderer.render(this.scene, this.camera);
  var self = this;
  this._raf = requestAnimationFrame(function(tt){ self._frame(tt); });
};

DemoVista.prototype.start = function(){
  if (this._running) return;
  this._running = true;
  this._last = 0;
  this.resize();
  var self = this;
  this._raf = requestAnimationFrame(function(t){ self._frame(t); });
};

DemoVista.prototype.stop = function(){
  this._running = false;
  if (this._raf) cancelAnimationFrame(this._raf);
  this._raf = 0;
};

NB.DemoVista = DemoVista;

})();
