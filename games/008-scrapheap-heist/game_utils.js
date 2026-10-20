class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_008_008-scrapheap-heist_v1';
        this.data = this.load();
    }

    load() {
        const defaultData = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterMute: false,
                sfxVolume: 100,
                musicVolume: 100,
                screenShake: 1,
                particles: 'High',
                highContrast: false,
                showFPS: false,
                touchControls: 'Auto' // Auto, Always, Off
            }
        };
        try {
            const raw = localStorage.getItem(this.saveKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...defaultData, ...parsed, options: { ...defaultData.options, ...(parsed.options || {}) } };
            }
        } catch (e) {
            console.warn('localStorage error, using in-memory fallback', e);
        }
        return defaultData;
    }

    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.warn('localStorage error, saving to in-memory fallback', e);
        }
    }

    reset() {
        try {
            localStorage.removeItem(this.saveKey);
        } catch(e) {}
        this.data = this.load();
        this.save();
    }
}

class InputManager {
    constructor(canvas, uiLayer) {
        this.keys = new Set();
        this.justPressedKeys = new Set();

        this.pointer = { active: false, x: 0, y: 0, worldX: 0, worldY: 0 };
        this.touches = new Map();

        this.touchDetected = false;

        // Logical buttons states
        this.actions = {
            up: false, down: false, left: false, right: false,
            interact: false, pause: false, overdrive: false
        };
        this.justPressedActions = {
            up: false, down: false, left: false, right: false,
            interact: false, pause: false, overdrive: false
        };

        this.virtualJoystick = { active: false, x: 0, y: 0, startX: 0, startY: 0, dx: 0, dy: 0 };

        window.addEventListener('keydown', e => {
            this.keys.add(e.code);
            this.justPressedKeys.add(e.code);
            this.updateActions();
        });
        window.addEventListener('keyup', e => {
            this.keys.delete(e.code);
            this.updateActions();
        });

        const updatePointer = (e, active) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = LOGICAL_WIDTH / rect.width;
            const scaleY = LOGICAL_HEIGHT / rect.height;

            this.pointer.active = active;
            this.pointer.x = (e.clientX - rect.left) * scaleX;
            this.pointer.y = (e.clientY - rect.top) * scaleY;
        };

        uiLayer.addEventListener('pointerdown', e => {
            if (e.pointerType === 'touch') this.touchDetected = true;
            this.touches.set(e.pointerId, { startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, isJoy: false, isBtn: false });
            updatePointer(e, true);
            this.handleTouchStart(e.pointerId, e.clientX, e.clientY);
        });
        uiLayer.addEventListener('pointermove', e => {
            if (this.touches.has(e.pointerId)) {
                let t = this.touches.get(e.pointerId);
                t.x = e.clientX;
                t.y = e.clientY;
                this.handleTouchMove(e.pointerId, e.clientX, e.clientY);
            }
            updatePointer(e, this.pointer.active);
        });
        uiLayer.addEventListener('pointerup', e => {
            this.touches.delete(e.pointerId);
            updatePointer(e, false);
            this.handleTouchEnd(e.pointerId);
        });
        uiLayer.addEventListener('pointercancel', e => {
            this.touches.delete(e.pointerId);
            updatePointer(e, false);
            this.handleTouchEnd(e.pointerId);
        });

        // Prevent default context menu
        window.addEventListener('contextmenu', e => e.preventDefault());
    }

    updateActions() {
        const check = (...codes) => codes.some(c => this.keys.has(c));
        const checkJust = (...codes) => codes.some(c => this.justPressedKeys.has(c));

        this.actions.up = check('KeyW', 'ArrowUp');
        this.actions.down = check('KeyS', 'ArrowDown');
        this.actions.left = check('KeyA', 'ArrowLeft');
        this.actions.right = check('KeyD', 'ArrowRight');
        this.actions.interact = check('Space', 'Enter');
        this.actions.pause = check('Escape', 'KeyP');
        this.actions.overdrive = check('Space');

        this.justPressedActions.up = checkJust('KeyW', 'ArrowUp');
        this.justPressedActions.down = checkJust('KeyS', 'ArrowDown');
        this.justPressedActions.left = checkJust('KeyA', 'ArrowLeft');
        this.justPressedActions.right = checkJust('KeyD', 'ArrowRight');
        this.justPressedActions.interact = checkJust('Space', 'Enter');
        this.justPressedActions.pause = checkJust('Escape', 'KeyP');
        this.justPressedActions.overdrive = checkJust('Space');

        // Apply virtual joystick
        if (this.virtualJoystick.active) {
            const thresh = 20;
            if (this.virtualJoystick.dy < -thresh) this.actions.up = true;
            if (this.virtualJoystick.dy > thresh) this.actions.down = true;
            if (this.virtualJoystick.dx < -thresh) this.actions.left = true;
            if (this.virtualJoystick.dx > thresh) this.actions.right = true;
        }
    }

    handleTouchStart(id, x, y) {
        // Simple half-screen split for joystick and button
        const w = window.innerWidth;
        if (x < w / 2) {
            // Joystick
            this.virtualJoystick.active = true;
            this.virtualJoystick.startX = x;
            this.virtualJoystick.startY = y;
            this.virtualJoystick.dx = 0;
            this.virtualJoystick.dy = 0;
            let t = this.touches.get(id);
            if (t) t.isJoy = true;
        } else {
            // Button (Overdrive/Interact)
            this.actions.overdrive = true;
            this.justPressedActions.overdrive = true;
            this.actions.interact = true;
            this.justPressedActions.interact = true;
            let t = this.touches.get(id);
            if (t) t.isBtn = true;
        }
        this.updateActions();
    }

    handleTouchMove(id, x, y) {
        let t = this.touches.get(id);
        if (t && t.isJoy) {
            this.virtualJoystick.dx = x - this.virtualJoystick.startX;
            this.virtualJoystick.dy = y - this.virtualJoystick.startY;

            const maxDist = 50;
            const dist = Math.hypot(this.virtualJoystick.dx, this.virtualJoystick.dy);
            if (dist > maxDist) {
                this.virtualJoystick.dx = (this.virtualJoystick.dx / dist) * maxDist;
                this.virtualJoystick.dy = (this.virtualJoystick.dy / dist) * maxDist;
            }
            this.updateActions();
        }
    }

    handleTouchEnd(id) {
        let isJoyActive = false;
        let isBtnActive = false;

        for (let [tid, t] of this.touches) {
            if (t.isJoy) isJoyActive = true;
            if (t.isBtn) isBtnActive = true;
        }

        if (!isJoyActive) {
            this.virtualJoystick.active = false;
            this.virtualJoystick.dx = 0;
            this.virtualJoystick.dy = 0;
        }

        if (!isBtnActive) {
            this.actions.overdrive = false;
            this.actions.interact = false;
        }

        this.updateActions();
    }

    clearJustPressed() {
        this.justPressedKeys.clear();
        for (let key in this.justPressedActions) {
            this.justPressedActions[key] = false;
        }
    }
}
