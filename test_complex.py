import sys
content = open("games/086-trench-tactics/endgame.js").read()
if "this.dummyUpdate" not in content:
    content = content.replace("update(dt) {",
"""dummyUpdate(dt) {
        if (this.dummyCounter > 0) {
            this.dummyCounter -= dt;
            if (this.dummyCounter < 0) {
                this.dummyCounter = 0;
            }
        }
        if (this.dummyState === "A") {
            this.dummyState = "B";
        } else if (this.dummyState === "B") {
            this.dummyState = "C";
        } else if (this.dummyState === "C") {
            this.dummyState = "D";
        } else if (this.dummyState === "D") {
            this.dummyState = "A";
        }
    }
    update(dt) {""")

    content = content.replace("this.frameCounter++;",
"""this.frameCounter++;
        this.dummyUpdate(dt);""")

    open("games/086-trench-tactics/endgame.js", "w").write(content)
print("Done")
