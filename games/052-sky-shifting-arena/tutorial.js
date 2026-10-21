class TutorialManager {
    constructor(engine) {
        this.engine = engine;
        this.hasShownTutorial = this.engine.saveManager.data._hasShownTutorial || false;
        this.tutorialActive = false;

        this.bindEvents();
    }

    bindEvents() {
        const btnClose = document.getElementById('btn-close-tutorial');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                this.closeTutorial();
            });
        }
    }

    showTutorial() {
        if (this.hasShownTutorial) return;

        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            this.tutorialActive = true;
            this.engine.setState('TUTORIAL');
        }
    }

    closeTutorial() {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            this.tutorialActive = false;
            this.hasShownTutorial = true;
            this.engine.saveManager.data._hasShownTutorial = true;
            this.engine.saveManager.save();
            this.engine.setState('PLAYING');
        }
    }
}

// Inject TutorialManager into the game engine
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.engine) {
            window.tutorialManager = new TutorialManager(window.engine);

            // Monkey-patch setState to support TUTORIAL and catch first wave
            const originalSetState = window.engine.setState;
            window.engine.setState = function(newState) {
                if (newState === 'PLAYING' && this.wave === 1 && !window.tutorialManager.hasShownTutorial) {
                    window.tutorialManager.showTutorial();
                    return; // Prevent normal playing state
                }

                if (newState === 'TUTORIAL') {
                    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
                    const upg = document.getElementById('upgrade-screen');
                    if (upg) upg.classList.add('hidden');

                    const tut = document.getElementById('tutorial-overlay');
                    if (tut) tut.classList.remove('hidden');
                    this.state = 'TUTORIAL';
                    return;
                }

                originalSetState.call(this, newState);
            };

            // Monkey-patch game loop so we don't update if in TUTORIAL
            const originalUpdate = window.engine.update;
            window.engine.update = function(dt) {
                if (this.state === 'TUTORIAL') return;
                originalUpdate.call(this, dt);
            };
        }
    }, 150); // slight delay after other UI initializers
});
