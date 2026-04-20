"""
プレイヤーが静止している間に「プレイヤー領域（画面下中央の正方形）」だけを連続キャプチャし、
フレーム間のpixel hashを比較することで Idle アニメーションが実際に再生されているかを検証する。

Player は VelocityComponent を持たないので velocity は常に 0 → Idle anim が理論上再生されるはず。
Idle は 1.367s cycle。150ms 刻み × 8 枚 = 1.05s 幅でポーズが変化していれば再生中、
全フレーム同一なら AnimationSystem が動いていない疑い。
"""
import asyncio
import hashlib
import time
from pathlib import Path
from playwright.async_api import async_playwright

URL = "http://localhost:5177/"
OUT_DIR = Path(".playwright-screenshots")
OUT_DIR.mkdir(exist_ok=True)
TS = time.strftime("%Y%m%d-%H%M%S")

# プレイヤーは画面下中央に描画される（1280x720 の下半分、中央 x=520-760, y=470-720 付近）
PLAYER_CLIP = {"x": 520, "y": 470, "width": 240, "height": 250}


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

        print("=== Player-only region diff（velocity=0 なので Idle anim 前提） ===")
        hashes = []
        for i in range(10):
            png = await page.screenshot(type="png", clip=PLAYER_CLIP)
            h = hashlib.md5(png).hexdigest()[:10]
            hashes.append(h)
            (OUT_DIR / f"anim-player-{i:02d}-{TS}.png").write_bytes(png)
            print(f"  frame {i:02d} (+{i*150}ms) hash={h}")
            await page.wait_for_timeout(150)

        unique = len(set(hashes))
        print(f"\nunique frames: {unique}/{len(hashes)}")
        if unique >= 5:
            print("=> ✅ プレイヤー領域が変化 → Idle animation 再生中と判断")
        elif unique == 1:
            print("=> ❌ 全フレーム完全同一 → animation 停止の疑い（AnimationSystem 要調査）")
        else:
            print("=> △ 部分的変化のみ → 要目視確認")

        if errors:
            print("\nERRORS:", errors)
        await browser.close()


asyncio.run(main())
