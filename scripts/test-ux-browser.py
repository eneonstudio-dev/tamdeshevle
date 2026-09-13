#!/usr/bin/env python3
"""Real-browser UX smoke QA for Votonobay.

Runs the static app in Chrome, walks the primary purchase journey on desktop and
mobile-sized viewports, checks for horizontal overflow and undersized core touch
targets, locks late injected surfaces into the dark Votonobay system, and saves
screenshots for human review.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import time
from dataclasses import dataclass

from selenium import webdriver
from selenium.common.exceptions import JavascriptException, TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")
OUT_DIR = pathlib.Path(os.environ.get("TD_UX_OUT_DIR", "artifacts/ux-browser"))
OUT_DIR.mkdir(parents=True, exist_ok=True)


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

SCREENS = ("home", "stores", "catalog", "cart", "compare")


def chrome_driver(viewport: Viewport) -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--hide-scrollbars")
    options.add_argument("--force-device-scale-factor=1")
    options.add_argument(f"--window-size={viewport.width},{viewport.height}")
    if viewport.mobile:
        options.add_argument(
            "--user-agent=Mozilla/5.0 (Linux; Android 13; SM-N986N) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
        )
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(viewport.width, viewport.height)
    return driver


def wait_ready(driver: webdriver.Chrome) -> None:
    WebDriverWait(driver, 20).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
    WebDriverWait(driver, 20).until(
        lambda d: d.execute_script("return !!window.state && typeof window.render === 'function'")
    )
    driver.execute_script(
        """
        if (!document.querySelector('style[data-td-qa-motion]')) {
          const style = document.createElement('style');
          style.dataset.tdQaMotion = '1';
          style.textContent = '*{animation:none!important;transition:none!important;scroll-behavior:auto!important}';
          document.head.appendChild(style);
        }
        """
    )


def seed_cart(driver: webdriver.Chrome) -> None:
    driver.execute_script(
        """
        state.storeId = 'pyat';
        state.cart = { milk: 1, bread: 1, chicken: 1, banana: 1 };
        state.cartTouched = true;
        state.q = '';
        window.render();
        """
    )
    time.sleep(0.15)


def go(driver: webdriver.Chrome, screen: str) -> None:
    if screen in {"cart", "compare"}:
        seed_cart(driver)
    if screen == "catalog":
        driver.execute_script("state.storeId='pyat'; state.q='';")
    driver.execute_script("window.go(arguments[0])", screen)
    WebDriverWait(driver, 10).until(
        lambda d: d.execute_script("return window.state && state.screen") == screen
    )
    driver.execute_script("return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    time.sleep(0.10)


def visible_count(driver: webdriver.Chrome, selector: str) -> int:
    return int(
        driver.execute_script(
            """
            return [...document.querySelectorAll(arguments[0])].filter(el => {
              const r = el.getBoundingClientRect();
              const s = getComputedStyle(el);
              return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
            }).length;
            """,
            selector,
        )
    )


def assert_no_horizontal_overflow(driver: webdriver.Chrome, label: str, failures: list[str]) -> None:
    metrics = driver.execute_script(
        """
        const de = document.documentElement;
        const b = document.body;
        return {
          innerWidth: window.innerWidth,
          docWidth: de.scrollWidth,
          bodyWidth: b ? b.scrollWidth : 0,
          offenders: [...document.querySelectorAll('body *')].map(el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return {tag:el.tagName, cls:el.className || '', left:r.left, right:r.right, width:r.width, display:s.display, pos:s.position};
          }).filter(x => x.width > 0 && x.display !== 'none' && (x.right > window.innerWidth + 2 || x.left < -2)).slice(0, 12)
        };
        """
    )
    if metrics["docWidth"] > metrics["innerWidth"] + 2 or metrics["bodyWidth"] > metrics["innerWidth"] + 2:
        failures.append(f"{label}: horizontal overflow {json.dumps(metrics, ensure_ascii=False)}")


def assert_required_surface(driver: webdriver.Chrome, screen: str, label: str, failures: list[str]) -> None:
    selectors = {
        "home": ".v2-bay-first, .bai-assistant, main, #app",
        "stores": ".voto-store-choice, .wrap > .store",
        "catalog": ".voto-product-card, .products > .item",
        "cart": ".voto-cart-item, .wrap > .item",
        "compare": ".td-compare-v2, .voto-decision-lead, .v2-verdict, .plan",
    }
    selector = selectors[screen]
    if visible_count(driver, selector) == 0:
        failures.append(f"{label}: missing visible surface for {screen}: {selector}")


def assert_core_touch_targets(driver: webdriver.Chrome, screen: str, label: str, failures: list[str]) -> None:
    selectors = {
        "stores": [".voto-store-choice", ".td-geo-card button", "header.app .td-profile-btn", "header.app .city"],
        "catalog": [".voto-product-card .step button", ".voto-catalog-search", "header.app .td-profile-btn", "header.app .city"],
        "cart": [".voto-cart-item .step button", ".voto-cart-primary", "header.app .td-profile-btn", "header.app .city"],
        "compare": [".toggle button", ".voto-decision-lead > button", ".td-compare-hero-actions button", ".td-compare-plan button", "header.app .td-profile-btn", "header.app .city"],
    }.get(screen, [])
    for selector in selectors:
        rows = driver.execute_script(
            """
            return [...document.querySelectorAll(arguments[0])].filter(el => {
              const r=el.getBoundingClientRect(), s=getComputedStyle(el);
              return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
            }).map(el => {const r=el.getBoundingClientRect(); return {w:r.width,h:r.height,text:(el.textContent||'').trim().slice(0,48)}});
            """,
            selector,
        )
        for row in rows:
            if row["h"] < 43.5:
                failures.append(f"{label}: touch target too short {selector} {row}")


def assert_key_elements_in_viewport(driver: webdriver.Chrome, screen: str, label: str, failures: list[str]) -> None:
    selectors = {
        "stores": [".voto-store-choice", ".td-geo-card", "header.app .td-profile-btn", "header.app .city"],
        "catalog": [".voto-catalog-search", ".voto-product-card", "header.app .td-profile-btn", "header.app .city"],
        "cart": [".voto-cart-summary", ".voto-cart-primary", "header.app .td-profile-btn", "header.app .city"],
        "compare": [".voto-decision-lead", ".td-compare-hero", ".toggle", "header.app .td-profile-btn", "header.app .city"],
    }.get(screen, [])
    for selector in selectors:
        bad = driver.execute_script(
            """
            return [...document.querySelectorAll(arguments[0])].filter(el => {
              const r=el.getBoundingClientRect(), s=getComputedStyle(el);
              if (!(r.width>0 && r.height>0) || s.display==='none' || s.visibility==='hidden') return false;
              return r.left < -2 || r.right > window.innerWidth + 2;
            }).slice(0,8).map(el => {const r=el.getBoundingClientRect(); return {text:(el.textContent||'').trim().slice(0,60),left:r.left,right:r.right,width:r.width}});
            """,
            selector,
        )
        if bad:
            failures.append(f"{label}: key element leaves viewport {selector}: {bad}")


def assert_not_legacy_white(driver: webdriver.Chrome, selector: str, label: str, failures: list[str]) -> None:
    style = driver.execute_script(
        """
        const el=document.querySelector(arguments[0]);
        if(!el)return null;
        const s=getComputedStyle(el);
        return {backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,color:s.color};
        """,
        selector,
    )
    if not style:
        failures.append(f"{label}: missing themed surface {selector}")
        return
    if style["backgroundColor"] in {"rgb(255, 255, 255)", "rgba(255, 255, 255, 1)"} and style["backgroundImage"] == "none":
        failures.append(f"{label}: legacy white island remains on {selector}: {style}")


def screenshot(driver: webdriver.Chrome, viewport: Viewport, screen: str) -> None:
    path = OUT_DIR / f"{viewport.name}-{screen}.png"
    driver.save_screenshot(str(path))


def profile_qa(driver: webdriver.Chrome, viewport: Viewport, failures: list[str]) -> None:
    go(driver, "stores")
    WebDriverWait(driver, 10).until(lambda d: visible_count(d, "header.app .td-profile-btn") > 0)
    assert_not_legacy_white(driver, "header.app .td-profile-btn", f"{viewport.name}/header", failures)
    assert_not_legacy_white(driver, ".td-geo-card", f"{viewport.name}/stores", failures)
    driver.execute_script("document.querySelector('header.app .td-profile-btn').click()")
    WebDriverWait(driver, 10).until(lambda d: visible_count(d, ".td-account") > 0)
    assert_not_legacy_white(driver, ".td-account", f"{viewport.name}/account", failures)
    assert_no_horizontal_overflow(driver, f"{viewport.name}/account", failures)
    screenshot(driver, viewport, "account")
    driver.execute_script("window.TDAccountHub && TDAccountHub.close()")


def run_viewport(viewport: Viewport, failures: list[str]) -> None:
    driver = chrome_driver(viewport)
    try:
        driver.get(BASE_URL)
        wait_ready(driver)
        driver.execute_script("localStorage.clear();")
        driver.refresh()
        wait_ready(driver)

        for screen in SCREENS:
            label = f"{viewport.name}/{screen}"
            go(driver, screen)
            assert_required_surface(driver, screen, label, failures)
            assert_no_horizontal_overflow(driver, label, failures)
            assert_key_elements_in_viewport(driver, screen, label, failures)
            if screen == "stores":
                assert_not_legacy_white(driver, ".td-geo-card", label, failures)
                assert_not_legacy_white(driver, "header.app .td-profile-btn", label, failures)
            if viewport.mobile:
                assert_core_touch_targets(driver, screen, label, failures)
            screenshot(driver, viewport, screen)

        profile_qa(driver, viewport, failures)
    except (TimeoutException, JavascriptException) as exc:
        failures.append(f"{viewport.name}: browser automation failed: {exc}")
        try:
            screenshot(driver, viewport, "failure")
        except Exception:
            pass
    finally:
        driver.quit()


def main() -> int:
    failures: list[str] = []
    for viewport in VIEWPORTS:
        run_viewport(viewport, failures)

    report = {
        "base_url": BASE_URL,
        "screens": list(SCREENS) + ["account"],
        "viewports": [viewport.__dict__ for viewport in VIEWPORTS],
        "failures": failures,
    }
    (OUT_DIR / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    if failures:
        print("UX browser QA failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("UX browser QA passed on desktop and Android-sized viewports.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
