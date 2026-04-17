"""
Iter5 animation verification:
1) ゲーム内のキャラについて一定間隔で連続スクショを撮影
2) フレーム毎の画像差分（pixel diff hash）で「ポーズ変化があるか＝アニメが再生されているか」を判定

Idle: 1.367s cycle, Run: 0.667s cycle。150ms 刻みで 8 枚 = 1.05s 幅。
この範囲で差分ゼロなら静止（アニメ未再生）、差分あればアニメ再生中と判定。
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


def md5_bytes(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()[:12]


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

        # Start
        await page.mouse.click(640, 360)
        await page.wait_for_timeout(800)

        # Let game settle + enemies spawn
        await page.wait_for_timeout(1500)

        print("=== Animation frame test (player + enemies on screen) ===")
        hashes = []
        for i in range(10):
            png = await page.screenshot(type="png")
            path = OUT_DIR / f"anim-{i:02d}-{TS}.png"
            path.write_bytes(png)
            h = md5_bytes(png)
            hashes.append(h)
            print(f"  frame {i:02d} hash={h}")
            await page.wait_for_timeout(150)

        unique = len(set(hashes))
        print(f"\nunique frames: {unique}/{len(hashes)}")
        if unique >= 5:
            print("=> PASS: ポーズ/シーンに大きな変化あり（アニメ or エンティティ移動が動作）")
        elif unique >= 2:
            print("=> PARTIAL: 一部変化あり（HUD/背景のみの可能性も）")
        else:
            print("=> FAIL: 全フレーム同一（アニメ停止の疑い）")

        errors = [l for l in logs if 'pageerror' in l or '[error]' in l.lower()]
        if errors:
            print("\nERRORS:")
            for l in errors: print(l)
        await browser.close()


asyncio.run(main())
