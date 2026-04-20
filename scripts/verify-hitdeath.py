"""
Iter5 HitReact/Death 結線の動作検証:
  - プレイを開始し、敵の被弾〜撃破のタイミングで連続スクショを撮影
  - 敵が Death anim で 0.767s 残って倒れてから消えるはず
  - enemy 領域の差分をフレームごとに観測
"""
import asyncio
import hashlib
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
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(1200)
        await page.mouse.click(640, 360)
        await page.wait_for_timeout(1500)

        # 戦闘開始前後を広く連続キャプチャ（合計 ~6 秒）、敵撃破シーンを捕まえる
        print("=== HitReact / Death anim capture（2秒から 100ms 刻みで 40 枚） ===")
        hashes = []
        for i in range(40):
            png = await page.screenshot(type="png")
            path = OUT_DIR / f"hitdeath-{i:02d}-{TS}.png"
            path.write_bytes(png)
            hashes.append(hashlib.md5(png).hexdigest()[:10])
            await page.wait_for_timeout(100)

        print(f"captured {len(hashes)} frames, unique={len(set(hashes))}")
        if errors:
            print("ERRORS:", errors)
        await browser.close()


asyncio.run(main())
