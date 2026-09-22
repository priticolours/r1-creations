// Hungry/Fed Tracker — main application logic
// Single-page app for R1's 240x282 screen

document.addEventListener('DOMContentLoaded', async function() {
    const statusText = document.getElementById('statusText');
    const statusDisplay = document.querySelector('.status-display');
    const timestampEl = document.getElementById('timestamp');
    const app = document.getElementById('app');

    const KEYS = {
        STATE: 'tracker_state',
        LAST_FEEDING: 'last_feeding_time'
    };

    // Restore persisted state (async because creationStorage.plain is async)
    let currentState = await storageGet(KEYS.STATE, 'hungry');
    let lastFed = await storageGet(KEYS.LAST_FEEDING, null);

    function formatTime() {
        return new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function updateUI() {
        if (currentState === 'fed') {
            statusText.textContent = 'FED';
            statusDisplay.className = 'status-display fed';
            app.classList.add('fed');
            app.classList.remove('hungry');
        } else {
            statusText.textContent = 'HUNGRY';
            statusDisplay.className = 'status-display hungry';
            app.classList.remove('fed');
            app.classList.add('hungry');
        }

        timestampEl.textContent = lastFed
            ? 'Fed at ' + lastFed
            : 'Never fed';
    }

    function setFed() {
        currentState = 'fed';
        lastFed = formatTime();
        storageSet(KEYS.STATE, 'fed');
        storageSet(KEYS.LAST_FEEDING, lastFed);
        updateUI();
    }

    function setHungry() {
        currentState = 'hungry';
        storageSet(KEYS.STATE, 'hungry');
        updateUI();
    }

    // Button handlers — primary interaction
    document.getElementById('hungryBtn').addEventListener('click', setHungry);
    document.getElementById('fedBtn').addEventListener('click', setFed);

    // R1 hardware scroll wheel — single-page app, no nav guard needed
    if (isR1) {
        window.addEventListener('scrollUp', setHungry);
        window.addEventListener('scrollDown', setFed);
    }

    // Initial render
    updateUI();
});
