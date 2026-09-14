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
ROOT = pathlib.Path(__file__).resolve().parents[1]


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
    # This runs before page scripts. The old regression only started sampling at
    # DOMContentLoaded and therefore missed the exact owner-reported flash: the
    # cold-start barrier had already exposed legacy/V2 intermediate markup.
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {
            "source": r"""
(() => {
  window.__votonobayEarlyFrames = [];
  let lastSignature = '';
  const started = performance.now();
  const sample = () => {
    const html = document.documentElement;
    const app = document.getElementById('app');
    const style = app ? getComputedStyle(app) : null;
    const rect = app?.getBoundingClientRect();
    const hero = app?.querySelector('.v2-hero.v2-bay-first');
    const title = hero?.querySelector('.v2-hero-copy h1')?.innerText || '';
    const visible = !!app && !!rect && rect.width > 0 && rect.height > 0 && style?.display !== 'none' && style?.visibility !== 'hidden' && Number(style?.opacity || 1) > 0;
    const frame = {
      t: performance.now(),
      text: (app?.innerText || '').replace(/\s+/g,' ').slice(0,900),
      visible,
      boot: html?.dataset?.votonobayBoot || '',
      screen: app?.dataset?.screen || window.state?.screen || '',
      canonical: !!hero && hero.dataset.roxyApproved === '1' && title.includes('Спросить Бая'),
      title: title.replace(/\s+/g,' ').slice(0,180),
      bootCopy: html ? getComputedStyle(html,'::after').content : ''
    };
    const signature = JSON.stringify([frame.visible,frame.boot,frame.screen,frame.canonical,frame.title,frame.text.slice(0,180),frame.bootCopy]);
    if (signature !== lastSignature || performance.now() - started < 350) {
      window.__votonobayEarlyFrames.push(frame);
      lastSignature = signature;
    }
    if (performance.now() - started < 9000) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})();
"""
        },
    )


def set_slow_mobile_start(driver: webdriver.Chrome, enabled: bool) -> None:
    driver.execute_cdp_cmd("Network.enable", {})
    driver.execute_cdp_cmd("Network.setCacheDisabled", {"cacheDisabled": enabled})
    driver.execute_cdp_cmd(
        "Network.emulateNetworkConditions",
        {
            "offline": False,
            "latency": 90 if enabled else 0,
            "downloadThroughput": 4 * 1024 * 1024 if enabled else -1,
            "uploadThroughput": 1024 * 1024 if enabled else -1,
            "connectionType": "cellular4g" if enabled else "wifi",
        },
    )


def wait_home(driver: webdriver.Chrome) -> None:
    WebDriverWait(driver, 25).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
    WebDriverWait(driver, 25).until(
        lambda d: d.execute_script(
            "return window.state?.screen==='home' && "
            "document.documentElement.dataset.votonobayBoot==='ready' && "
            "!!document.querySelector('.v2-bay-first[data-roxy-approved=\"1\"]') && "
            "document.querySelector('.v2-bay-first .v2-hero-copy h1')?.innerText.includes('Спросить Бая')"
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

        # Reproduce the owner report under a deliberately slower Android-like
        # startup. Disable HTTP cache so a previous warm navigation cannot hide
        # a parser/module ordering race.
        if viewport.mobile:
            set_slow_mobile_start(driver, True)
        driver.get(BASE_URL + "?cold-start-regression=1")
        wait_home(driver)
        if viewport.mobile:
            set_slow_mobile_start(driver, False)
        time.sleep(0.12)

        snapshot = driver.execute_script(
            """
            const saved=JSON.parse(localStorage.getItem('td')||'{}');
            const hero=document.querySelector('.v2-bay-first');
            return {
              screen:window.state?.screen,
              boot:document.documentElement.dataset.votonobayBoot||'',
              homeVisible:!!hero,
              roxyApproved:hero?.dataset.roxyApproved||'',
              title:hero?.querySelector('.v2-hero-copy h1')?.innerText||'',
              saved,
              text:(document.getElementById('app')?.innerText||'').replace(/\s+/g,' ').slice(0,900),
              frames:window.__votonobayEarlyFrames||[]
            };
            """
        )
        if snapshot["screen"] != "home" or snapshot["boot"] != "ready" or not snapshot["homeVisible"] or snapshot["roxyApproved"] != "1" or "Спросить Бая" not in snapshot["title"]:
            failures.append(f"{label}: cold start did not settle on approved Roxy Home {snapshot}")
        saved = snapshot["saved"]
        if saved.get("city") != "spb" or saved.get("storeId") != "magnit" or saved.get("cart") != {"milk": 2, "banana": 1} or saved.get("address") != "Тестовый адрес":
            failures.append(f"{label}: cold-start guard damaged persisted shopping state {saved}")
        if saved.get("screen") != "home":
            failures.append(f"{label}: persisted route was not normalized to Home {saved}")

        visible_frames = [frame for frame in snapshot["frames"] if frame.get("visible")]
        premature = [frame for frame in visible_frames if not frame.get("canonical")]
        if premature:
            failures.append(f"{label}: app became visible before approved Roxy Home {premature[:4]}")
        legacy_words = ("Тамдешевле", "Там дешевле", "Где дешевле ваша корзина", "Покупки. Как лучше.", "Добавь товары в корзину", "Выбери, где обычно покупаешь")
        legacy_visible = [frame for frame in visible_frames if any(word in frame.get("text", "") for word in legacy_words)]
        if legacy_visible:
            failures.append(f"{label}: retired/intermediate UI became visible during cold start {legacy_visible[:4]}")
        if visible_frames and (not visible_frames[0].get("canonical") or "Спросить Бая" not in visible_frames[0].get("title", "")):
            failures.append(f"{label}: first visible app frame was not approved Roxy Home {visible_frames[0]}")

        pending_frames = [frame for frame in snapshot["frames"] if frame.get("boot") == "pending" and not frame.get("visible")]
        unbranded_pending = [frame for frame in pending_frames if "Votonobay" not in frame.get("bootCopy", "")]
        if pending_frames and unbranded_pending:
            failures.append(f"{label}: hidden startup showed an unbranded/blank boot surface {unbranded_pending[:4]}")

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


def static_contract(failures: list[str]) -> None:
    source = (ROOT / "votonobay-cold-start-v1.js").read_text(encoding="utf-8")
    roxy = (ROOT / "votonobay-roxy-home-v1.js").read_text(encoding="utf-8")
    if "setTimeout(release,1800)" in source:
        failures.append("source: legacy 1.8s fail-open still exposes intermediate UI")
    for token in ("td:roxy-home-ready", "canonicalHomeReady", "data-roxy-home-preload", "Votonobay · Бай готовит главную"):
        if token not in source:
            failures.append(f"source: cold-start canonical barrier token missing: {token}")
    for token in ("__TDRoxyHomeV1", "td:roxy-home-ready", "roxyHomeReady"):
        if token not in roxy:
            failures.append(f"source: Roxy Home readiness token missing: {token}")


def main() -> int:
    failures: list[str] = []
    static_contract(failures)
    for viewport in VIEWPORTS:
        run_viewport(viewport, failures)
    if failures:
        print("Cold-start Home QA failed:")
        for failure in failures:
            print("-", failure)
        return 1
    print("Cold-start Home QA passed on desktop and throttled Android: branded boot only until approved Roxy Home, no legacy/intermediate flash, shopping state preserved, account brand current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
