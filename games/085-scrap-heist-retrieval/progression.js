class ProgressionSystem {
    constructor(saveManager) {
        this.saveManager = saveManager;
        if (!this.saveManager.data.scrapAccumulated) {
            this.saveManager.data.scrapAccumulated = 0;
            this.saveManager.data.upgrades = {
                moveSpeed: 0,
                ammoRange: 0,
                stunTime: 0,
                comboTime: 0
            };
            this.saveManager.save();
        }

        this.upgrades = [
            { id: 'moveSpeed', name: 'Servo Accelerators', desc: 'Increases base move speed', baseCost: 1000, max: 5 },
            { id: 'ammoRange', name: 'Magnetic Grapple', desc: 'Increases ammo retrieval range', baseCost: 800, max: 5 },
            { id: 'stunTime', name: 'Overcharge Capacitors', desc: 'Increases stun duration', baseCost: 1500, max: 5 },
            { id: 'comboTime', name: 'Combo Processor', desc: 'Increases combo grace period', baseCost: 1200, max: 5 }
        ];

        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboGrace = 2.0;
        this.maxComboTimer = 2.0;
    }

    addScrap(amount) {
        let mult = 1 + (this.comboCount * 0.1);
        let total = Math.floor(amount * mult);
        this.saveManager.data.scrapAccumulated += total;
        this.saveManager.data.totalScoreAccumulated += total;

        this.comboCount++;
        this.comboTimer = this.getComboGrace();

        if (this.comboCount > this.saveManager.data.bestWaveOrCombo) {
            this.saveManager.data.bestWaveOrCombo = this.comboCount;
        }
        this.saveManager.save();
        return total;
    }

    update(dt) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
            }
        }
    }

    getComboGrace() {
        return this.comboGrace + (this.getLevel('comboTime') * 0.5);
    }

    getLevel(id) {
        return this.saveManager.data.upgrades[id] || 0;
    }

    getCost(id) {
        const u = this.upgrades.find(u => u.id === id);
        return u.baseCost * Math.pow(1.5, this.getLevel(id));
    }

    buyUpgrade(id) {
        const cost = this.getCost(id);
        const level = this.getLevel(id);
        const max = this.upgrades.find(u => u.id === id).max;

        if (level < max && this.saveManager.data.scrapAccumulated >= cost) {
            this.saveManager.data.scrapAccumulated -= cost;
            this.saveManager.data.upgrades[id] = level + 1;
            this.saveManager.save();
            return true;
        }
        return false;
    }
}
