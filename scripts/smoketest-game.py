"""Game smoke test: title screen loads + click Start + playing frame renders."""
import asyncio
import time
from pathlib import Path
from playwright.async_api import async_playwright

URL = "http://localhost:5174/"
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
        await page.wait_for_timeout(2000)
        await page.screenshot(path=str(OUT_DIR / f"smoke-01-title-{TS}.png"))

        # Click roughly at the center (Start button area)
        await page.mouse.click(640, 360)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(OUT_DIR / f"smoke-02-playing-{TS}.png"))

        # Wait for some gameplay
        await page.wait_for_timeout(2000)
        await page.screenshot(path=str(OUT_DIR / f"smoke-03-playing-later-{TS}.png"))

        print("--- logs ---")
        errors = [l for l in logs if 'pageerror' in l or '[error]' in l.lower()]
        if errors:
            print("ERRORS DETECTED:")
            for l in errors:
                print(l)
        else:
            print("no errors")
        print(f"total logs: {len(logs)}")
        for l in logs[-10:]:
            print(l)
        await browser.close()


asyncio.run(main())
