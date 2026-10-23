class UIManager {
    constructor(game) {
        this.game = game;
        this.setupDOM();
    }

    setupDOM() {
        this.container = document.getElementById('game-container');

        this.settingsBtn = document.createElement('button');
        this.settingsBtn.textContent = '⚙ Settings';
        this.settingsBtn.style.position = 'absolute';
        this.settingsBtn.style.top = '10px';
        this.settingsBtn.style.right = '10px';
        this.settingsBtn.style.zIndex = '100';
        this.settingsBtn.style.padding = '8px';
        this.settingsBtn.style.background = '#333';
        this.settingsBtn.style.color = '#fff';
        this.settingsBtn.style.border = '1px solid #5544e7';
        this.settingsBtn.style.cursor = 'pointer';
        this.settingsBtn.style.fontFamily = 'monospace';

        this.container.appendChild(this.settingsBtn);

        this.modal = document.createElement('div');
        this.modal.style.position = 'absolute';
        this.modal.style.top = '50%';
        this.modal.style.left = '50%';
        this.modal.style.transform = 'translate(-50%, -50%)';
        this.modal.style.background = 'rgba(0, 0, 0, 0.95)';
        this.modal.style.border = '2px solid #5544e7';
        this.modal.style.padding = '20px';
        this.modal.style.color = '#fff';
        this.modal.style.zIndex = '200';
        this.modal.style.display = 'none';
        this.modal.style.width = '80%';
        this.modal.style.maxWidth = '400px';
        this.modal.style.maxHeight = '80vh';
        this.modal.style.overflowY = 'auto';
        this.modal.style.fontFamily = 'monospace';

        this.container.appendChild(this.modal);

        this.settingsBtn.onclick = () => {
            if (this.modal.style.display === 'none') {
                this.buildModal();
                this.modal.style.display = 'block';
                if (this.game.state === 'PLAYING') this.game.state = 'PAUSED';
            } else {
                this.modal.style.display = 'none';
                if (this.game.state === 'PAUSED') this.game.state = 'PLAYING';
            }
        };
    }

    buildModal() {
        this.modal.innerHTML = '<h2 style="margin-top:0">Settings</h2>';
        const opts = this.game.saveManager.data.options;

        const addToggle = (label, key) => {
            const div = document.createElement('div');
            div.style.marginBottom = '10px';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = opts[key];
            cb.onchange = (e) => {
                opts[key] = e.target.checked;
                this.game.saveManager.save();
                if(this.game.sound && this.game.sound.updateVolumes) this.game.sound.updateVolumes(opts);
            };
            div.appendChild(cb);
            div.appendChild(document.createTextNode(' ' + label));
            this.modal.appendChild(div);
        };

        const addSelect = (label, key, optionsList) => {
            const div = document.createElement('div');
            div.style.marginBottom = '10px';
            div.appendChild(document.createTextNode(label + ': '));
            const sel = document.createElement('select');
            optionsList.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o;
                opt.text = o;
                if (opts[key] == o || (key === 'shakeIntensity' && ((o==='100%' && opts[key]===1.0) || (o==='50%' && opts[key]===0.5) || (o==='Off' && opts[key]===0)))) {
                    opt.selected = true;
                }
                sel.appendChild(opt);
            });
            sel.onchange = (e) => {
                let val = e.target.value;
                if (key === 'shakeIntensity') {
                    if (val === '100%') opts[key] = 1.0;
                    else if (val === '50%') opts[key] = 0.5;
                    else opts[key] = 0.0;
                } else {
                    opts[key] = val;
                }
                this.game.saveManager.save();
            };
            div.appendChild(sel);
            this.modal.appendChild(div);
        };

        const addSlider = (label, key) => {
            const div = document.createElement('div');
            div.style.marginBottom = '10px';
            div.appendChild(document.createTextNode(label + ': '));
            const inp = document.createElement('input');
            inp.type = 'range';
            inp.min = '0'; inp.max = '1'; inp.step = '0.1';
            inp.value = opts[key];
            inp.onchange = (e) => {
                opts[key] = parseFloat(e.target.value);
                this.game.saveManager.save();
                if(this.game.sound && this.game.sound.updateVolumes) this.game.sound.updateVolumes(opts);
            };
            div.appendChild(inp);
            this.modal.appendChild(div);
        };

        addToggle('Master Mute', 'masterMute');
        addSlider('SFX Volume', 'sfxVolume');
        addSlider('Music Volume', 'musicVolume');
        addSelect('Screen Shake', 'shakeIntensity', ['100%', '50%', 'Off']);
        addSelect('Particle Density', 'particleDensity', ['High', 'Low']);
        addToggle('High Contrast Mode', 'highContrast');
        addToggle('Show FPS', 'showFPS');
        addSelect('Touch Controls', 'touchControls', ['Auto', 'Always', 'Off']);
        addToggle('Left-Handed Touch UI', 'leftHanded');

        // Base64 Data export/import
        const dataDiv = document.createElement('div');
        dataDiv.style.marginTop = '20px';
        dataDiv.innerHTML = '<h3>Save Data</h3>';

        const expBtn = document.createElement('button');
        expBtn.textContent = 'Export Data';
        const impBtn = document.createElement('button');
        impBtn.textContent = 'Import Data';
        const area = document.createElement('textarea');
        area.style.width = '100%';
        area.style.height = '60px';

        expBtn.onclick = () => {
            area.value = btoa(JSON.stringify(this.game.saveManager.data));
        };
        impBtn.onclick = () => {
            try {
                let parsed = JSON.parse(atob(area.value));
                if (parsed) {
                    this.game.saveManager.data = parsed;
                    this.game.saveManager.save();
                    alert('Save imported successfully! Restarting...');
                    location.reload();
                }
            } catch(e) {
                alert('Invalid save data.');
            }
        };

        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset Save';
        resetBtn.style.marginTop = '10px';
        resetBtn.style.color = 'red';
        let resetStep = 0;
        resetBtn.onclick = () => {
            if (resetStep === 0) {
                resetBtn.textContent = 'Are you sure?';
                resetStep = 1;
            } else {
                localStorage.removeItem(SAVE_KEY);
                location.reload();
            }
        };

        dataDiv.appendChild(expBtn);
        dataDiv.appendChild(impBtn);
        dataDiv.appendChild(area);
        dataDiv.appendChild(resetBtn);
        this.modal.appendChild(dataDiv);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.marginTop = '20px';
        closeBtn.style.width = '100%';
        closeBtn.style.padding = '10px';
        closeBtn.onclick = () => {
            this.modal.style.display = 'none';
            if (this.game.state === 'PAUSED') this.game.state = 'PLAYING';
        };
        this.modal.appendChild(closeBtn);
    }
}
