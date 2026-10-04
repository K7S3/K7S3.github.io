/* Nova Bastion 3D - debris / destruction physics.
 *
 * SCOPE (read before extending): this is a lightweight destruction-physics
 * system for visual juice only: tumbling debris chunks with gravity, ground
 * bounce with damping/friction, spin settle, and radial explosion impulses.
 * It is deliberately NOT a rigid-body simulator: there is no body-vs-body
 * collision, no stacking, no constraints, no fracture. A full rigid-body
 * simulation for hundreds of units is not feasible on mobile CPUs/GPUs and
 * is out of scope for this game. Unit movement stays in the sim's
 * flow-field; this system exists to SELL impacts (deaths, wall collapses,
 * explosions), nothing more.
 *
 * Perf contract: fixed pool (default 300 bodies), swap-remove compaction,
 * AABB ground-plane collision only, zero allocation per frame after init.
 * Pure logic, no THREE dependency: the renderer owns the InstancedMesh and
 * syncs matrices/colors from this system each frame.
 */
(function(){
'use strict';
var NB = globalThis.NB = globalThis.NB || {};

function num(v, d){ return (typeof v === 'number' && isFinite(v)) ? v : d; }

NB.Debris = {
  /* Create a debris system. opts: { cap, gravity } */
  create: function(opts){
    opts = opts || {};
    var cap = Math.max(16, Math.round(num(opts.cap, 300)));
    var gravity = num(opts.gravity, 22);
    var S = {
      cap: cap, gravity: gravity, n: 0,
      px: new Float32Array(cap), py: new Float32Array(cap), pz: new Float32Array(cap),
      vx: new Float32Array(cap), vy: new Float32Array(cap), vz: new Float32Array(cap),
      rx: new Float32Array(cap), ry: new Float32Array(cap),
      sx: new Float32Array(cap), sy: new Float32Array(cap),
      size: new Float32Array(cap),
      life: new Float32Array(cap), maxLife: new Float32Array(cap),
      cr: new Float32Array(cap), cg: new Float32Array(cap), cb: new Float32Array(cap),
      settled: new Uint8Array(cap)
    };

    function remove(i){
      var l = --S.n;
      if (i !== l){
        S.px[i]=S.px[l]; S.py[i]=S.py[l]; S.pz[i]=S.pz[l];
        S.vx[i]=S.vx[l]; S.vy[i]=S.vy[l]; S.vz[i]=S.vz[l];
        S.rx[i]=S.rx[l]; S.ry[i]=S.ry[l];
        S.sx[i]=S.sx[l]; S.sy[i]=S.sy[l];
        S.size[i]=S.size[l];
        S.life[i]=S.life[l]; S.maxLife[i]=S.maxLife[l];
        S.cr[i]=S.cr[l]; S.cg[i]=S.cg[l]; S.cb[i]=S.cb[l];
        S.settled[i]=S.settled[l];
      }
    }

    /* Spawn one chunk. Returns false when the pool is full (oldest is NOT
       evicted; callers should treat a full pool as "enough chaos"). */
    function spawn(x, y, z, o){
      o = o || {};
      if (S.n >= S.cap) return false;
      var i = S.n++;
      var a = Math.random() * 6.2832;
      var speed = num(o.speed, 7);
      S.px[i] = num(x, 0); S.py[i] = num(y, 0) + Math.random(); S.pz[i] = num(z, 0);
      S.vx[i] = Math.cos(a) * speed * (0.4 + Math.random() * 0.8);
      S.vy[i] = num(o.up, 5) * (0.6 + Math.random() * 0.8);
      S.vz[i] = Math.sin(a) * speed * (0.4 + Math.random() * 0.8);
      S.rx[i] = Math.random() * 6.28; S.ry[i] = Math.random() * 6.28;
      S.sx[i] = (Math.random() - 0.5) * 9; S.sy[i] = (Math.random() - 0.5) * 9;
      S.life[i] = S.maxLife[i] = num(o.life, 1.3) * (0.7 + Math.random() * 0.6);
      S.size[i] = num(o.size, 0.7) * (0.6 + Math.random() * 0.8);
      var c = o.color || [0.35, 0.29, 0.24];
      S.cr[i] = c[0]; S.cg[i] = c[1]; S.cb[i] = c[2];
      S.settled[i] = 0;
      return true;
    }

    /* Convenience: an explosion-style burst of count chunks. */
    function burst(x, y, z, o){
      o = o || {};
      var count = Math.max(1, Math.round(num(o.count, 6)));
      var ok = 0;
      for (var k = 0; k < count; k++) if (spawn(x, y, z, o)) ok++;
      return ok;
    }

    /* Radial impulse to active bodies near (x,z): shrapnel from explosions
       shoves nearby debris. Purely cosmetic. */
    function kick(x, z, radius, power){
      radius = Math.max(0.001, num(radius, 8));
      power = num(power, 10);
      var r2 = radius * radius, n = 0;
      for (var i = 0; i < S.n; i++){
        var dx = S.px[i] - x, dz = S.pz[i] - z;
        var d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        var d = Math.sqrt(d2) || 0.001;
        var f = power * (1 - d / radius);
        S.vx[i] += (dx / d) * f;
        S.vz[i] += (dz / d) * f;
        S.vy[i] += f * 0.55;
        S.sx[i] += (Math.random() - 0.5) * f * 0.8;
        S.sy[i] += (Math.random() - 0.5) * f * 0.8;
        S.settled[i] = 0;
        n++;
      }
      return n;
    }

    /* Step the simulation. groundY(x,z) -> ground height at that point. */
    function update(dt, groundY){
      dt = Math.max(0.0001, Math.min(0.1, num(dt, 1 / 60)));
      var g = S.gravity;
      for (var i = 0; i < S.n; i++){
        S.life[i] -= dt;
        if (S.life[i] <= 0){ remove(i); i--; continue; }
        if (!S.settled[i]){
          S.vy[i] -= g * dt;
          S.px[i] += S.vx[i] * dt; S.py[i] += S.vy[i] * dt; S.pz[i] += S.vz[i] * dt;
          var gy = groundY(S.px[i], S.pz[i]) + S.size[i] * 0.4;
          if (S.py[i] < gy){
            S.py[i] = gy;
            if (Math.abs(S.vy[i]) > 1.5){
              S.vy[i] *= -0.25;              /* bounce */
              S.vx[i] *= 0.7; S.vz[i] *= 0.7; /* friction */
            } else {
              /* settle: kill velocity and spin so chunks come to rest */
              S.vx[i] = 0; S.vy[i] = 0; S.vz[i] = 0;
              S.sx[i] *= 0.2; S.sy[i] *= 0.2;
              if (Math.abs(S.sx[i]) < 0.4 && Math.abs(S.sy[i]) < 0.4){
                S.sx[i] = 0; S.sy[i] = 0; S.settled[i] = 1;
              }
            }
          }
          S.rx[i] += S.sx[i] * dt; S.ry[i] += S.sy[i] * dt;
        }
      }
    }

    function clear(){ S.n = 0; }

    return {
      spawn: spawn, burst: burst, kick: kick, update: update, clear: clear,
      active: function(){ return S.n; },
      cap: function(){ return S.cap; },
      /* read-only body access for the renderer + tests */
      body: function(i){
        return { x: S.px[i], y: S.py[i], z: S.pz[i],
                 rx: S.rx[i], ry: S.ry[i], size: S.size[i],
                 life: S.life[i], maxLife: S.maxLife[i],
                 r: S.cr[i], g: S.cg[i], b: S.cb[i], settled: !!S.settled[i] };
      },
      _arrays: S /* exposed for unit tests */
    };
  }
};

})();
