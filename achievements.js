/* ============================================================================
   BulletDasher — achievements.js
   Motor de progreso/desbloqueo REAL de logros. Es un módulo aparte de
   cosmetics.js: cosmetics.js sabe DIBUJAR las recompensas y guardar qué
   está EQUIPADO; achievements.js sabe qué logros están REALMENTE
   conseguidos, en qué modos se pueden conseguir, y guarda ese progreso.

   cosmetics.js sigue siendo la fuente de verdad de qué recompensa
   corresponde a cada logro (getRewardByAchievement) y de cómo dibujarla.
   Este archivo no duplica esos datos, solo los consulta cuando hace falta
   (ej. para el nombre de la recompensa en el toast de desbloqueo).

   Cargar este script DESPUÉS de cosmetics.js en cada página.
   ============================================================================ */
(function (global) {
    'use strict';

    // ------------------------------------------------------------------
    // METADATA: en qué modos se puede conseguir cada logro, y si ya está
    // implementado. Los logros con implemented:false quedan SIEMPRE
    // bloqueados por ahora, sin importar lo que haga el jugador — es la
    // forma de "dejarlos full bloqueados" hasta que se programen.
    // ------------------------------------------------------------------
    const MODES = { CLASSIC: 'classic', METRO: 'metro', SQUASTEROIDS: 'squasteroids', PRACTICE: 'practice' };

    const ACHIEVEMENTS_META = {
        'classical-music':   { implemented: true,  modes: [MODES.CLASSIC] },
        'ambient-music':     { implemented: true,  modes: [MODES.METRO] },
        'space-music':       { implemented: true,  modes: [MODES.SQUASTEROIDS] },
        'sniper-of-snipers': { implemented: true,  modes: [MODES.CLASSIC, MODES.METRO] },
        'short-distance':    { implemented: true,  modes: [MODES.CLASSIC, MODES.METRO] },
        'holy-frame':        { implemented: true,  modes: [MODES.CLASSIC, MODES.METRO] },
        'no-euclidian':      { implemented: true,  modes: [MODES.SQUASTEROIDS] },
        'dashing-engineer':  { implemented: true,  modes: [MODES.PRACTICE] },
        'i-choose-death':    { implemented: true,  modes: [MODES.SQUASTEROIDS] },
        'dash-god':          { implemented: true,  modes: [MODES.CLASSIC, MODES.METRO, MODES.SQUASTEROIDS] },
        'too-slow':          { implemented: true,  modes: [MODES.CLASSIC, MODES.METRO] },
        'subway-jerk':       { implemented: true,  modes: [MODES.METRO] },
        'yujiro-hanma':      { implemented: true,  modes: [MODES.CLASSIC] },
        'purpnocide':        { implemented: true,  modes: [MODES.CLASSIC, MODES.METRO, MODES.SQUASTEROIDS] }
    };

    const ACHIEVEMENT_LABELS = {
        'classical-music': 'Classical Music',
        'ambient-music': 'Ambient Music',
        'space-music': 'Space Music',
        'sniper-of-snipers': 'SniperOfSnipers',
        'short-distance': 'ShortDistance',
        'holy-frame': '¡Holy Frame!',
        'no-euclidian': 'No Euclidian hehehe',
        'dashing-engineer': 'Dashing Engineer',
        'i-choose-death': 'i choose DEATH!',
        'dash-god': 'Dash God',
        'too-slow': 'Too Slow!',
        'subway-jerk': 'Subway jerk',
        'yujiro-hanma': 'Yujiro Hanma',
        'purpnocide': 'Purpnocide'
    };
    function achievementLabel(id) {
        return ACHIEVEMENT_LABELS[id] || id;
    }

    const UNLOCK_STORAGE_KEY = 'bulletdasher_unlocked_v1';

    function loadUnlocked() {
        try {
            const raw = localStorage.getItem(UNLOCK_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }
    function saveUnlocked() {
        try { localStorage.setItem(UNLOCK_STORAGE_KEY, JSON.stringify(unlocked)); } catch (e) { /* ignorar */ }
    }
    let unlocked = loadUnlocked();

    function isImplemented(achievementId) {
        const meta = ACHIEVEMENTS_META[achievementId];
        return !!(meta && meta.implemented);
    }
    function isUnlocked(achievementId) {
        return unlocked.indexOf(achievementId) !== -1;
    }
    function getUnlocked() {
        return unlocked.slice();
    }
    function isValidInMode(achievementId, modeName) {
        const meta = ACHIEVEMENTS_META[achievementId];
        return !!(meta && meta.modes.indexOf(modeName) !== -1);
    }

    // Intenta desbloquear un logro. Devuelve true solo si efectivamente lo
    // desbloqueó ahora mismo. Falla en silencio (false) si el logro no
    // existe, no está implementado todavía, no se puede conseguir en este
    // modo, o ya estaba desbloqueado de antes — así los hooks de cada modo
    // pueden llamarlo sin preocuparse por checkear nada de eso ellos mismos.
    function tryUnlock(achievementId, modeName) {
        if (!isImplemented(achievementId)) return false;
        if (!isValidInMode(achievementId, modeName)) return false;
        if (isUnlocked(achievementId)) return false;
        unlocked.push(achievementId);
        saveUnlocked();
        showUnlockToast(achievementId);
        return true;
    }

    // ------------------------------------------------------------------
    // TOAST visual de "logro desbloqueado". Vive acá (no en cada modo) para
    // que todas las páginas del juego lo muestren igual sin tener que tocar
    // su propio HTML/canvas.
    // ------------------------------------------------------------------
    let toastStyleInjected = false;
    function injectToastStyle() {
        if (toastStyleInjected) return;
        toastStyleInjected = true;
        const style = document.createElement('style');
        style.textContent =
            '#achToastContainer{position:fixed;top:16px;left:50%;transform:translateX(-50%);' +
            'z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;align-items:center;}' +
            '.ach-toast{font-family:monospace;background:rgba(10,10,10,0.92);border:2px solid #ffcc00;' +
            'color:#ffd94d;padding:10px 18px;border-radius:6px;box-shadow:0 0 18px rgba(255,200,0,0.7);' +
            'text-align:center;font-size:13px;letter-spacing:0.5px;opacity:0;transform:translateY(-10px);' +
            'transition:opacity 0.35s ease, transform 0.35s ease;}' +
            '.ach-toast.show{opacity:1;transform:translateY(0);}' +
            '.ach-toast .ach-toast-title{font-size:10px;opacity:0.8;margin-bottom:2px;}' +
            '.ach-toast .ach-toast-name{font-size:15px;font-weight:bold;text-shadow:0 0 8px #ffcc00;}';
        document.head.appendChild(style);
    }
    function getToastContainer() {
        let el = document.getElementById('achToastContainer');
        if (!el) {
            el = document.createElement('div');
            el.id = 'achToastContainer';
            document.body.appendChild(el);
        }
        return el;
    }
    function showUnlockToast(achievementId) {
        try {
            injectToastStyle();
            const container = getToastContainer();
            const toast = document.createElement('div');
            toast.className = 'ach-toast';
            toast.innerHTML = '<div class="ach-toast-title">🏆 LOGRO DESBLOQUEADO</div>' +
                '<div class="ach-toast-name">' + achievementLabel(achievementId) + '</div>';
            container.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('show'));
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 400);
            }, 3200);
        } catch (e) { /* nunca dejar que un fallo visual rompa el juego */ }
    }

    // ------------------------------------------------------------------
    // Helper: detectar cuándo una música con loop=true completó una vuelta
    // completa (el audio no dispara 'ended' porque hace loop solo).
    // Devuelve un controlador con .reset(), que el modo DEBE llamar cada vez
    // que él mismo reinicie manualmente currentTime a 0 (ej. al reiniciar
    // partida), para no confundir eso con una vuelta real de la canción.
    // ------------------------------------------------------------------
    function watchMusicLoop(audio, achievementId, modeName, onLoop) {
        let lastTime = 0;
        let armed = false; // recién se arma una vez que la canción ya avanzó un toque
        function onTimeUpdate() {
            const t = audio.currentTime;
            if (armed && t < lastTime - 1) {
                tryUnlock(achievementId, modeName);
                // onLoop se llama SIEMPRE que se detecta una vuelta completa, sin importar
                // si el logro de arriba se pudo desbloquear o no (ej. ya estaba desbloqueado).
                // Sirve para lógica extra que depende de "la canción completó un loop",
                // como Dash God (sobrevivir sin daño hasta que termine la canción).
                if (typeof onLoop === 'function') onLoop();
            }
            armed = t > 0.5;
            lastTime = t;
        }
        audio.addEventListener('timeupdate', onTimeUpdate);
        return {
            reset() { lastTime = 0; armed = false; }
        };
    }

    global.Achievements = {
        MODES,
        isImplemented, isUnlocked, isValidInMode, getUnlocked,
        tryUnlock, watchMusicLoop, achievementLabel
    };

})(window);
