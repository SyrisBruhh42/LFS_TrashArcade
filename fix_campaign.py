with open("test_campaign.js", "r") as f:
    text = f.read()

text = text.replace("    update(dt) {", """    populateHTML() {
        const container = document.getElementById('milestones-list');
        if (!container) return;

        let html = '<h3 style="color: #ff4081; border-bottom: 1px solid #ffe4ec; padding-bottom: 5px;">Unlockable Milestones</h3>';
        for (let m of this.milestones) {
            const status = m.unlocked ? '<span style="color: #4CAF50;">&#10004; Unlocked</span>' : '<span style="color: #999;">Locked</span>';
            html += `<div style="margin-bottom: 10px; padding: 10px; border: 1px solid #eee; border-radius: 5px; background: ${m.unlocked ? '#f8fdf8' : '#fafafa'};">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <strong>${m.name}</strong>
                            ${status}
                        </div>
                        <div style="font-size: 12px; color: #666;">${m.desc}</div>
                     </div>`;
        }
        container.innerHTML = html;
    }

    update(dt) {""")

with open("games/087-tokyo-high-school-rooftop-sakura-courtyard-d/campaign.js", "w") as f:
    f.write(text)
