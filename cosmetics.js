/* ============================================================================
   BulletDasher — cosmetics.js
   Motor compartido de mascotas / cosméticos / skins desbloqueables por logro.

   Por qué los datos están embebidos aquí (y no vía fetch('rewards.json')):
   el juego se abre normalmente como archivo local (file://), y fetch() de un
   .json externo se bloquea por CORS en ese caso. rewards.json existe como
   documentación / fuente de verdad legible, pero en runtime se usa la copia
   de abajo (REWARDS_DATA), que es exactamente el mismo contenido.

   NOTA sobre localStorage: por ahora SOLO se usa para recordar qué mascota /
   cosmético / skin tenés equipado (para que index.html y los modos de juego
   se pongan de acuerdo). El sistema de progreso/desbloqueo de logros en sí
   (qué lograste, contadores, etc.) todavía NO vive acá — eso es la siguiente
   etapa. Mientras tanto, todas las recompensas están disponibles para
   equipar, a modo de banco de pruebas visual.
   ============================================================================ */
(function (global) {
    'use strict';

    // ---------------------------------------------------------------------
    // DATOS (copia embebida de rewards.json)
    // ---------------------------------------------------------------------
    const REWARDS_DATA = {
        equipLimits: { cosmetic: 1, mascot: 3, skin: null },
        rewards: [
            { achievementId: "classical-music", rewardId: "mascot-purp", type: "mascot", name: "Purpcito",
              visual: { kind: "square-duo", outerColor: "#b77eff", innerColor: "#ffaaff", sizePx: 8, orbitRadiusPx: 30, orbitSpeed: 1 } },
            { achievementId: "ambient-music", rewardId: "mascot-pepe", type: "mascot", name: "Pepecito",
              visual: { kind: "square-duo", outerColor: "#ffcc66", innerColor: "#ffe6b3", sizePx: 9, orbitRadiusPx: 32, orbitSpeed: 1 } },
            { achievementId: "space-music", rewardId: "mascot-berserker", type: "mascot", name: "Brskrcito",
              visual: { kind: "diamond-spin", baseColor: [255,95,40], blinkColor: [255,15,15], coreColor: [255,255,200], sizePx: 9, orbitRadiusPx: 34, orbitSpeed: 1, spinSpeed: 0.12 } },
            { achievementId: "sniper-of-snipers", rewardId: "mascot-redst", type: "mascot", name: "Redstcito",
              visual: { kind: "square-glow", color: "#ff3300", glowColor: "red", sizePx: 6, orbitRadiusPx: 26, orbitSpeed: 2.4 } },
            { achievementId: "short-distance", rewardId: "skin-redst-trail", type: "skin", name: "Rastro Redst", unique: false,
              visual: { kind: "dash-trail-segmented", colorSource: "mode-dash-color", dashPattern: [10,8], lineWidth: 6, glowBlur: 10 } },
            { achievementId: "holy-frame", rewardId: "mascot-extincion", type: "mascot", name: "Zona Segura",
              visual: { kind: "circle-transparent", fillColor: "rgba(255,255,200,0.4)", strokeColor: "#ffff00", sizePx: 10, orbitRadiusPx: 28, orbitSpeed: 0.7 } },
            { achievementId: "no-euclidian", rewardId: "cosmetic-cigarette", type: "cosmetic", name: "Cigarrito",
              visual: { kind: "emoji-attached", emoji: "🚬", position: "left", fontSizePx: 14, rotationDeg: -20, offsetPx: { x: -12, y: 2 } } },
            { achievementId: "dashing-engineer", rewardId: "cosmetic-helmet", type: "cosmetic", name: "Casco de Ingeniero",
              visual: { kind: "emoji-attached", emoji: "⛑️", position: "top", fontSizePx: 16, rotationDeg: 0, offsetPx: { x: 0, y: -14 } } },
            { achievementId: "i-choose-death", rewardId: "mascot-moai", type: "mascot", name: "Moai",
              visual: { kind: "emoji", emoji: "🗿", fontSizePx: 16, orbitRadiusPx: 30, orbitSpeed: 1 } },
            { achievementId: "dash-god", rewardId: "skin-border-glow", type: "skin", name: "Aura de Dash", unique: true,
              visual: { kind: "canvas-border-glow", colorSource: "mode-dash-color", fadeFrames: 26, maxBlur: 40 } },
            { achievementId: "too-slow", rewardId: "skin-hit-rings", type: "skin", name: "Anillos Perdidos", unique: true,
              visual: { kind: "hit-particles", emoji: "💍", minCount: 6, maxCount: 10, fontSizePx: 12, gravity: 0.35, lifeFrames: 70, fadeFrames: 15 } },
            { achievementId: "subway-jerk", rewardId: "cosmetic-cap", type: "cosmetic", name: "Gorrita",
              visual: { kind: "emoji-attached", emoji: "🧢", position: "top", fontSizePx: 15, rotationDeg: 0, offsetPx: { x: 0, y: -13 } } },
            { achievementId: "yujiro-hanma", rewardId: "cosmetic-arms", type: "cosmetic", name: "Brazos de Ogro",
              visual: { kind: "emoji-arms", emoji: "💪", fontSizePx: 13, offsetPx: { x: 13, y: 2 } } },
            { achievementId: "purpnocide", rewardId: "skin-purp-recolor", type: "skin", name: "Purpsrker", unique: true,
              visual: { kind: "purp-recolor", outerColor: "rgb(255,95,40)", innerColor: "rgb(255,170,90)" } }
        ]
    };

    const EQUIP_STORAGE_KEY = 'bulletdasher_equipped_v1';

    // ---------------------------------------------------------------------
    // ESTADO DE EQUIPAMIENTO (localStorage — ver nota arriba)
    // ---------------------------------------------------------------------
    function loadEquipped() {
        try {
            const raw = localStorage.getItem(EQUIP_STORAGE_KEY);
            if (!raw) return { cosmetic: null, mascots: [], skins: [] };
            const parsed = JSON.parse(raw);
            return {
                cosmetic: parsed.cosmetic || null,
                mascots: Array.isArray(parsed.mascots) ? parsed.mascots.slice(0, REWARDS_DATA.equipLimits.mascot) : [],
                skins: Array.isArray(parsed.skins) ? parsed.skins : []
            };
        } catch (e) {
            return { cosmetic: null, mascots: [], skins: [] };
        }
    }
    function saveEquipped() {
        try { localStorage.setItem(EQUIP_STORAGE_KEY, JSON.stringify(equipped)); } catch (e) { /* ignorar */ }
    }
    let equipped = loadEquipped();

    function getRewardById(rewardId) {
        return REWARDS_DATA.rewards.find(r => r.rewardId === rewardId) || null;
    }
    function getRewardByAchievement(achId) {
        return REWARDS_DATA.rewards.find(r => r.achievementId === achId) || null;
    }
    function isEquipped(rewardId) {
        const r = getRewardById(rewardId);
        if (!r) return false;
        if (r.type === 'cosmetic') return equipped.cosmetic === rewardId;
        if (r.type === 'mascot') return equipped.mascots.indexOf(rewardId) !== -1;
        if (r.type === 'skin') return equipped.skins.indexOf(rewardId) !== -1;
        return false;
    }
    // Alterna equipar/desequipar. Devuelve {ok, reason}
    function toggleEquip(rewardId) {
        const r = getRewardById(rewardId);
        if (!r) return { ok: false, reason: 'not-found' };
        if (r.type === 'cosmetic') {
            equipped.cosmetic = (equipped.cosmetic === rewardId) ? null : rewardId;
        } else if (r.type === 'mascot') {
            const idx = equipped.mascots.indexOf(rewardId);
            if (idx >= 0) {
                equipped.mascots.splice(idx, 1);
            } else {
                if (equipped.mascots.length >= REWARDS_DATA.equipLimits.mascot) {
                    return { ok: false, reason: 'limit-mascot' };
                }
                equipped.mascots.push(rewardId);
            }
        } else if (r.type === 'skin') {
            const idx = equipped.skins.indexOf(rewardId);
            if (idx >= 0) equipped.skins.splice(idx, 1);
            else equipped.skins.push(rewardId);
        }
        saveEquipped();
        return { ok: true, reason: null };
    }
    function getEquipped() {
        return { cosmetic: equipped.cosmetic, mascots: equipped.mascots.slice(), skins: equipped.skins.slice() };
    }
    function hasSkin(rewardId) {
        return equipped.skins.indexOf(rewardId) !== -1;
    }
    function getEquipLimits() {
        return Object.assign({}, REWARDS_DATA.equipLimits);
    }

    // ---------------------------------------------------------------------
    // DIBUJO GENÉRICO DE UN "VISUAL" CENTRADO EN (x, y)
    // Se usa tanto para los iconitos del panel de logros como (con otro
    // tamaño/contexto) para el juego en sí.
    // ---------------------------------------------------------------------
    function drawVisualAt(ctx, reward, x, y, frame, opts) {
        opts = opts || {};
        const v = reward.visual;
        ctx.save();
        switch (v.kind) {
            case 'square-duo': {
                const s = opts.sizeOverride || v.sizePx;
                ctx.shadowBlur = 5; ctx.shadowColor = v.outerColor;
                ctx.fillStyle = v.outerColor;
                ctx.fillRect(x - s / 2, y - s / 2, s, s);
                ctx.shadowBlur = 0;
                ctx.fillStyle = v.innerColor;
                ctx.fillRect(x - s / 4, y - s / 4, s / 2, s / 2);
                break;
            }
            case 'square-glow': {
                const s = opts.sizeOverride || v.sizePx;
                ctx.shadowBlur = 8; ctx.shadowColor = v.glowColor;
                ctx.fillStyle = v.color;
                ctx.fillRect(x - s / 2, y - s / 2, s, s);
                break;
            }
            case 'diamond-spin': {
                const s = opts.sizeOverride || v.sizePx;
                const rot = frame * v.spinSpeed;
                const blink = 0.5 + 0.5 * Math.sin(frame * 0.15);
                const c = v.baseColor.map((b, i) => Math.round(b + (v.blinkColor[i] - b) * blink));
                ctx.translate(x, y);
                ctx.rotate(rot);
                ctx.shadowBlur = 8; ctx.shadowColor = '#ff3300';
                ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
                ctx.beginPath();
                ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(0, s / 2); ctx.lineTo(-s / 2, 0);
                ctx.closePath(); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.fillStyle = `rgb(${v.coreColor[0]},${v.coreColor[1]},${v.coreColor[2]})`;
                ctx.beginPath(); ctx.arc(0, 0, s / 5, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case 'circle-transparent': {
                const s = opts.sizeOverride || v.sizePx;
                ctx.beginPath();
                ctx.arc(x, y, s / 2, 0, Math.PI * 2);
                ctx.fillStyle = v.fillColor;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = v.strokeColor;
                ctx.stroke();
                break;
            }
            case 'emoji': {
                const fs = opts.sizeOverride || v.fontSizePx;
                ctx.font = fs + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(v.emoji, x, y);
                break;
            }
            case 'emoji-attached': {
                const fs = opts.sizeOverride || v.fontSizePx;
                ctx.translate(x, y);
                if (v.rotationDeg) ctx.rotate(v.rotationDeg * Math.PI / 180);
                ctx.font = fs + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(v.emoji, 0, 0);
                break;
            }
            case 'emoji-arms': {
                const fs = opts.sizeOverride || v.fontSizePx;
                ctx.font = fs + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(v.emoji, x, y);
                break;
            }
            case 'dash-trail-segmented': {
                const color = opts.color || '#a0a0a0';
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.shadowBlur = 6; ctx.shadowColor = color;
                ctx.setLineDash((v.dashPattern || [10, 8]).map(n => n * 0.5));
                ctx.beginPath();
                ctx.moveTo(x - 12, y + 10); ctx.lineTo(x + 12, y - 10);
                ctx.stroke();
                ctx.setLineDash([]);
                break;
            }
            case 'canvas-border-glow': {
                const color = opts.color || '#00ffff';
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.shadowBlur = 10; ctx.shadowColor = color;
                ctx.strokeRect(x - 16, y - 14, 32, 28);
                break;
            }
            case 'hit-particles': {
                const fs = opts.sizeOverride || 16;
                ctx.font = fs + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(v.emoji, x, y);
                break;
            }
            case 'purp-recolor': {
                const s = opts.sizeOverride || 20;
                ctx.shadowBlur = 5; ctx.shadowColor = v.outerColor;
                ctx.fillStyle = v.outerColor;
                ctx.fillRect(x - s / 2, y - s / 2, s, s);
                ctx.shadowBlur = 0;
                ctx.fillStyle = v.innerColor;
                ctx.fillRect(x - s / 4, y - s / 4, s / 2, s / 2);
                break;
            }
        }
        ctx.restore();
        ctx.shadowBlur = 0;
    }

    // ---------------------------------------------------------------------
    // ICONOS DEL PANEL DE LOGROS (index.html)
    // ---------------------------------------------------------------------
    function renderAchievementIcon(canvas, achievementId) {
        const reward = getRewardByAchievement(achievementId);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!reward) return;
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const frame = Date.now() / 16.67;
        let opts = { sizeOverride: 20 };
        if (reward.visual.kind === 'dash-trail-segmented') opts.color = '#00e5ff';
        if (reward.visual.kind === 'canvas-border-glow') opts.color = '#00e5ff';
        drawVisualAt(ctx, reward, cx, cy, frame, opts);
    }

    // Loop de animación liviano para refrescar los iconitos con mascotas
    // animadas (diamond-spin, etc.) dentro del panel de logros.
    let iconAnimCanvases = [];
    let iconAnimHandle = null;
    function startIconAnimation() {
        if (iconAnimHandle) return;
        function tick() {
            for (const { canvas, achievementId } of iconAnimCanvases) {
                renderAchievementIcon(canvas, achievementId);
            }
            iconAnimHandle = requestAnimationFrame(tick);
        }
        iconAnimHandle = requestAnimationFrame(tick);
    }
    function registerIconCanvas(canvas, achievementId) {
        iconAnimCanvases.push({ canvas, achievementId });
        startIconAnimation();
    }

    // ---------------------------------------------------------------------
    // RENDER EN JUEGO: mascotas orbitando + cosmético pegado al jugador
    // ---------------------------------------------------------------------
    let internalFrame = 0;

    function drawMascots(ctx, px, py, playerSize) {
        const mascotIds = equipped.mascots;
        const n = mascotIds.length;
        if (n === 0) return;
        for (let i = 0; i < n; i++) {
            const reward = getRewardById(mascotIds[i]);
            if (!reward) continue;
            const v = reward.visual;
            const angle = internalFrame * 0.03 * v.orbitSpeed + (i * (Math.PI * 2 / 3));
            const radius = playerSize / 2 + v.orbitRadiusPx;
            const mx = px + Math.cos(angle) * radius;
            const my = py + Math.sin(angle) * radius * 0.6; // orbita ligeramente elíptica
            drawVisualAt(ctx, reward, mx, my, internalFrame, {});
        }
    }

    function drawCosmetic(ctx, px, py, playerSize) {
        if (!equipped.cosmetic) return;
        const reward = getRewardById(equipped.cosmetic);
        if (!reward) return;
        const v = reward.visual;
        if (v.kind === 'emoji-arms') {
            // Brazo izquierdo
            ctx.save();
            ctx.translate(px - playerSize / 2 - v.offsetPx.x + 8, py + v.offsetPx.y);
            ctx.font = v.fontSizePx + 'px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(v.emoji, 0, 0);
            ctx.restore();
            // Brazo derecho (espejado)
            ctx.save();
            ctx.translate(px + playerSize / 2 + v.offsetPx.x - 8, py + v.offsetPx.y);
            ctx.scale(-1, 1);
            ctx.font = v.fontSizePx + 'px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(v.emoji, 0, 0);
            ctx.restore();
        } else if (v.kind === 'emoji-attached') {
            drawVisualAt(ctx, reward, px + v.offsetPx.x, py + v.offsetPx.y, internalFrame, {});
        }
    }

    // ---------------------------------------------------------------------
    // SKIN 5: rastro de dash segmentado (color según el modo)
    // ---------------------------------------------------------------------
    function drawSegmentedDashTrail(ctx, dashTrail, colorHex) {
        if (!hasSkin('skin-redst-trail')) return false;
        const reward = getRewardById('skin-redst-trail');
        const v = reward.visual;
        ctx.beginPath();
        ctx.moveTo(dashTrail.x1, dashTrail.y1);
        ctx.lineTo(dashTrail.x2, dashTrail.y2);
        const intensity = 0.7 + Math.sin(Date.now() * 0.03) * 0.3;
        ctx.strokeStyle = colorHex;
        ctx.globalAlpha = intensity;
        ctx.lineWidth = v.lineWidth;
        ctx.shadowBlur = v.glowBlur;
        ctx.shadowColor = colorHex;
        ctx.setLineDash(v.dashPattern);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        return true; // avisa al modo que ya se dibujó el rastro (no dibujar el default)
    }

    // ---------------------------------------------------------------------
    // SKIN 10: aura en los bordes del canvas al dashear
    // ---------------------------------------------------------------------
    let borderGlow = { timer: 0, max: 1, color: '#00ffff' };
    function triggerDashBorderGlow(colorHex) {
        if (!hasSkin('skin-border-glow')) return;
        const v = getRewardById('skin-border-glow').visual;
        borderGlow.timer = v.fadeFrames;
        borderGlow.max = v.fadeFrames;
        borderGlow.color = colorHex;
    }
    function drawDashBorderGlow(ctx, canvas) {
        if (borderGlow.timer <= 0) return;
        const v = getRewardById('skin-border-glow').visual;
        const t = borderGlow.timer / borderGlow.max;
        ctx.save();
        ctx.strokeStyle = borderGlow.color;
        ctx.lineWidth = 6;
        ctx.shadowBlur = v.maxBlur * t;
        ctx.shadowColor = borderGlow.color;
        ctx.globalAlpha = t;
        ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
        ctx.restore();
    }

    // ---------------------------------------------------------------------
    // SKIN 11: anillos que caen al recibir daño
    // Versión liviana: sin rebote ni rotación — solo salen despedidos, la
    // gravedad los va curvando hacia abajo y se eliminan apenas salen de
    // pantalla (o se les acaba la vida, lo que pase primero). Cada anillo
    // es un objeto planísimo (x, y, vx, vy, life) y el dibujo no hace
    // save/restore/transform por partícula, para que cueste lo menos
    // posible incluso con varias tandas encimadas.
    // ---------------------------------------------------------------------
    let hitParticles = [];
    function onPlayerHit(x, y) {
        if (!hasSkin('skin-hit-rings')) return;
        const v = getRewardById('skin-hit-rings').visual;
        const count = v.minCount + Math.floor(Math.random() * (v.maxCount - v.minCount + 1));
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            hitParticles.push({
                x, y,
                vx: Math.cos(angle) * speed * 0.6,
                vy: Math.sin(angle) * speed - 2,
                life: v.lifeFrames
            });
        }
    }
    function updateHitParticles(canvasWidth, canvasHeight) {
        if (hitParticles.length === 0) return;
        const v = getRewardById('skin-hit-rings').visual;
        for (let i = hitParticles.length - 1; i >= 0; i--) {
            const p = hitParticles[i];
            p.vy += v.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            // se eliminan al salir de pantalla por abajo, o si se les acaba
            // la vida antes de eso (ej. quedaron flotando cerca del golpe)
            if (p.life <= 0 || p.y > canvasHeight + 20) hitParticles.splice(i, 1);
        }
    }
    function drawHitParticles(ctx) {
        if (hitParticles.length === 0) return;
        const v = getRewardById('skin-hit-rings').visual;
        const fadeFrames = v.fadeFrames || 15;
        ctx.save();
        ctx.font = v.fontSizePx + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const p of hitParticles) {
            ctx.globalAlpha = p.life < fadeFrames ? Math.max(0.1, p.life / fadeFrames) : 1;
            ctx.fillText(v.emoji, p.x, p.y);
        }
        ctx.restore();
    }

    // ---------------------------------------------------------------------
    // SKIN 14: recolor de Purps
    // ---------------------------------------------------------------------
    function getPurpColors(defaultOuter, defaultInner) {
        if (!hasSkin('skin-purp-recolor')) return { outer: defaultOuter, inner: defaultInner };
        const v = getRewardById('skin-purp-recolor').visual;
        return { outer: v.outerColor, inner: v.innerColor };
    }

    // ---------------------------------------------------------------------
    // LOOP GENERAL — llamar una vez por frame de juego (en update())
    // ---------------------------------------------------------------------
    function updateEffects(canvasWidth, canvasHeight) {
        internalFrame++;
        if (borderGlow.timer > 0) borderGlow.timer--;
        updateHitParticles(canvasWidth || 0, canvasHeight || 0);
    }

    function resetEffects() {
        hitParticles = [];
        borderGlow.timer = 0;
    }

    // ---------------------------------------------------------------------
    // API PÚBLICA
    // ---------------------------------------------------------------------
    global.Cosmetics = {
        data: REWARDS_DATA,
        getRewardById, getRewardByAchievement,
        isEquipped, toggleEquip, getEquipped, getEquipLimits, hasSkin,
        renderAchievementIcon, registerIconCanvas,
        drawMascots, drawCosmetic,
        drawSegmentedDashTrail, triggerDashBorderGlow, drawDashBorderGlow,
        onPlayerHit, drawHitParticles,
        getPurpColors,
        updateEffects, resetEffects
    };

})(window);
