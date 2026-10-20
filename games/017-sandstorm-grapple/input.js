class InputManager {
    constructor(canvas, container) {
        this.canvas = canvas;
        this.container = container;

        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, rightDown: false };
        this.touches = [];

        // Logical resolution
        this.logicWidth = 1920;
        this.logicHeight = 1080;

        // Scale factors
        this.scaleX = 1;
        this.scaleY = 1;

        // Touch controls state
        this.joystick = { active: false, id: null, origin: {x:0, y:0}, delta: {x:0, y:0} };
        this.actionBtn = { active: false, id: null };
        this.polarityBtn = { active: false, id: null };

        this.isMobile = false;

        this.onGrappleStart = null;
        this.onGrappleEnd = null;
        this.onPolarityToggle = null;
        this.onJump = null;
        this.onPause = null;
        this.onAnyInput = null;

        this.initObservers();
        this.initListeners();
    }

    initObservers() {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                this.resizeCanvas(entry.contentRect.width, entry.contentRect.height);
            }
        });
        resizeObserver.observe(this.container);

        // Initial sizing
        const rect = this.container.getBoundingClientRect();
        this.resizeCanvas(rect.width, rect.height);
    }

    resizeCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;

        // We want to fit the logical resolution into the actual window while maintaining aspect ratio,
        // or we can use a "fill" strategy with a locked internal coordinate space.
        // Let's use a letterbox/pillarbox approach to keep logical space 1920x1080.

        const aspect = this.logicWidth / this.logicHeight;
        const windowAspect = width / height;

        if (windowAspect > aspect) {
            // Window is wider than logical, scale to height
            this.scaleY = height / this.logicHeight;
            this.scaleX = this.scaleY;
        } else {
            // Window is taller than logical, scale to width
            this.scaleX = width / this.logicWidth;
            this.scaleY = this.scaleX;
        }

        // Determine if mobile (simplistic check based on width or touch support)
        this.isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (width <= 768);
    }

    getLogicalPos(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        // Calculate offset if letterboxed
        const drawWidth = this.logicWidth * this.scaleX;
        const drawHeight = this.logicHeight * this.scaleY;
        const offsetX = (rect.width - drawWidth) / 2;
        const offsetY = (rect.height - drawHeight) / 2;

        const x = (clientX - rect.left - offsetX) / this.scaleX;
        const y = (clientY - rect.top - offsetY) / this.scaleY;
        return { x, y };
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (this.onAnyInput) this.onAnyInput();

            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                if (this.onJump) this.onJump();
                e.preventDefault();
            }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') {
                if (this.onPolarityToggle) this.onPolarityToggle();
                e.preventDefault();
            }
            if (e.code === 'Escape' || e.code === 'KeyP') {
                if (this.onPause) this.onPause();
            }
        }, {passive: false});

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Mouse
        this.canvas.addEventListener('pointerdown', (e) => {
            if (this.onAnyInput) this.onAnyInput();
            if (e.pointerType === 'touch') return; // Handled in touch events

            this.isMobile = false;
            const logicalPos = this.getLogicalPos(e.clientX, e.clientY);
            this.mouse.x = logicalPos.x;
            this.mouse.y = logicalPos.y;

            if (e.button === 0) {
                this.mouse.down = true;
                if (this.onGrappleStart) this.onGrappleStart(logicalPos.x, logicalPos.y);
            } else if (e.button === 2) {
                this.mouse.rightDown = true;
                if (this.onPolarityToggle) this.onPolarityToggle();
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'touch') return;
            const logicalPos = this.getLogicalPos(e.clientX, e.clientY);
            this.mouse.x = logicalPos.x;
            this.mouse.y = logicalPos.y;
        });

        window.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'touch') return;
            if (e.button === 0) {
                this.mouse.down = false;
                if (this.onGrappleEnd) this.onGrappleEnd();
            } else if (e.button === 2) {
                this.mouse.rightDown = false;
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.onAnyInput) this.onAnyInput();
            this.isMobile = true;
            // We don't prevent default blindly here to avoid breaking UI clicks

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const lpos = this.getLogicalPos(touch.clientX, touch.clientY);
                this.touches.push({ id: touch.identifier, x: lpos.x, y: lpos.y, startX: lpos.x, startY: lpos.y });

                // Left half screen = joystick
                if (lpos.x < this.logicWidth / 2 && !this.joystick.active) {
                    this.joystick.active = true;
                    this.joystick.id = touch.identifier;
                    this.joystick.origin = { x: lpos.x, y: lpos.y };
                    this.joystick.delta = { x: 0, y: 0 };
                }
                // Right half screen = action buttons / grapple
                else if (lpos.x >= this.logicWidth / 2) {
                    // Check if it's polarity button area (bottom right)
                    if (lpos.y > this.logicHeight * 0.7 && lpos.x > this.logicWidth * 0.8) {
                        this.polarityBtn.active = true;
                        this.polarityBtn.id = touch.identifier;
                        if (this.onPolarityToggle) this.onPolarityToggle();
                    } else {
                        // Anywhere else on right side is jump/grapple
                        this.actionBtn.active = true;
                        this.actionBtn.id = touch.identifier;
                        // For touch, we might grapple towards the touch point, or just shoot upwards
                        // Let's shoot towards the touch point relative to screen
                        if (this.onGrappleStart) this.onGrappleStart(lpos.x, lpos.y);
                        if (this.onJump) this.onJump(); // Can also trigger jump
                    }
                }
            }
        }, {passive: true});

        this.canvas.addEventListener('touchmove', (e) => {
            // e.preventDefault(); // Don't prevent default, we want scrolling if needed, or handle in css with touch-action:none

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const lpos = this.getLogicalPos(touch.clientX, touch.clientY);

                // Update touch records
                const t = this.touches.find(t => t.id === touch.identifier);
                if (t) { t.x = lpos.x; t.y = lpos.y; }

                // Update joystick
                if (this.joystick.active && this.joystick.id === touch.identifier) {
                    const dx = lpos.x - this.joystick.origin.x;
                    const dy = lpos.y - this.joystick.origin.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    const maxDist = 100; // Logical pixels

                    if (dist > maxDist) {
                        this.joystick.delta.x = (dx / dist) * maxDist;
                        this.joystick.delta.y = (dy / dist) * maxDist;
                    } else {
                        this.joystick.delta.x = dx;
                        this.joystick.delta.y = dy;
                    }
                }
            }
        }, {passive: true});

        const handleTouchEnd = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];

                this.touches = this.touches.filter(t => t.id !== touch.identifier);

                if (this.joystick.id === touch.identifier) {
                    this.joystick.active = false;
                    this.joystick.id = null;
                    this.joystick.delta = {x:0, y:0};
                }

                if (this.actionBtn.id === touch.identifier) {
                    this.actionBtn.active = false;
                    this.actionBtn.id = null;
                    if (this.onGrappleEnd) this.onGrappleEnd();
                }

                if (this.polarityBtn.id === touch.identifier) {
                    this.polarityBtn.active = false;
                    this.polarityBtn.id = null;
                }
            }
        };

        this.canvas.addEventListener('touchend', handleTouchEnd);
        this.canvas.addEventListener('touchcancel', handleTouchEnd);
    }

    getAxisX() {
        let ax = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) ax -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) ax += 1;

        if (this.joystick.active) {
            ax += this.joystick.delta.x / 100; // Normalize -1 to 1
        }

        return Math.max(-1, Math.min(1, ax));
    }

    getAxisY() {
        let ay = 0;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) ay -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) ay += 1;

        if (this.joystick.active) {
            ay += this.joystick.delta.y / 100;
        }

        return Math.max(-1, Math.min(1, ay));
    }
}
