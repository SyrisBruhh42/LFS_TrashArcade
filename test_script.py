from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # Absolute path to the index.html
    filepath = f"file:///app/games/036-gothic-drill-sacrifice/index.html"
    page.goto(filepath)
    page.wait_for_timeout(1000)

    # Click Play
    page.get_by_role("button", name="Play", exact=True).click()
    page.wait_for_timeout(1000)

    # Wait for the game to start and the canvas to render
    page.wait_for_timeout(2000)

    # Press Space to trigger Overdrive
    page.keyboard.press("Space")
    page.wait_for_timeout(1000)

    # Take a screenshot while playing
    page.screenshot(path="/tmp/pw/screenshots/playing.png")

    # Pause the game
    page.get_by_role("button", name="II").click()
    page.wait_for_timeout(1000)

    # Take a screenshot while paused
    page.screenshot(path="/tmp/pw/screenshots/paused.png")

if __name__ == "__main__":
    os.makedirs("/tmp/pw/screenshots", exist_ok=True)
    os.makedirs("/tmp/pw/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/tmp/pw/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
