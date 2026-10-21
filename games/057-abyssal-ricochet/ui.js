class UIManager {
  constructor() {
    this.milestones = [
      { id: 'm1', name: 'Deep Diver', desc: 'Reach Wave 10', condition: () => (window.engine && window.engine.saveManager && window.engine.saveManager.data ? window.engine.saveManager.data.bestWaveOrCombo : 0) >= 10 },
      { id: 'm2', name: 'Abyssal Lord', desc: 'Reach Wave 20', condition: () => (window.engine && window.engine.saveManager && window.engine.saveManager.data ? window.engine.saveManager.data.bestWaveOrCombo : 0) >= 20 },
      { id: 'm3', name: 'Rich Haul', desc: 'Score 5,000 Points', condition: () => (window.engine && window.engine.saveManager && window.engine.saveManager.data ? window.engine.saveManager.data.highScore : 0) >= 5000 },
      { id: 'm4', name: 'Treasury', desc: 'Score 15,000 Points', condition: () => (window.engine && window.engine.saveManager && window.engine.saveManager.data ? window.engine.saveManager.data.highScore : 0) >= 15000 },
      { id: 'm5', name: 'Pinball Wizard', desc: '100 Bounces Total', condition: () => (window.engine && window.engine.saveManager && window.engine.saveManager.data ? window.engine.saveManager.data.totalBounces : 0) >= 100 },
      { id: 'm6', name: 'Leviathan Slayer', desc: '5 Bosses Defeated', condition: () => (window.engine && window.engine.saveManager && window.engine.saveManager.data ? window.engine.saveManager.data.totalBosses : 0) >= 5 }
    ];
    this.bindOptionsUI();
  }

  bindOptionsUI() {
    const btnOptions = document.getElementById('btn-options');
    if (btnOptions) btnOptions.addEventListener('click', () => this.showOptions());

    const btnOptionsClose = document.getElementById('btn-options-close');
    if (btnOptionsClose) btnOptionsClose.addEventListener('click', () => {
      window.engine.setState('TITLE');
      this.updateMilestonesDisplay();
    });

    const bindOpt = (id, key, event, type) => {
      const el = document.getElementById(id);
      if (!el) return;

      const opt = (window.engine && window.engine.saveManager && window.engine.saveManager.data) ? window.engine.saveManager.data.options : null;
      if (!opt) return;
      if (type === 'checkbox') el.checked = opt[key];
      else el.value = opt[key];

      el.addEventListener(event, (e) => {
        if (type === 'checkbox') opt[key] = e.target.checked;
        else if (type === 'number') opt[key] = parseFloat(e.target.value);
        else opt[key] = e.target.value;

        if (window.engine && window.engine.saveManager) window.engine.saveManager.save();

        if (key === 'masterMute' || key === 'sfxVolume' || key === 'musicVolume') {
          window.engine.audio.updateVolumes();
        }
      });
    };

    bindOpt('opt-mute', 'masterMute', 'change', 'checkbox');
    bindOpt('opt-sfx', 'sfxVolume', 'input', 'number');
    bindOpt('opt-music', 'musicVolume', 'input', 'number');
    bindOpt('opt-shake', 'screenShake', 'change', 'number');
    bindOpt('opt-particles', 'particles', 'change', 'string');
    bindOpt('opt-contrast', 'highContrast', 'change', 'checkbox');
    bindOpt('opt-fps', 'showFPS', 'change', 'checkbox');
    bindOpt('opt-touch', 'touchControls', 'change', 'string');
    bindOpt('opt-handedness', 'handedness', 'change', 'string');

    // Base64 functionality
    const btnExport = document.getElementById('btn-export');
    const txtExport = document.getElementById('txt-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        txtExport.value = btoa(JSON.stringify((window.engine && window.engine.saveManager ? window.engine.saveManager.data : {})));
      });
    }

    const btnImport = document.getElementById('btn-import');
    const txtImport = document.getElementById('txt-import');
    if (btnImport) {
      btnImport.addEventListener('click', () => {
        try {
          const imported = JSON.parse(atob(txtImport.value));
          if (imported && imported.options) {
            window.engine.saveManager.data = imported;
            if (window.engine && window.engine.saveManager) window.engine.saveManager.save();
            alert('Save Imported!');
            location.reload();
          }
        } catch (e) {
          alert('Invalid Save Data');
        }
      });
    }

    const btnReset = document.getElementById('btn-reset');
    const btnResetConfirm = document.getElementById('btn-reset-confirm');
    if (btnReset && btnResetConfirm) {
      btnReset.addEventListener('click', () => {
        btnReset.style.display = 'none';
        btnResetConfirm.style.display = 'inline-block';
      });
      btnResetConfirm.addEventListener('click', () => {
        if (window.engine && window.engine.saveManager) localStorage.removeItem(window.engine.saveManager.saveKey);
        location.reload();
      });
    }
  }

  showOptions() {
    window.engine.setState('OPTIONS');
  }

  checkMilestones() {
    let unlockedAny = false;
    this.milestones.forEach(m => {
      const unlocked = (window.engine && window.engine.saveManager && window.engine.saveManager.data) ? window.engine.saveManager.data.unlockedMilestones : [];
      if (!unlocked.includes(m.id) && m.condition()) {
        unlocked.push(m.id);
        unlockedAny = true;
      }
    });
    if (unlockedAny) {
      if (window.engine && window.engine.saveManager) window.engine.saveManager.save();
      this.updateMilestonesDisplay();
    }
  }

  updateMilestonesDisplay() {
    const containers = document.querySelectorAll('.milestonesDisplay');
    containers.forEach(container => {
      container.innerHTML = '';
      const unlocked = (window.engine && window.engine.saveManager && window.engine.saveManager.data) ? window.engine.saveManager.data.unlockedMilestones : [];
      if (unlocked.length === 0) return;

      const title = document.createElement('h3');
      title.textContent = 'Badges Earned:';
      title.style.color = '#ffeb3b';
      title.style.marginTop = '20px';
      container.appendChild(title);

      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.gap = '10px';
      list.style.justifyContent = 'center';
      list.style.flexWrap = 'wrap';

      this.milestones.forEach(m => {
        if (unlocked.includes(m.id)) {
          const badge = document.createElement('div');
          badge.style.background = '#333';
          badge.style.border = '1px solid #ffeb3b';
          badge.style.padding = '5px 10px';
          badge.style.borderRadius = '15px';
          badge.style.fontSize = '0.8rem';
          badge.style.color = '#fff';
          badge.title = m.desc;
          badge.textContent = m.name;
          list.appendChild(badge);
        }
      });
      container.appendChild(list);
    });
  }
}
