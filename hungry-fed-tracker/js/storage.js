// Storage wrapper for R1 creation persistence
// Detects the available storage API and uses it accordingly:
//   1. creationStorage.plain.setItem/getItem (async, base64 per SDK ref doc)
//   2. creationStorage.set/get             (sync fallback)
//   3. localStorage                         (browser dev fallback)

const isR1 = typeof window !== 'undefined' && (
    typeof window.creationSensors !== 'undefined' ||
    typeof window.creationStorage !== 'undefined'
);

let storageBackend = null; // 'plain' | 'direct' | 'localStorage' | null

function initStorage() {
    if (typeof creationStorage !== 'undefined') {
        if (creationStorage.plain) {
            storageBackend = 'plain';
        } else if (typeof creationStorage.set === 'function') {
            storageBackend = 'direct';
        }
    } else if (typeof localStorage !== 'undefined') {
        storageBackend = 'localStorage';
    }
}

initStorage();

async function storageSet(key, value) {
    const serialized = JSON.stringify(value);
    try {
        if (storageBackend === 'plain') {
            // SDK reference: async, base64-encoded
            await creationStorage.plain.setItem(key, btoa(serialized));
        } else if (storageBackend === 'direct') {
            // Alternative: synchronous direct API
            creationStorage.set(key, serialized);
        } else if (storageBackend === 'localStorage') {
            localStorage.setItem(key, serialized);
        }
    } catch (e) {
        console.error('Storage write failed:', e);
        try { localStorage.setItem(key, serialized); } catch (_) {}
    }
}

async function storageGet(key, defaultValue) {
    try {
        let raw = null;
        if (storageBackend === 'plain') {
            raw = await creationStorage.plain.getItem(key);
            if (raw) raw = atob(raw);
        } else if (storageBackend === 'direct') {
            raw = creationStorage.get(key);
        } else if (storageBackend === 'localStorage') {
            raw = localStorage.getItem(key);
        }
        if (!raw) return defaultValue;
        return JSON.parse(raw);
    } catch (e) {
        console.error('Storage read failed:', e);
        return defaultValue;
    }
}
