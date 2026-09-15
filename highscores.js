// ===== Puntajes máximos compartidos entre todos los modos =====
// Se guardan en localStorage bajo una sola clave, como un objeto
// { classic: n, metro: n, squasteroids: n, inferno: n }.
// Cada modo solo escribe su propia entrada, y solo si el puntaje
// nuevo es mayor al que ya había guardado.
window.BulletDasherScores = (function () {
    const KEY = 'bulletdasher_highscores';

    function getAll() {
        try {
            const raw = localStorage.getItem(KEY);
            const data = raw ? JSON.parse(raw) : {};
            return (data && typeof data === 'object') ? data : {};
        } catch (e) {
            return {};
        }
    }

    function get(mode) {
        const data = getAll();
        return typeof data[mode] === 'number' && isFinite(data[mode]) ? data[mode] : null;
    }

    // Guarda el puntaje si es mayor al máximo actual de ese modo.
    // Devuelve true si se actualizó el récord.
    function save(mode, value) {
        const v = Math.max(0, Math.floor(Number(value) || 0));
        try {
            const data = getAll();
            const current = typeof data[mode] === 'number' && isFinite(data[mode]) ? data[mode] : 0;
            if (v > current) {
                data[mode] = v;
                localStorage.setItem(KEY, JSON.stringify(data));
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    return { getAll, get, save };
})();
