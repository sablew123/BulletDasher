/* ===== Pecera.js =====
 * Mini-simulación autónoma (sin jugador) que vive dentro de la caja #pecera
 * de la ventana de Cartas. Usa los mismos 4 enemigos vivos de BulletDasher
 * (Purps, Redsts, Pepes y Berserkers) pero con comportamientos nuevos,
 * pensados para que se entretengan solos.
 *
 * ---------------------------------------------------------------------
 * USO BÁSICO
 * ---------------------------------------------------------------------
 *   Pecera.init(document.getElementById('pecera'));   // una sola vez
 *   Pecera.setConfig(PECERA_CONFIGS.default);          // elige qué sale
 *   Pecera.start();                                    // arranca el loop
 *   Pecera.stop();                                     // lo pausa (ej: al cerrar la ventana)
 *
 * ---------------------------------------------------------------------
 * CONFIGURACIONES
 * ---------------------------------------------------------------------
 * Una config es un objeto con dos partes, ambas opcionales:
 *
 *   {
 *     inicial: [
 *       { type: 'purp',      x: 60,  y: 80 },
 *       { type: 'redst',     x: 300, y: 40 },
 *       { type: 'pepe',      x: 150, y: 100 },
 *       { type: 'berserker', x: 400, y: 70 }
 *     ],
 *     constante: [
 *       { type: 'purp', edge: 'random', every: 240 },   // cada 240 frames (~4s) sale un Purp de un borde random
 *       { type: 'pepe', edge: 'left',   every: 300, jitter: 60 } // "jitter" varia el intervalo +-N frames
 *     ]
 *   }
 *
 * "edge" acepta 'top' | 'bottom' | 'left' | 'right' | 'random'.
 * Los tipos válidos son: 'purp', 'redst', 'pepe', 'berserker'.
 *
 * ---------------------------------------------------------------------
 * CÓMO SE ENLAZA CON LA CARTA EN PANTALLA (a futuro)
 * ---------------------------------------------------------------------
 * Cartas.js ya expone cada carta con su propio "id" (carta000, carta001...).
 * Cuando se quiera que cada carta traiga su propia pecera, basta con:
 *   1. Agregar una config nueva a PECERA_CONFIGS con esa misma key (ej. "carta000").
 *   2. En index.html, tras elegir la carta al azar, llamar:
 *        Pecera.setConfig(PECERA_CONFIGS[cartaElegida.id] || PECERA_CONFIGS.default);
 * Por ahora solo existe "default" para poder probar el sistema completo.
 */

(function () {
    'use strict';

    // ============================================================
    // CONSTANTES DE COMPORTAMIENTO Y DIBUJO
    // Los tamaños/velocidades están reducidos respecto al juego real
    // porque la pecera es una caja angosta (una franja, no un canvas completo).
    // ============================================================

    const MATERIALIZE_DURATION = 60; // ~1s a 60fps: gris y girando antes de despertar

    // --- Purp (lento, curioso, tímido con los Berserkers) ---
    const PURP_SIZE = 10;
    const PURP_MAX_SPEED = 0.75;
    const PURP_SEEK_ACCEL = 0.05;
    const PURP_FLEE_ACCEL = 0.16;
    const PURP_FLEE_SPEED = 1.9;
    const PURP_FLEE_RADIUS = 55;
    const PURP_WANDER_MIN = 50;
    const PURP_WANDER_MAX = 160;
    const PURP_NUDGE_MIN = 20;
    const PURP_NUDGE_MAX = 45;

    // --- Redst (dispara a un punto, o va directo a odiar Berserkers) ---
    const REDST_SIZE = 8;
    const REDST_AIM_MIN = 35;
    const REDST_AIM_MAX = 65;
    const REDST_SHOOT_SPEED = 5.6;
    const REDST_STOP_MIN = 25;
    const REDST_STOP_MAX = 55;
    const REDST_ARRIVE_DIST = 6;
    const REDST_ATTACK_TIMEOUT = 240; // si en este tiempo no conecta el golpe, se rinde y vuelve a aimear

    // --- Pepe (rebota, inmortal, ignora todo lo demás) ---
    // Mismo tamaño que el Berserker (ver BERSERKER_SIZE más abajo).
    const PEPE_SIZE = 14 * 1.4 * 2 * 0.55;
    const PEPE_SPEED = 2.1;

    // --- Berserker (duerme, despierta con el mouse, se asusta, se enoja) ---
    const BERSERKER_SIZE = 14 * 1.4 * 2 * 0.55;
    const BERSERKER_MAX_HP = 3;
    const BERSERKER_WAKE_RADIUS = 60;
    const BERSERKER_ACCEL_AWAKE = 0.07;
    const BERSERKER_ACCEL_ENRAGED = 0.15;
    const BERSERKER_MAX_SPEED_AWAKE = 2.1;
    const BERSERKER_MAX_SPEED_ENRAGED = 3.4;
    const BERSERKER_FRICTION = 0.965;
    const BERSERKER_DRIFT_FLOOR = 0.045; // nunca llega a velocidad cero del todo
    const BERSERKER_SCARED_KICK = 2.6;
    const BERSERKER_SCARED_DURATION = 45;
    const BERSERKER_ENRAGE_TIMEOUT = 420; // si no alcanza al Redst en este tiempo, se calma solo
    const BERSERKER_PUSH_ON_CALM_HIT = 3.4;
    const BERSERKER_HIT_BRAKE = 0.75;
    const BERSERKER_HP_REGEN_EVERY = 90; // regenera 1 "vida" visual cada tanto, para que nunca se apague
    const BERSERKER_BUMP_KICK = 2.6;          // choque accidental (con otro Berserker que no es su rival)
    const BERSERKER_RIVAL_PUNCH_KICK = 4.4;   // choque a propósito entre dos Berserkers que se odian

    // --- Rivalidad entre Berserkers (para cartas donde se llevan mal) ---
    const RIVAL_ACCEL = 0.13;
    const RIVAL_MAX_SPEED = 3.1;
    const RIVAL_SEEK_TIMEOUT = 260;       // si no alcanza al rival en este tiempo, desiste (por ahora)
    const RIVAL_COOLDOWN_MIN = 130;       // ~2s: tiempo mínimo entre peleas ("a cada rato", no sin parar)
    const RIVAL_COOLDOWN_MAX = 260;       // ~4.3s
    const RIVAL_INITIAL_WAIT_MIN = 40;
    const RIVAL_INITIAL_WAIT_MAX = 140;

    const BASE_COLOR = { r: 255, g: 95, b: 40 };
    const BLINK_COLOR = { r: 255, g: 15, b: 15 };

    // ============================================================
    // ESTADO DEL MÓDULO
    // ============================================================

    let canvas = null;
    let ctx = null;
    let container = null;
    let resizeObserver = null;
    let rafId = null;
    let running = false;

    let W = 0, H = 0;

    let purps = [];
    let redsts = [];
    let pepes = [];
    let berserkers = [];

    let constantSpawners = [];

    let mouse = { x: -9999, y: -9999 };

    // ============================================================
    // UTILIDADES
    // ============================================================

    function rand(min, max) { return min + Math.random() * (max - min); }
    function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
    function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function edgeSpawnPoint(edge, sizeHalf) {
        let e = edge;
        if (!e || e === 'random') e = ['top', 'bottom', 'left', 'right'][randInt(0, 3)];
        if (e === 'top') return { x: rand(sizeHalf, W - sizeHalf), y: sizeHalf };
        if (e === 'bottom') return { x: rand(sizeHalf, W - sizeHalf), y: H - sizeHalf };
        if (e === 'left') return { x: sizeHalf, y: rand(sizeHalf, H - sizeHalf) };
        return { x: W - sizeHalf, y: rand(sizeHalf, H - sizeHalf) }; // right
    }

    // Rebote genérico contra los bordes de la pecera. Usado por TODOS los
    // enemigos: acá, a diferencia del juego, nadie puede salirse de la caja.
    function bounceEdges(e, sizeHalf) {
        let bounced = false;
        if (e.x - sizeHalf < 0) { e.x = sizeHalf; e.vx = Math.abs(e.vx); bounced = 'left'; }
        else if (e.x + sizeHalf > W) { e.x = W - sizeHalf; e.vx = -Math.abs(e.vx); bounced = 'right'; }
        if (e.y - sizeHalf < 0) { e.y = sizeHalf; e.vy = Math.abs(e.vy); bounced = bounced || 'top'; }
        else if (e.y + sizeHalf > H) { e.y = H - sizeHalf; e.vy = -Math.abs(e.vy); bounced = bounced || 'bottom'; }
        return bounced;
    }

    // ============================================================
    // CREACIÓN DE ENEMIGOS (todos entran "dormidos": grises y girando,
    // como si los hubieran tirado al agua. Un segundo después despiertan.)
    // ============================================================

    function baseFields(type, x, y) {
        return {
            type,
            x, y,
            vx: 0, vy: 0,
            rotation: rand(0, Math.PI * 2),
            materializing: true,
            materializeTimer: MATERIALIZE_DURATION,
            spinSpeed: rand(0.35, 0.55) * (Math.random() < 0.5 ? -1 : 1)
        };
    }

    function spawnPurp(x, y) {
        const p = baseFields('purp', x, y);
        p.size = PURP_SIZE;
        p.mode = 'pause';          // 'seek' | 'pause' | 'nudge' | 'flee'
        p.wanderTimer = randInt(PURP_WANDER_MIN, PURP_WANDER_MAX);
        p.targetX = x; p.targetY = y;
        p.nudgeDir = 0; p.nudgeTimer = 0;
        p.prevMode = 'seek';
        purps.push(p);
        return p;
    }

    function spawnRedst(x, y) {
        const r = baseFields('redst', x, y);
        r.size = REDST_SIZE;
        r.state = 'aiming';        // 'aiming' | 'shooting' | 'stopped'
        r.aimTimer = randInt(REDST_AIM_MIN, REDST_AIM_MAX);
        r.stopTimer = 0;
        r.targetX = x; r.targetY = y;
        r.hostile = false;
        r.targetBerserker = null;
        r.attackTimer = 0;
        redsts.push(r);
        return r;
    }

    function spawnPepe(x, y) {
        const b = baseFields('pepe', x, y);
        b.size = PEPE_SIZE;
        const ang = rand(0, Math.PI * 2);
        b.vx = Math.cos(ang) * PEPE_SPEED;
        b.vy = Math.sin(ang) * PEPE_SPEED;
        pepes.push(b);
        return b;
    }

    function spawnBerserker(x, y, opts) {
        const b = baseFields('berserker', x, y);
        b.size = BERSERKER_SIZE;
        b.hp = BERSERKER_MAX_HP;
        b.hpRegenTimer = BERSERKER_HP_REGEN_EVERY;
        b.state = 'idle';          // 'idle' | 'awake' | 'scared' | 'enraged' | 'grudge'
        b.stateTimer = 0;
        b.enrageTarget = null;
        b.blinkTimer = randInt(0, 100);
        b.hitFlash = 0;

        // Rivalidad: si "rival" viene en true, este Berserker odia a CUALQUIER
        // otro Berserker que también tenga rival:true, y cada tanto va a buscar
        // pelea con el que tenga más cerca (ver updateBerserker).
        b.rival = !!(opts && opts.rival);
        b.grudgeTarget = null;
        b.rivalCooldown = b.rival ? randInt(RIVAL_INITIAL_WAIT_MIN, RIVAL_INITIAL_WAIT_MAX) : 0;

        berserkers.push(b);
        return b;
    }

    const SPAWNERS = { purp: spawnPurp, redst: spawnRedst, pepe: spawnPepe, berserker: spawnBerserker };

    function spawnAt(type, x, y, extra) {
        const fn = SPAWNERS[type];
        if (!fn) return null;
        return fn(clamp(x, 4, W - 4), clamp(y, 4, H - 4), extra);
    }

    function spawnFromEdge(type, edge, extra) {
        const sizeHalf = { purp: PURP_SIZE, redst: REDST_SIZE, pepe: PEPE_SIZE, berserker: BERSERKER_SIZE }[type] / 2 || 8;
        const p = edgeSpawnPoint(edge, sizeHalf);
        return spawnAt(type, p.x, p.y, extra);
    }

    // ============================================================
    // COMPORTAMIENTO: PURP
    // Nada lento y erráticamente, como pez curioso. Huye de los Berserkers.
    // ============================================================

    // Los Purps le huyen tanto a los Berserkers como a los Redsts: se busca
    // cuál de los dos (el que sea) está más cerca, y de ese se huye.
    function nearestThreatTo(x, y) {
        let best = null, bestDist = Infinity;
        for (const b of berserkers) {
            if (b.materializing) continue;
            const d = dist(x, y, b.x, b.y);
            if (d < bestDist) { bestDist = d; best = b; }
        }
        for (const r of redsts) {
            if (r.materializing) continue;
            const d = dist(x, y, r.x, r.y);
            if (d < bestDist) { bestDist = d; best = r; }
        }
        return { threat: best, dist: bestDist };
    }

    function updatePurp(p) {
        const { threat: closeThreat, dist: dThreat } = nearestThreatTo(p.x, p.y);

        if (closeThreat && dThreat < PURP_FLEE_RADIUS) {
            p.mode = 'flee';
        } else if (p.mode === 'flee') {
            // ya no hay peligro cerca: vuelve a decidir qué hacer
            p.mode = 'pause';
            p.wanderTimer = randInt(20, 50);
        }

        if (p.mode === 'flee' && closeThreat) {
            const dx = p.x - closeThreat.x, dy = p.y - closeThreat.y;
            const d = Math.hypot(dx, dy) || 0.01;
            p.vx += (dx / d) * PURP_FLEE_ACCEL;
            p.vy += (dy / d) * PURP_FLEE_ACCEL;
            const spd = Math.hypot(p.vx, p.vy);
            if (spd > PURP_FLEE_SPEED) { p.vx = p.vx / spd * PURP_FLEE_SPEED; p.vy = p.vy / spd * PURP_FLEE_SPEED; }
        } else {
            p.wanderTimer--;
            if (p.wanderTimer <= 0) {
                const roll = Math.random();
                if (roll < 0.45) {
                    // ir a un punto nuevo
                    p.mode = 'seek';
                    p.targetX = rand(p.size, W - p.size);
                    p.targetY = rand(p.size, H - p.size);
                    p.wanderTimer = randInt(PURP_WANDER_MIN, PURP_WANDER_MAX);
                } else if (roll < 0.7) {
                    // quedarse quieto un rato
                    p.mode = 'pause';
                    p.wanderTimer = randInt(30, 90);
                } else {
                    // interrumpir: nudge a una dirección corta y después retomar lo de antes
                    p.prevMode = (p.mode === 'nudge') ? 'pause' : p.mode;
                    p.mode = 'nudge';
                    p.nudgeDir = rand(0, Math.PI * 2);
                    p.nudgeTimer = randInt(PURP_NUDGE_MIN, PURP_NUDGE_MAX);
                    p.wanderTimer = p.nudgeTimer + randInt(PURP_WANDER_MIN, PURP_WANDER_MAX);
                }
            }

            if (p.mode === 'seek') {
                const dx = p.targetX - p.x, dy = p.targetY - p.y;
                const d = Math.hypot(dx, dy);
                if (d < 6) { p.mode = 'pause'; p.wanderTimer = randInt(30, 80); }
                else {
                    p.vx += (dx / d) * PURP_SEEK_ACCEL;
                    p.vy += (dy / d) * PURP_SEEK_ACCEL;
                }
            } else if (p.mode === 'pause') {
                p.vx *= 0.9; p.vy *= 0.9;
            } else if (p.mode === 'nudge') {
                p.nudgeTimer--;
                p.vx += Math.cos(p.nudgeDir) * PURP_SEEK_ACCEL * 0.8;
                p.vy += Math.sin(p.nudgeDir) * PURP_SEEK_ACCEL * 0.8;
                if (p.nudgeTimer <= 0) p.mode = p.prevMode;
            }

            const spd = Math.hypot(p.vx, p.vy);
            if (spd > PURP_MAX_SPEED) { p.vx = p.vx / spd * PURP_MAX_SPEED; p.vy = p.vy / spd * PURP_MAX_SPEED; }
        }

        p.x += p.vx; p.y += p.vy;
        bounceEdges(p, p.size / 2);

        // gira apenas, solo para dar vidilla, proporcional a su velocidad
        p.rotation += Math.hypot(p.vx, p.vy) * 0.05;
    }

    // ============================================================
    // COMPORTAMIENTO: REDST
    // Sin Berserkers: apunta a un punto random, dispara, se detiene, repite.
    // Con Berserkers: va directo por el más cercano y lo ataca sin piedad
    // (aunque puede morir en el intento si el Berserker está despierto).
    // ============================================================

    function pickPeacefulTarget(r) {
        r.targetX = rand(r.size, W - r.size);
        r.targetY = rand(r.size, H - r.size);
        r.hostile = false;
        r.targetBerserker = null;
    }

    function startAiming(r) {
        r.state = 'aiming';
        r.aimTimer = randInt(REDST_AIM_MIN, REDST_AIM_MAX);
        if (berserkers.length > 0) {
            const awakeBerserkers = berserkers.filter(b => !b.materializing);
            if (awakeBerserkers.length > 0) {
                let best = null, bestDist = Infinity;
                for (const b of awakeBerserkers) {
                    const d = dist(r.x, r.y, b.x, b.y);
                    if (d < bestDist) { bestDist = d; best = b; }
                }
                r.hostile = true;
                r.targetBerserker = best;
                r.targetX = best.x; r.targetY = best.y;
                r.attackTimer = REDST_ATTACK_TIMEOUT;
                return;
            }
        }
        pickPeacefulTarget(r);
    }

    function resolveRedstVsBerserker(r, b) {
        if (b.state === 'idle' || b.state === 'scared') {
            // Lo agarró desprevenido: lo empuja y lo enfurece, pero el Redst
            // sobrevive al golpe (fue un roce, no un impacto de lleno).
            const speed = Math.hypot(r.vx, r.vy) || 0.01;
            b.vx += (r.vx / speed) * BERSERKER_PUSH_ON_CALM_HIT;
            b.vy += (r.vy / speed) * BERSERKER_PUSH_ON_CALM_HIT;
            b.state = 'enraged';
            b.enrageTarget = r;
            b.stateTimer = BERSERKER_ENRAGE_TIMEOUT;

            // el redst rebota del golpe y vuelve a decidir qué hacer
            r.vx *= -0.6; r.vy *= -0.6;
            r.state = 'stopped';
            r.stopTimer = randInt(REDST_STOP_MIN, REDST_STOP_MAX);
            return false; // no murió
        } else {
            // Estaba alerta: el Redst se estrella y muere en el intento.
            b.vx *= BERSERKER_HIT_BRAKE; b.vy *= BERSERKER_HIT_BRAKE;
            b.hitFlash = 10;
            b.hp = Math.max(0, b.hp - 1);
            b.hpRegenTimer = BERSERKER_HP_REGEN_EVERY;
            if (b.state === 'enraged' && b.enrageTarget === r) { b.state = 'idle'; b.enrageTarget = null; }
            return true; // murió
        }
    }

    function updateRedst(r, index) {
        if (r.state === 'aiming') {
            if (r.hostile && r.targetBerserker) {
                if (!berserkers.includes(r.targetBerserker)) { startAiming(r); return; }
                r.targetX = r.targetBerserker.x;
                r.targetY = r.targetBerserker.y;
            }
            r.aimTimer--;
            r.rotation += 0.08;
            if (r.aimTimer <= 0) {
                const dx = r.targetX - r.x, dy = r.targetY - r.y;
                const d = Math.hypot(dx, dy) || 0.01;
                r.vx = (dx / d) * REDST_SHOOT_SPEED;
                r.vy = (dy / d) * REDST_SHOOT_SPEED;
                r.state = 'shooting';
            }
            return;
        }

        if (r.state === 'shooting') {
            r.x += r.vx; r.y += r.vy;
            const edgeHit = bounceEdges(r, r.size / 2);

            // A toda velocidad, un Redst atraviesa (y mata) cualquier Purp que
            // se le cruce en el camino, esté o no persiguiendo a un Berserker.
            for (let pi = purps.length - 1; pi >= 0; pi--) {
                const p = purps[pi];
                if (p.materializing) continue;
                if (dist(r.x, r.y, p.x, p.y) < (r.size / 2 + p.size / 2)) {
                    purps.splice(pi, 1);
                }
            }

            if (r.hostile && r.targetBerserker) {
                r.attackTimer--;
                if (berserkers.includes(r.targetBerserker)) {
                    const b = r.targetBerserker;
                    if (dist(r.x, r.y, b.x, b.y) < (r.size / 2 + b.size / 2) && !b.materializing) {
                        const died = resolveRedstVsBerserker(r, b);
                        if (died) { redsts.splice(index, 1); return; }
                        return;
                    }
                } else {
                    startAiming(r);
                    return;
                }
                if (r.attackTimer <= 0 || edgeHit) {
                    // se cansó de perseguir o rebotó sin conectar: respira y reintenta
                    r.state = 'stopped';
                    r.stopTimer = randInt(REDST_STOP_MIN, REDST_STOP_MAX);
                }
                return;
            }

            // modo pacífico: se detiene solo al llegar a destino
            if (dist(r.x, r.y, r.targetX, r.targetY) < REDST_ARRIVE_DIST || edgeHit) {
                r.vx = 0; r.vy = 0;
                r.state = 'stopped';
                r.stopTimer = randInt(REDST_STOP_MIN, REDST_STOP_MAX);
            }
            return;
        }

        if (r.state === 'stopped') {
            r.stopTimer--;
            r.rotation += 0.03; // se entretiene girando un toque mientras descansa
            if (r.stopTimer <= 0) startAiming(r);
        }
    }

    // ============================================================
    // COMPORTAMIENTO: PEPE
    // Rebote constante, inmortal, no le importa nada de lo que pasa alrededor.
    // ============================================================

    function updatePepe(p) {
        p.x += p.vx; p.y += p.vy;
        bounceEdges(p, p.size / 2);
        p.rotation += 0.06;
    }

    // ============================================================
    // COMPORTAMIENTO: BERSERKER
    // Flota casi quieto. Despierta si el mouse pasa cerca. Se asusta al
    // chocar con un borde o un Pepe. Se enfurece si un Redst calmado lo
    // golpea desprevenido, y lo persigue hasta cazarlo.
    // ============================================================

    function scareBerserker(b, nx, ny, kick) {
        // nx, ny: dirección del golpe (normal de colisión), ya normalizada
        const k = kick || BERSERKER_SCARED_KICK;
        b.vx = nx * k;
        b.vy = ny * k;
        b.state = 'scared';
        b.stateTimer = BERSERKER_SCARED_DURATION;
    }

    // Busca, entre los OTROS Berserkers con rival:true, el más cercano a "b".
    function nearestRivalTo(b) {
        let best = null, bestDist = Infinity;
        for (const other of berserkers) {
            if (other === b || !other.rival || other.materializing) continue;
            const d = dist(b.x, b.y, other.x, other.y);
            if (d < bestDist) { bestDist = d; best = other; }
        }
        return best;
    }

    function updateBerserker(b) {
        b.blinkTimer++;

        // Regenera de a poco su brillo/vida visual: nunca se "apaga" del todo.
        b.hpRegenTimer--;
        if (b.hpRegenTimer <= 0 && b.hp < BERSERKER_MAX_HP) { b.hp++; b.hpRegenTimer = BERSERKER_HP_REGEN_EVERY; }
        if (b.hitFlash > 0) b.hitFlash--;
        if (b.rival && b.rivalCooldown > 0) b.rivalCooldown--;

        const mDist = dist(b.x, b.y, mouse.x, mouse.y);

        if (b.state === 'enraged') {
            b.stateTimer--;
            if (!b.enrageTarget || !redsts.includes(b.enrageTarget) || b.stateTimer <= 0) {
                b.state = 'idle';
                b.enrageTarget = null;
            } else {
                const dx = b.enrageTarget.x - b.x, dy = b.enrageTarget.y - b.y;
                const d = Math.hypot(dx, dy) || 0.01;
                b.vx += (dx / d) * BERSERKER_ACCEL_ENRAGED;
                b.vy += (dy / d) * BERSERKER_ACCEL_ENRAGED;
                const spd = Math.hypot(b.vx, b.vy);
                if (spd > BERSERKER_MAX_SPEED_ENRAGED) {
                    b.vx = b.vx / spd * BERSERKER_MAX_SPEED_ENRAGED;
                    b.vy = b.vy / spd * BERSERKER_MAX_SPEED_ENRAGED;
                }
            }
        } else if (b.state === 'scared') {
            b.stateTimer--;
            b.vx *= BERSERKER_FRICTION;
            b.vy *= BERSERKER_FRICTION;
            if (b.stateTimer <= 0) b.state = 'idle';
        } else if (mDist < BERSERKER_WAKE_RADIUS) {
            b.state = 'awake';
            const dx = mouse.x - b.x, dy = mouse.y - b.y;
            const d = Math.hypot(dx, dy) || 0.01;
            b.vx += (dx / d) * BERSERKER_ACCEL_AWAKE;
            b.vy += (dy / d) * BERSERKER_ACCEL_AWAKE;
            const spd = Math.hypot(b.vx, b.vy);
            if (spd > BERSERKER_MAX_SPEED_AWAKE) {
                b.vx = b.vx / spd * BERSERKER_MAX_SPEED_AWAKE;
                b.vy = b.vy / spd * BERSERKER_MAX_SPEED_AWAKE;
            }
        } else if (b.state === 'grudge') {
            // Persiguiendo a un rival para pelear con él a propósito.
            b.stateTimer--;
            if (!b.grudgeTarget || !berserkers.includes(b.grudgeTarget) || b.stateTimer <= 0) {
                b.state = 'idle';
                b.grudgeTarget = null;
                b.rivalCooldown = randInt(RIVAL_COOLDOWN_MIN, RIVAL_COOLDOWN_MAX);
            } else {
                const dx = b.grudgeTarget.x - b.x, dy = b.grudgeTarget.y - b.y;
                const d = Math.hypot(dx, dy) || 0.01;
                b.vx += (dx / d) * RIVAL_ACCEL;
                b.vy += (dy / d) * RIVAL_ACCEL;
                const spd = Math.hypot(b.vx, b.vy);
                if (spd > RIVAL_MAX_SPEED) {
                    b.vx = b.vx / spd * RIVAL_MAX_SPEED;
                    b.vy = b.vy / spd * RIVAL_MAX_SPEED;
                }
            }
        } else {
            // Nadie lo molesta: se calma con normalidad (fricción, sin frenazo).
            b.state = 'idle';
            b.vx *= BERSERKER_FRICTION;
            b.vy *= BERSERKER_FRICTION;
            const spd = Math.hypot(b.vx, b.vy);
            if (spd < BERSERKER_DRIFT_FLOOR && spd > 0.0005) {
                // nunca llega a estar full quieto: queda flotando lentísimo
                // hacia donde iba, en vez de frenar en seco
                b.vx = (b.vx / spd) * BERSERKER_DRIFT_FLOOR;
                b.vy = (b.vy / spd) * BERSERKER_DRIFT_FLOOR;
            }

            // Cada tanto (según rivalCooldown) sale a buscar al rival más cercano.
            if (b.rival && b.rivalCooldown <= 0) {
                const target = nearestRivalTo(b);
                if (target) {
                    b.state = 'grudge';
                    b.grudgeTarget = target;
                    b.stateTimer = RIVAL_SEEK_TIMEOUT;
                }
            }
        }

        b.x += b.vx; b.y += b.vy;

        const halfB = b.size / 2;
        const hitEdge = bounceEdges(b, halfB);
        if (hitEdge && b.state !== 'scared' && b.state !== 'enraged') {
            const nx = hitEdge === 'left' ? 1 : hitEdge === 'right' ? -1 : 0;
            const ny = hitEdge === 'top' ? 1 : hitEdge === 'bottom' ? -1 : 0;
            scareBerserker(b, nx || 0, ny || 0);
        }

        // Choque con Pepes: al Berserker lo asusta y lo rebota, al Pepe no le pasa nada.
        if (b.state !== 'scared') {
            for (const p of pepes) {
                if (p.materializing) continue;
                const d = dist(b.x, b.y, p.x, p.y);
                const minD = halfB + p.size / 2;
                if (d < minD && d > 0.001) {
                    const nx = (b.x - p.x) / d, ny = (b.y - p.y) / d;
                    b.x = p.x + nx * minD; b.y = p.y + ny * minD;
                    scareBerserker(b, nx, ny);
                    break;
                }
            }
        }

        // Un Berserker en movimiento no "atraviesa" a un Redst que está parado
        // apuntando o descansando: lo mata al pasarle por encima. (Al que está
        // en pleno disparo, "shooting", lo maneja resolveRedstVsBerserker.)
        for (let ri = redsts.length - 1; ri >= 0; ri--) {
            const r = redsts[ri];
            if (r.materializing) continue;
            if (r.state !== 'aiming' && r.state !== 'stopped') continue;
            if (dist(b.x, b.y, r.x, r.y) < (halfB + r.size / 2)) {
                redsts.splice(ri, 1);
            }
        }

        // Rotación: proporcional a la velocidad. Casi quieto = casi no gira.
        const spdNow = Math.hypot(b.vx, b.vy);
        if (spdNow > BERSERKER_DRIFT_FLOOR + 0.01) {
            b.rotation += 0.05 + spdNow * 0.09;
        }
    }

    // Choques Berserker-contra-Berserker: separa a los dos y los "asusta".
    // Si el choque fue justo entre dos rivales persiguiéndose (grudge), el
    // golpe es más fuerte (el puñetazo que buscaban) y ambos entran en
    // "cooldown" antes de volver a buscar pelea.
    function updateBerserkerPairs() {
        for (let i = 0; i < berserkers.length; i++) {
            const b1 = berserkers[i];
            if (b1.materializing) continue;
            for (let j = i + 1; j < berserkers.length; j++) {
                const b2 = berserkers[j];
                if (b2.materializing) continue;

                const dx = b1.x - b2.x, dy = b1.y - b2.y;
                let d = Math.hypot(dx, dy);
                const minD = b1.size / 2 + b2.size / 2;
                if (d >= minD) continue;
                if (d < 0.001) d = 0.001;
                const nx = dx / d, ny = dy / d;

                const overlap = minD - d;
                b1.x += nx * overlap / 2; b1.y += ny * overlap / 2;
                b2.x -= nx * overlap / 2; b2.y -= ny * overlap / 2;

                const isGrudgeFight =
                    (b1.state === 'grudge' && b1.grudgeTarget === b2) ||
                    (b2.state === 'grudge' && b2.grudgeTarget === b1);

                const kick = isGrudgeFight ? BERSERKER_RIVAL_PUNCH_KICK : BERSERKER_BUMP_KICK;
                scareBerserker(b1, nx, ny, kick);
                scareBerserker(b2, -nx, -ny, kick);

                if (isGrudgeFight) {
                    b1.grudgeTarget = null; b2.grudgeTarget = null;
                    b1.rivalCooldown = randInt(RIVAL_COOLDOWN_MIN, RIVAL_COOLDOWN_MAX);
                    b2.rivalCooldown = randInt(RIVAL_COOLDOWN_MIN, RIVAL_COOLDOWN_MAX);
                }
            }
        }
    }

    // ============================================================
    // COLISIÓN REDST -> BERSERKER cuando el redst está "shooting" hostil
    // ya se resuelve dentro de updateRedst (resolveRedstVsBerserker).
    // ============================================================

    // ============================================================
    // MATERIALIZACIÓN (entrada gris y girando para cualquier enemigo)
    // ============================================================

    function updateMaterializing(e) {
        e.materializeTimer--;
        e.rotation += e.spinSpeed;
        if (e.materializeTimer <= 0) {
            e.materializing = false;
            e.rotation = 0;
        }
    }

    // ============================================================
    // LOOP PRINCIPAL
    // ============================================================

    function step() {
        // Purps
        for (const p of purps) {
            if (p.materializing) updateMaterializing(p);
            else updatePurp(p);
        }

        // Pepes
        for (const p of pepes) {
            if (p.materializing) updateMaterializing(p);
            else updatePepe(p);
        }

        // Berserkers
        for (const b of berserkers) {
            if (b.materializing) updateMaterializing(b);
            else updateBerserker(b);
        }
        // Choques entre Berserkers (incluye las peleas de rivalidad)
        updateBerserkerPairs();

        // Redsts (recorrido hacia atrás porque pueden auto-eliminarse al morir)
        for (let i = redsts.length - 1; i >= 0; i--) {
            const r = redsts[i];
            if (r.materializing) updateMaterializing(r);
            else updateRedst(r, i);
        }

        // Spawners constantes
        for (const s of constantSpawners) {
            s.timer--;
            if (s.timer <= 0) {
                spawnFromEdge(s.type, s.edge, s.extra);
                const jitter = s.jitter ? randInt(-s.jitter, s.jitter) : 0;
                s.timer = Math.max(20, (s.every || 240) + jitter);
            }
        }
    }

    // ============================================================
    // DIBUJADO
    // ============================================================

    function greyForMaterializing(e) {
        // gris parejo, un poco más claro al centro, para que se note que "no ha despertado"
        const t = 1 - e.materializeTimer / MATERIALIZE_DURATION;
        const shade = Math.round(90 + 60 * t);
        return `rgb(${shade},${shade},${shade})`;
    }

    function drawPurp(p) {
        if (p.materializing) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = greyForMaterializing(p);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
            return;
        }
        ctx.fillStyle = '#b77eff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#b77eff';
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.fillStyle = '#ffaaff';
        ctx.fillRect(p.x - p.size / 4, p.y - p.size / 4, p.size / 2, p.size / 2);
        ctx.shadowBlur = 0;
    }

    function drawRedst(r) {
        if (r.materializing) {
            ctx.save();
            ctx.translate(r.x, r.y);
            ctx.rotate(r.rotation);
            ctx.fillStyle = greyForMaterializing(r);
            ctx.fillRect(-r.size / 2, -r.size / 2, r.size, r.size);
            ctx.restore();
            return;
        }
        if (r.state === 'aiming') {
            ctx.beginPath();
            ctx.moveTo(r.x, r.y);
            ctx.lineTo(r.targetX, r.targetY);
            ctx.strokeStyle = r.hostile
                ? `rgba(255,60,60,${0.55 + Math.sin(Date.now() * 0.015) * 0.3})`
                : `rgba(255,0,0,${0.4 + Math.sin(Date.now() * 0.01) * 0.25})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([7, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ff6666';
        } else {
            ctx.fillStyle = '#ff3300';
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'red';
        }
        ctx.fillRect(r.x - r.size / 2, r.y - r.size / 2, r.size, r.size);
        ctx.shadowBlur = 0;
    }

    function drawPepe(p) {
        if (p.materializing) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = greyForMaterializing(p);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
            return;
        }
        ctx.fillStyle = '#ffcc66';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffaa33';
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.fillStyle = '#ffe6b3';
        ctx.fillRect(p.x - p.size / 4, p.y - p.size / 4, p.size / 2, p.size / 2);
        ctx.shadowBlur = 0;
    }

    function drawBerserker(b) {
        if (b.materializing) {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rotation);
            ctx.fillStyle = greyForMaterializing(b);
            ctx.beginPath();
            ctx.moveTo(0, -b.size / 2);
            ctx.lineTo(b.size / 2, 0);
            ctx.lineTo(0, b.size / 2);
            ctx.lineTo(-b.size / 2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            return;
        }

        const blinkSpeed = 0.04 + (BERSERKER_MAX_HP - b.hp) * 0.05 + (b.hitFlash > 0 ? 0.25 : 0);
        const blink = 0.5 + 0.5 * Math.sin(b.blinkTimer * blinkSpeed);
        const cr = Math.round(BASE_COLOR.r + (BLINK_COLOR.r - BASE_COLOR.r) * blink);
        const cg = Math.round(BASE_COLOR.g + (BLINK_COLOR.g - BASE_COLOR.g) * blink);
        const cb = Math.round(BASE_COLOR.b + (BLINK_COLOR.b - BASE_COLOR.b) * blink);

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rotation);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.shadowBlur = 6 + 5 * blink;
        ctx.shadowColor = '#ff3300';
        ctx.beginPath();
        ctx.moveTo(0, -b.size / 2);
        ctx.lineTo(b.size / 2, 0);
        ctx.lineTo(0, b.size / 2);
        ctx.lineTo(-b.size / 2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,${180 + Math.round(50 * blink)},0.9)`;
        ctx.beginPath();
        ctx.arc(0, 0, b.size / 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        for (const p of purps) drawPurp(p);
        for (const p of pepes) drawPepe(p);
        for (const b of berserkers) drawBerserker(b);
        for (const r of redsts) drawRedst(r);
    }

    // ============================================================
    // LOOP DE ANIMACIÓN
    // ============================================================

    function loop() {
        if (!running) return;
        step();
        draw();
        rafId = requestAnimationFrame(loop);
    }

    // ============================================================
    // TAMAÑO DEL CANVAS (sigue el tamaño real de la caja #pecera)
    // ============================================================

    function resize() {
        if (!container || !canvas) return;
        const rect = container.getBoundingClientRect();
        // Si la ventana de Cartas está cerrada, #pecera queda con tamaño 0
        // (display: none en un ancestro). Ignoramos ese "resize" fantasma:
        // si no, se reescalaría todo hacia 0 al cerrar y, al reabrir, se
        // volvería a reescalar desde ese 0 hacia el tamaño real, mandando
        // a los enemigos lejísimos y dejándolos pegados contra una esquina
        // al hacer bounceEdges.
        if (rect.width === 0 || rect.height === 0) return;
        const newW = Math.max(1, Math.round(rect.width));
        const newH = Math.max(1, Math.round(rect.height));
        if (newW === W && newH === H) return;

        // reubica proporcionalmente lo que ya estaba adentro para que no
        // quede nada fuera de la caja al cambiar de tamaño (ej: rotar el celular)
        const scaleX = W > 0 ? newW / W : 1;
        const scaleY = H > 0 ? newH / H : 1;
        [...purps, ...redsts, ...pepes, ...berserkers].forEach(e => {
            e.x *= scaleX; e.y *= scaleY;
        });

        W = newW; H = newH;
        canvas.width = W;
        canvas.height = H;
    }

    // ============================================================
    // MOUSE (para despertar a los Berserkers)
    // ============================================================

    function onMouseMove(ev) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ev.clientX - rect.left;
        mouse.y = ev.clientY - rect.top;
    }

    function onMouseLeave() {
        mouse.x = -9999;
        mouse.y = -9999;
    }

    // ============================================================
    // CONFIGURACIÓN
    // ============================================================

    function clearAll() {
        purps = []; redsts = []; pepes = []; berserkers = [];
        constantSpawners = [];
    }

    function setConfig(config) {
        clearAll();
        if (!config) return;
        (config.inicial || []).forEach(spec => {
            if (spec && spec.type) spawnAt(spec.type, spec.x || 0, spec.y || 0, spec);
        });
        (config.constante || []).forEach(spec => {
            if (!spec || !spec.type) return;
            constantSpawners.push({
                type: spec.type,
                edge: spec.edge || 'random',
                every: spec.every || 240,
                jitter: spec.jitter || 0,
                timer: spec.every || 240,
                extra: spec
            });
        });
    }

    // ============================================================
    // API PÚBLICA
    // ============================================================

    function init(peceraDiv) {
        if (canvas) return; // ya inicializado
        container = peceraDiv;
        canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        container.appendChild(canvas);
        ctx = canvas.getContext('2d');

        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
        resize();

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseleave', onMouseLeave);
    }

    function start() {
        if (running) return;
        running = true;
        rafId = requestAnimationFrame(loop);
    }

    function stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    function destroy() {
        stop();
        clearAll();
        if (resizeObserver) resizeObserver.disconnect();
        if (canvas) {
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.remove();
        }
        canvas = null; ctx = null; container = null;
    }

    window.Pecera = { init, start, stop, destroy, setConfig, spawnAt };

    // ============================================================
    // CONFIG DE EJEMPLO — sirve para probar el sistema completo ya mismo.
    // Cuando cada carta tenga su propia pecera, agrega más entradas acá
    // usando el id de la carta como key (ver nota arriba del archivo).
    // ============================================================

    window.PECERA_CONFIGS = {
        // Se usa si una carta no tiene config propia (o para probar el sistema suelto).
        default: {
            inicial: [
                { type: 'purp', x: 40, y: 30 },
                { type: 'purp', x: 90, y: 90 },
                { type: 'pepe', x: 200, y: 50 },
                { type: 'redst', x: 320, y: 40 },
                { type: 'berserker', x: 260, y: 100 }
            ],
            constante: [
                { type: 'purp', edge: 'random', every: 260, jitter: 60 },
                { type: 'pepe', edge: 'random', every: 340, jitter: 80 },
                { type: 'redst', edge: 'random', every: 420, jitter: 100 }
            ]
        },

        // carta001: solo 5 Purps y 2 Redsts, nada más entra nunca.
        carta001: {
            inicial: [
                { type: 'purp', x: 40, y: 35 },
                { type: 'purp', x: 130, y: 105 },
                { type: 'purp', x: 240, y: 45 },
                { type: 'purp', x: 350, y: 100 },
                { type: 'purp', x: 460, y: 40 },
                { type: 'redst', x: 90, y: 85 },
                { type: 'redst', x: 410, y: 75 }
            ]
        },

        // carta002: 1 Berserker de entrada, y un Redst nuevo cada ~2s por cualquier borde.
        carta002: {
            inicial: [
                { type: 'berserker', x: 260, y: 75 }
            ],
            constante: [
                { type: 'redst', edge: 'random', every: 120 }
            ]
        },

        // carta003: 4 Pepes normales conviviendo con 1 Berserker.
        carta003: {
            inicial: [
                { type: 'pepe', x: 60, y: 35 },
                { type: 'pepe', x: 160, y: 110 },
                { type: 'pepe', x: 340, y: 40 },
                { type: 'pepe', x: 460, y: 105 },
                { type: 'berserker', x: 260, y: 75 }
            ]
        },

        // carta004: 2 Berserkers que se odian entre sí (rival:true) y se
        // agarran a golpes cada tanto, más 4 Pepes de fondo sin hacer nada raro.
        carta004: {
            inicial: [
                { type: 'berserker', x: 120, y: 75, rival: true },
                { type: 'berserker', x: 400, y: 75, rival: true },
                { type: 'pepe', x: 60, y: 35 },
                { type: 'pepe', x: 200, y: 115 },
                { type: 'pepe', x: 320, y: 35 },
                { type: 'pepe', x: 460, y: 115 }
            ]
        },

        // carta005: nada más que un Berserker solo, flotando.
        carta005: {
            inicial: [
                { type: 'berserker', x: 260, y: 75 }
            ]
        }
    };
})();
