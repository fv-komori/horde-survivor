"""
Iter5 PoC: 反転ハルOutlineの目視検証スクリプト
Character_Soldier を GLTF ロード → Run / Walk / Idle / HitReact のタイミングで
Outline ON / OFF 両方の画面をキャプチャし、skinning 追随を目視比較する。
"""
import asyncio
import time
from pathlib import Path
from playwright.async_api import async_playwright

URL = "http://localhost:5174/poc-outline.html"
OUT_DIR = Path(".playwright-screenshots")
OUT_DIR.mkdir(exist_ok=True)
TS = time.strftime("%Y%m%d-%H%M%S")


async def capture(page, name: str, delay_ms: int = 0):
    if delay_ms:
        await page.wait_for_timeout(delay_ms)
    path = OUT_DIR / f"poc-outline-{name}-{TS}.png"
    await page.screenshot(path=str(path), type="png")
    print(f"saved {path}")
    return path


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await ctx.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_logs.append(f"[pageerror] {err}"))

        await page.goto(URL, wait_until="networkidle")

        # wait for GLTF load + initial Run anim to be playing
        await page.wait_for_timeout(2000)

        # Read status text for sanity
        status = await page.text_content("#status")
        print(f"status after load: {status}")

        # Capture Run anim, outline ON
        await capture(page, "01-run-outline-on")

        # Toggle outline OFF
        await page.keyboard.press("o")
        await page.wait_for_timeout(200)
        await capture(page, "02-run-outline-off")

        # Toggle back ON
        await page.keyboard.press("o")
        await page.wait_for_timeout(200)
        await capture(page, "03-run-outline-on-again")

        # Cycle to a couple of animations and capture mid-animation frames.
        # Clip order from Character_Soldier (Day1-2 investigation): Death Duck HitReact Idle Idle_Shoot Jump Jump_Idle Jump_Land No Punch Run Run_Gun Run_Shoot Walk Walk_Shoot Wave Yes
        # Starting index = Run (10), so Space advances to Run_Gun.
        for i, label in enumerate(["run_gun", "run_shoot", "walk", "walk_shoot", "wave", "yes", "death"], start=1):
            await page.keyboard.press("Space")
            await page.wait_for_timeout(350)  # let a fraction of the clip play
            await capture(page, f"04-{i:02d}-{label}")

        # Thickness tweak: thicker outline
        for _ in range(4):
            await page.keyboard.press("=")  # +
        await page.wait_for_timeout(200)
        await capture(page, "05-thick-outline")

        # Thin outline
        for _ in range(10):
            await page.keyboard.press("-")
        await page.wait_for_timeout(200)
        await capture(page, "06-thin-outline")

        print("--- console/page logs ---")
        for line in console_logs[-60:]:
            print(line)

        await browser.close()


asyncio.run(main())
