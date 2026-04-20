"""Iter5 動作確認: タイトル→プレイ→時間経過でアニメ・敵撃破・仲間生成を目視する。"""
import asyncio
import time
from pathlib import Path
from playwright.async_api import async_playwright

URL = "http://localhost:5176/"
OUT_DIR = Path(".playwright-screenshots")
OUT_DIR.mkdir(exist_ok=True)
TS = time.strftime("%Y%m%d-%H%M%S")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        logs = []
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: logs.append(f"[pageerror] {err}"))

        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(OUT_DIR / f"verify-01-title-{TS}.png"))

        # Start game
        await page.mouse.click(640, 360)
        await page.wait_for_timeout(800)
        await page.screenshot(path=str(OUT_DIR / f"verify-02-play-early-{TS}.png"))

        # Wait for combat
        for i, delay in enumerate([1500, 2000, 2500, 2000, 2000], start=3):
            await page.wait_for_timeout(delay)
            await page.screenshot(path=str(OUT_DIR / f"verify-{i:02d}-play-t{i-2}-{TS}.png"))

        # Drag player to move (check Run anim transition)
        await page.mouse.move(640, 500)
        await page.mouse.down()
        await page.mouse.move(300, 500, steps=10)
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT_DIR / f"verify-08-moving-{TS}.png"))
        await page.mouse.move(900, 500, steps=10)
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT_DIR / f"verify-09-moving2-{TS}.png"))
        await page.mouse.up()

        # Longer gameplay
        await page.wait_for_timeout(3000)
        await page.screenshot(path=str(OUT_DIR / f"verify-10-extended-{TS}.png"))

        print("--- logs ---")
        errors = [l for l in logs if 'pageerror' in l or '[error]' in l.lower()]
        if errors:
            print("ERRORS:")
            for l in errors: print(l)
        else:
            print("no errors")
        print(f"total logs: {len(logs)}")
        warnings = [l for l in logs if '[warning]' in l.lower() and 'WebGL' not in l]
        for l in warnings[:15]:
            print(l)
        await browser.close()


asyncio.run(main())
