#!/usr/bin/env python3
"""Real-browser regression for cold-start route flashes and legacy account branding."""
from __future__ import annotations

import os
import pathlib
import time
from dataclasses import dataclass

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")
OUT = pathlib.Path(os.environ.get("TD_UX_OUT_DIR", "artifacts/ux-browser"))
OUT.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Viewport:
    name: str
    width: int
    height: int
    mobile: bool


VIEWPORTS = (
    Viewport("desktop", 1440, 1000, False),
    Viewport("android", 412, 915, True),
)


def driver_for(viewport: Viewport) -> webdriver.Chrome:
    options = Options()
    for arg in (
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--window-size={viewport.width},{viewport.height}",
    ):
        options.add_argument(arg)
    if viewport.mobile:
        options.add_argument(
            "--user-agent=Mozilla/5.0 (Linux; Android 13; SM-N986N) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
        )
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(viewport.width, viewport.height)
    return driver


def install_early_frame_probe(driver: webdriver.Chrome) -> None:
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {
            "source": r"""
(() => {
  window.__votonobayEarlyFrames = [];
  const sample = () => {
    const app = document.getElementById('app');
    const style = app ? getComputedStyle(app) : null;
    const rect = app?.getBoundingClientRect();
    window.__votonobayEarlyFrames.push({
      t: performance.now(),
      text: (app?.innerText || '').replace(/\s+/g,' ').slice(0,600),
      visible: !!app && !!rect && rect.width > 0 && rect.height > 0 && style?.display !== 'none' && style?.visibility !== 'hidden' && Number(style?.opacity || 1) > 0,
      boot: document.documentElement.dataset.votonobayBoot || '',
      screen: app?.dataset.screen || ''
    });
    if (performance.now() < 2200) requestAnimationFrame(sample);
  };
  addEventListener('DOMContentLoaded', () => requestAnimationFrame(sample), {once:true});
})();
"""
        },
    )


def wait_home(driver: webdriver.Chrome) -> None:
    WebDriverWait(driver, 20).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
    WebDriverWait(driver, 20).until(
        lambda d: d.execute_script(
            "return window.state?.screen==='home' && "
            "document.documentElement.dataset.votonobayBoot==='ready' && "
            "!!document.querySelector('.v2-bay-first')"
        )
    )
    driver.execute_script(
        "return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))"
    )


def run_viewport(viewport: Viewport, failures: list[str]) -> None:
    driver = driver_for(viewport)
    label = viewport.name
    try:
        install_early_frame_probe(driver)
        driver.get(BASE_URL)
        WebDriverWait(driver, 20).until(lambda d: d.execute_script("return !!window.state"))
        driver.execute_script(
            """
            localStorage.setItem('td', JSON.stringify({
              screen:'catalog', city:'spb', storeId:'magnit', cart:{milk:2,banana:1},
              cartTouched:true, address:'Тестовый адрес'
            }));
            """
        )

        # Reproduce the user report: a hard site opening with a previously saved
        # catalog route must not paint that catalog before Bay-first Home appears.
        driver.get(BASE_URL + "?cold-start-regression=1")
        wait_home(driver)
        time.sleep(0.12)

        snapshot = driver.execute_script(
            """
            const saved=JSON.parse(localStorage.getItem('td')||'{}');
            return {
              screen:window.state?.screen,
              boot:document.documentElement.dataset.votonobayBoot||'',
              homeVisible:!!document.querySelector('.v2-bay-first'),
              saved,
              text:(document.getElementById('app')?.innerText||'').replace(/\s+/g,' ').slice(0,900),
              frames:window.__votonobayEarlyFrames||[]
            };
            """
        )
        if snapshot["screen"] != "home" or snapshot["boot"] != "ready" or not snapshot["homeVisible"]:
            failures.append(f"{label}: cold start did not settle on Home {snapshot}")
        saved = snapshot["saved"]
        if saved.get("city") != "spb" or saved.get("storeId") != "magnit" or saved.get("cart") != {"milk": 2, "banana": 1} or saved.get("address") != "Тестовый адрес":
            failures.append(f"{label}: cold-start guard damaged persisted shopping state {saved}")
        if saved.get("screen") != "home":
            failures.append(f"{label}: persisted route was not normalized to Home {saved}")

        wrong_visible = [
            frame for frame in snapshot["frames"]
            if frame.get("visible") and (
                "Добавь товары в корзину" in frame.get("text", "")
                or "Выбери, где обычно покупаешь" in frame.get("text", "")
                or ("Магнит" in frame.get("text", "") and "Спросить Бая" not in frame.get("text", ""))
            )
        ]
        if wrong_visible:
            failures.append(f"{label}: legacy catalog/store frame became visible during cold start {wrong_visible[:4]}")
        visible_frames = [frame for frame in snapshot["frames"] if frame.get("visible")]
        if visible_frames and "Спросить Бая" not in visible_frames[0].get("text", ""):
            failures.append(f"{label}: first visible app frame was not Bay-first Home {visible_frames[0]}")

        driver.save_screenshot(str(OUT / f"{label}-cold-start-home.png"))

        # The screenshots supplied by the owner exposed retired naming inside
        # Account / Savings / Settings. Assert the late dialog is clean too.
        WebDriverWait(driver, 10).until(lambda d: d.execute_script("return !!window.TDAccountHub"))
        driver.execute_script("window.TDAccountHub.open(1)")
        WebDriverWait(driver, 10).until(lambda d: d.execute_script("return !!document.querySelector('.td-account')"))
        account_text = driver.execute_script("return document.querySelector('.td-account')?.innerText||''")
        if "Там дешевле" in account_text or "Тамдешевле" in account_text:
            failures.append(f"{label}: retired brand remains visible in account hub {account_text[:500]!r}")
        if "Сэкономлено с Votonobay" not in account_text or "Подписка Votonobay Plus" not in account_text:
            failures.append(f"{label}: current Votonobay account copy missing {account_text[:700]!r}")
        driver.save_screenshot(str(OUT / f"{label}-account-brand.png"))
    except Exception as exc:
        failures.append(f"{label}: cold-start QA crashed: {type(exc).__name__}: {exc}")
        try:
            driver.save_screenshot(str(OUT / f"{label}-cold-start-failure.png"))
        except Exception:
            pass
    finally:
        driver.quit()


def main() -> int:
    failures: list[str] = []
    for viewport in VIEWPORTS:
        run_viewport(viewport, failures)
    if failures:
        print("Cold-start Home QA failed:")
        for failure in failures:
            print("-", failure)
        return 1
    print("Cold-start Home QA passed on desktop and Android: no saved catalog flash, shopping state preserved, account brand current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
