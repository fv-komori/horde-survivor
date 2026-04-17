"""HitReact/Death 発火ログを console から拾って、実際に playDeath が呼ばれているか確認。"""
import asyncio
import time
from playwright.async_api import async_playwright

URL = "http://localhost:5178/"


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        logs = []
        page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: logs.append(f"[pageerror] {err}"))

        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(1200)
        await page.mouse.click(640, 360)
        await page.wait_for_timeout(15000)

        death_logs = [l for l in logs if 'playDeath' in l or 'ANIM' in l or 'DEATH' in l or 'HIT' in l]
        print(f"[ANIM] log count: {len(death_logs)}")
        for l in death_logs:
            print(l)
        errors = [l for l in logs if 'pageerror' in l or '[error]' in l.lower()]
        if errors:
            print("\nERRORS:", errors)
        await browser.close()


asyncio.run(main())
