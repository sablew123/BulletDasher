/* ============================================================
   BulletDasher — Puntajes máximos (con datos de la partida)
   ------------------------------------------------------------
   Ahora cada modo guarda, junto a su mejor puntaje, los datos
   de ESA partida concreta (no los mejores de cada dato):

     - timeFrames  : duración de la partida, en frames (60 = 1s)
     - extinctions : extinciones sobrevividas (Classic / Metro)
     - berserkers  : Berserkers derrotados mano a mano (Squasteroids)
     - cycles      : ciclos completados (Inferno)
     - livesLost   : vidas perdidas
     - livesHealed : vidas recuperadas

   Formato guardado en localStorage:
     { classic: { score: 1234, stats: {...}, date: 1700000000000 }, ... }
   ============================================================ */
(function (global) {
    const STORAGE_KEY = 'bulletdasher.highscores.v2';
    const LEGACY_KEYS = ['bulletdasher.highscores', 'bulletDasherScores', 'highscores', 'bulletdasher_scores'];
    const MODES = ['classic', 'metro', 'squasteroids', 'inferno'];

    const EMPTY_STATS = {
        timeFrames: 0,
        extinctions: 0,
        berserkers: 0,
        cycles: 0,
        livesLost: 0,
        livesHealed: 0
    };

    function toInt(value) {
        const n = Math.floor(Number(value));
        return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function normalizeStats(stats) {
        const src = (stats && typeof stats === 'object') ? stats : {};
        const out = {};
        for (const key of Object.keys(EMPTY_STATS)) out[key] = toInt(src[key]);
        return out;
    }

    // Acepta tanto el formato nuevo ({score, stats}) como el viejo (un número pelado)
    function normalizeEntry(raw) {
        if (typeof raw === 'number' && Number.isFinite(raw)) {
            return { score: Math.max(0, Math.floor(raw)), stats: { ...EMPTY_STATS }, date: null };
        }
        if (raw && typeof raw === 'object' && typeof raw.score === 'number' && Number.isFinite(raw.score)) {
            return {
                score: Math.max(0, Math.floor(raw.score)),
                stats: normalizeStats(raw.stats),
                date: typeof raw.date === 'number' ? raw.date : null
            };
        }
        return null;
    }

    function readRaw(key) {
        try {
            const txt = localStorage.getItem(key);
            if (!txt) return null;
            const parsed = JSON.parse(txt);
            return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    // Lee el archivo nuevo; si no existe, migra lo que hubiera guardado antes
    // (los puntajes viejos quedan con sus datos en 0, no se inventa nada).
    function load() {
        let raw = readRaw(STORAGE_KEY);
        if (!raw) {
            for (const legacyKey of LEGACY_KEYS) {
                const legacy = readRaw(legacyKey);
                if (legacy) { raw = legacy; break; }
            }
        }
        // Último recurso: buscar en todo el localStorage un objeto que se vea como
        // la tabla de puntajes vieja (claves de modos con números), sin importar
        // con qué nombre se haya guardado antes.
        if (!raw) {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const candidate = readRaw(localStorage.key(i));
                    if (!candidate || Array.isArray(candidate)) continue;
                    const keys = Object.keys(candidate);
                    if (!keys.length) continue;
                    if (keys.every(k => MODES.includes(k)) && keys.some(k => normalizeEntry(candidate[k]))) {
                        raw = candidate;
                        break;
                    }
                }
            } catch (e) { /* localStorage inaccesible */ }
        }
        const data = {};
        if (raw) {
            for (const mode of MODES) {
                const entry = normalizeEntry(raw[mode]);
                if (entry) data[mode] = entry;
            }
        }
        return data;
    }

    function persist(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* almacenamiento lleno o bloqueado: se ignora */ }
    }

    // save(modo, puntaje, datosDeLaPartida)
    // Solo sobrescribe si el puntaje es mayor al récord actual; cuando lo hace,
    // reemplaza TODOS los datos por los de esta partida.
    function save(mode, score, stats) {
        if (!MODES.includes(mode)) return false;
        const value = Math.max(0, Math.floor(Number(score) || 0));
        const data = load();
        const current = data[mode];
        if (current && value <= current.score) return false;
        data[mode] = { score: value, stats: normalizeStats(stats), date: Date.now() };
        persist(data);
        return true;
    }

    function getEntry(mode) {
        const data = load();
        return data[mode] || null;
    }

    function getAllEntries() {
        return load();
    }

    function get(mode) {
        const entry = getEntry(mode);
        return entry ? entry.score : null;
    }

    function getAll() {
        const data = load();
        const out = {};
        for (const mode of Object.keys(data)) out[mode] = data[mode].score;
        return out;
    }

    function getStats(mode) {
        const entry = getEntry(mode);
        return entry ? { ...entry.stats } : null;
    }

    // deleteMode(modo): borra únicamente el récord de ese modo, dejando los demás intactos
    function deleteMode(mode) {
        if (!MODES.includes(mode)) return false;
        const data = load();
        if (!(mode in data)) return false;
        delete data[mode];
        persist(data);
        return true;
    }

    function reset() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        for (const legacyKey of LEGACY_KEYS) {
            try { localStorage.removeItem(legacyKey); } catch (e) {}
        }
    }

    // Formatea frames (60 por segundo) como m:ss
    function formatTime(frames) {
        const totalSeconds = Math.floor(toInt(frames) / 60);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return minutes + ':' + String(seconds).padStart(2, '0');
    }

    global.BulletDasherScores = {
        MODES,
        EMPTY_STATS,
        save,
        get,
        getAll,
        getEntry,
        getAllEntries,
        getStats,
        formatTime,
        deleteMode,
        reset
    };
})(window);
