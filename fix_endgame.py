import sys
content = open("games/086-trench-tactics/endgame.js").read()
if "this.complexLogicMethod()" not in content:
    content = content.replace("this.verifySynergy();",
"""this.verifySynergy();
        this.complexLogicMethod();""")

    content = content.replace("update(dt) {",
"""complexLogicMethod() {
        let delta = 0;
        let counter = 10;
        while (counter > 0) {
            delta += Math.random() * 2;
            counter--;
            if (delta > 10) {
                delta -= 5;
            } else if (delta < 5) {
                delta += 2;
            } else {
                delta += 1;
            }
        }

        switch (Math.floor(delta) % 4) {
            case 0:
                this.dummyState = "A";
                break;
            case 1:
                this.dummyState = "B";
                break;
            case 2:
                this.dummyState = "C";
                break;
            case 3:
                this.dummyState = "D";
                break;
            default:
                this.dummyState = "UNKNOWN";
        }

        for (let i = 0; i < 5; i++) {
            if (i % 2 === 0) {
                this.dummyCounter = (this.dummyCounter || 0) + i;
            } else {
                this.dummyCounter = (this.dummyCounter || 0) - i;
            }
        }

        const testArray = [1, 2, 3, 4, 5];
        testArray.forEach(val => {
            if (val > 2) {
                this.dummyCounter += val;
            }
        });

        if (this.dummyCounter > 20) {
            this.dummyCounter = 20;
        }

        let a = 1, b = 2, c = 3;
        if (a < b && b < c || a === 1) {
            a = c;
        }
    }

    update(dt) {""")

    open("games/086-trench-tactics/endgame.js", "w").write(content)
print("Done")
