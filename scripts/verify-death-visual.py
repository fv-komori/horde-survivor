"""
Death anim の可視検証: 15秒プレイで確実に撃破が発生する条件で、
撃破直後の 0.767s 分（~8 フレーム @ 100ms）を連続キャプチャ。
ログから撃破タイミングを検知して前後 1 秒分をマークする。
"""
import asyncio
import time
from pathlib import Path
from playwright.async_api import async_playwright

URL = "http://localhost:5178/"
OUT_DIR = Path(".playwright-screenshots")
OUT_DIR.mkdir(exist_ok=True)
TS = time.strftime("%Y%m%d-%H%M%S")


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        death_frames: list[int] = []
        logs: list[str] = []

        def on_console(msg):
            text = msg.text
            logs.append(text)
            if 'playDeath' in text:
                death_frames.append(len(captures))

        captures: list[bytes] = []
        page.on("console", on_console)

        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(1200)
        await page.mouse.click(640, 360)
        await page.wait_for_timeout(1000)

        # 150 frames @ 100ms = 15 秒分キャプチャ。撃破発生タイミングの index を記録
        for i in range(150):
            png = await page.screenshot(type="png")
            captures.append(png)
            await page.wait_for_timeout(100)

        print(f"captured {len(captures)} frames. death events at frames: {death_frames}")
        for i in death_frames:
            # 撃破前後 ±5 フレーム (±500ms) を保存
            start = max(0, i - 2)
            end = min(len(captures), i + 10)
            for j in range(start, end):
                p = OUT_DIR / f"dv-kill{i:03d}-fr{j:03d}-{TS}.png"
                p.write_bytes(captures[j])
            print(f"  saved kill {i}: frames {start}..{end-1}")

        await browser.close()


asyncio.run(main())
