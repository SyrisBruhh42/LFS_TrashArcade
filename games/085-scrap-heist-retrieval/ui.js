class UI {
    static drawLoreAndHowTo(ctx, width, height) {
        ctx.fillStyle = '#1f1916';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#ff7043';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Scrap Heist Retrieval', width/2, 60);

        ctx.fillStyle = '#ffca28';
        ctx.font = '20px monospace';
        ctx.fillText('The robotic scrapheap hides massive riches, but it is heavily guarded.', width/2, 100);
        
        // Panels
        const panelWidth = (width - 80) / 3;
        const panelHeight = 250;
        const startY = 140;

        ctx.fillStyle = '#362a23';
        for(let i=0; i<3; i++) {
            ctx.fillRect(20 + i*(panelWidth+20), startY, panelWidth, panelHeight);
        }

        ctx.fillStyle = '#ff7043';
        ctx.font = '16px monospace';
        ctx.fillText('1. Goal & Lore', 20 + panelWidth/2, startY + 30);
        ctx.fillText('2. How it Works', 20 + panelWidth*1.5 + 20, startY + 30);
        ctx.fillText('3. Controls', 20 + panelWidth*2.5 + 40, startY + 30);

        ctx.fillStyle = '#ccc';
        ctx.font = '14px monospace';
        
        // Panel 1
        let text1 = "Infiltrate the scrapheap\nand retrieve high-value\nscrap. Evade security bots\nand spotlights.\nYour goal is to survive\nand escape with the loot.";
        let y = startY + 60;
        text1.split('\n').forEach(line => {
            ctx.fillText(line, 20 + panelWidth/2, y);
            y += 20;
        });

        // Panel 2
        let text2 = "Enemies detect you\nif you enter their red\nvision cones. You have\none EMP blast that can\nstun them, but you must\nphysically retrieve it.";
        y = startY + 60;
        text2.split('\n').forEach(line => {
            ctx.fillText(line, 20 + panelWidth*1.5 + 20, y);
            y += 20;
        });

        // Panel 3
        let text3 = "Desktop:\nWASD/Arrows to Move\nSpace/Click to Shoot\n\nTouch:\nJoystick to Move\nTap screen to Shoot";
        y = startY + 60;
        text3.split('\n').forEach(line => {
            ctx.fillText(line, 20 + panelWidth*2.5 + 40, y);
            y += 20;
        });

        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.fillText('Press Space or Tap to Play', width/2, height - 40);
        
        ctx.font = '18px monospace';
        ctx.fillText('Press O for Options', width/2, height - 15);
    }

    static showOptions() {
        if (document.getElementById('options-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'options-modal';
        modal.style.position = 'absolute';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.backgroundColor = '#1f1916';
        modal.style.color = '#fff';
        modal.style.padding = '20px';
        modal.style.border = '2px solid #ff7043';
        modal.style.zIndex = '1000';
        modal.style.fontFamily = 'monospace';
        modal.style.width = '400px';

        modal.innerHTML = `
            <h2 style="color: #ffca28; text-align: center; margin-top:0;">Options</h2>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <button id="tab-audio" style="flex:1; margin-right:5px; background: #362a23; color:#fff; border: 1px solid #ff7043; cursor: pointer; padding: 5px;">Audio</button>
                <button id="tab-controls" style="flex:1; margin-left:5px; background: #362a23; color:#fff; border: 1px solid #ff7043; cursor: pointer; padding: 5px;">Controls</button>
            </div>
            
            <div id="content-audio">
                <label>Master Volume <input type="range" id="vol-master" min="0" max="1" step="0.1" value="1"></label><br><br>
                <label>SFX Volume <input type="range" id="vol-sfx" min="0" max="1" step="0.1" value="1"></label><br><br>
                <label>Music Volume <input type="range" id="vol-music" min="0" max="1" step="0.1" value="1"></label>
            </div>

            <div id="content-controls" style="display:none;">
                <p>Move: WASD / Arrows / Touch</p>
                <p>Shoot: Space / Click / Tap</p>
                <p>Options: Escape</p>
            </div>
            
            <hr style="border-color: #ff7043;">
            <details>
                <summary style="cursor: pointer; color: #ffca28;">Manage Save Data</summary>
                <button id="btn-reset" style="margin-top: 10px; background: #ff4444; color:#fff; border: none; padding: 5px 10px; cursor: pointer;">Reset Save Data</button>
            </details>
            <br>
            <div style="text-align: center;">
                <button id="btn-close" style="background: #4ad5c0; color:#000; border: none; padding: 10px 20px; font-size: 16px; cursor: pointer;">Close</button>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('tab-audio').onclick = () => {
            document.getElementById('content-audio').style.display = 'block';
            document.getElementById('content-controls').style.display = 'none';
        };
        document.getElementById('tab-controls').onclick = () => {
            document.getElementById('content-audio').style.display = 'none';
            document.getElementById('content-controls').style.display = 'block';
        };

        const sm = window.game ? window.game.saveManager : null;
        if(sm) {
            document.getElementById('vol-master').value = sm.data.options.mute ? 0 : 1;
            document.getElementById('vol-sfx').value = sm.data.options.sfxVolume;
            document.getElementById('vol-music').value = sm.data.options.musicVolume;
            
            document.getElementById('vol-master').onchange = (e) => {
                sm.data.options.mute = e.target.value == 0;
                sm.save();
                if(window.game && window.game.sound) window.game.sound.masterGain.gain.value = e.target.value;
            };
            document.getElementById('vol-sfx').onchange = (e) => {
                sm.data.options.sfxVolume = parseFloat(e.target.value);
                sm.save();
                if(window.game && window.game.sound) window.game.sound.sfxGain.gain.value = sm.data.options.sfxVolume;
            };
            document.getElementById('vol-music').onchange = (e) => {
                sm.data.options.musicVolume = parseFloat(e.target.value);
                sm.save();
                if(window.game && window.game.sound) window.game.sound.musicGain.gain.value = sm.data.options.musicVolume;
            };
        }

        document.getElementById('btn-reset').onclick = () => {
            if(confirm("Reset all progress?")) {
                localStorage.removeItem(SAVE_KEY);
                location.reload();
            }
        };

        document.getElementById('btn-close').onclick = () => {
            modal.remove();
            if(window.game) {
                if(window.game.state === 'OPTIONS') {
                    window.game.state = window.game.prevState || 'TITLE';
                }
            }
        };
    }
}
window.UI = UI;
