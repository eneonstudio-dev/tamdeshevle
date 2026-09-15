#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")
SEARCH_BUTTON = ".v2-bottom-nav button[data-screen='catalog']"


def driver_for() -> webdriver.Chrome:
    options = Options()
    for arg in (
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=412,915",
        "--user-agent=Mozilla/5.0 (Linux; Android 13; SM-N986N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
    ):
        options.add_argument(arg)
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(412, 915)
    return driver


def visible(driver: webdriver.Chrome, selector: str) -> bool:
    return bool(
        driver.execute_script(
            """
            return [...document.querySelectorAll(arguments[0])].some(el=>{
              const r=el.getBoundingClientRect(),s=getComputedStyle(el);
              return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
            });
            """,
            selector,
        )
    )


def diagnostics(driver: webdriver.Chrome) -> dict:
    return driver.execute_script(
        """
        const buttons=[...document.querySelectorAll(arguments[0])];
        const button=buttons.find(el=>{
          const r=el.getBoundingClientRect(),s=getComputedStyle(el);
          return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
        })||buttons[0]||null;
        const r=button?.getBoundingClientRect();
        const x=r?r.left+r.width/2:0,y=r?r.top+r.height/2:0;
        const top=r?document.elementFromPoint(x,y):null;
        const docks=[...document.querySelectorAll('.v2-bottom-nav')].map(el=>{
          const q=el.getBoundingClientRect(),s=getComputedStyle(el);
          return {visible:q.width>0&&q.height>0&&s.display!=='none'&&s.visibility!=='hidden',left:q.left,right:q.right,top:q.top,bottom:q.bottom,z:s.zIndex,pointerEvents:s.pointerEvents};
        });
        return {
          screen:window.state?.screen||null,
          button:button&&r?{text:(button.textContent||'').trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:r.width,h:r.height,onclick:button.getAttribute('onclick'),screen:button.dataset.screen,className:button.className,ariaCurrent:button.getAttribute('aria-current')} : null,
          centerTop:top?{tag:top.tagName,className:top.className||'',text:(top.textContent||'').trim().slice(0,80),sameButton:top===button,insideButton:button?button.contains(top):false}:null,
          docks,
          catalogSearchVisible:[...document.querySelectorAll('.voto-catalog-search')].some(el=>{const q=el.getBoundingClientRect(),s=getComputedStyle(el);return q.width>0&&q.height>0&&s.display!=='none'&&s.visibility!=='hidden';}),
          activeSearch:[...document.querySelectorAll(arguments[0])].some(el=>el.classList.contains('is-active')&&el.getAttribute('aria-current')==='page')
        };
        """,
        SEARCH_BUTTON,
    )


def main() -> int:
    driver = driver_for()
    failures: list[str] = []
    try:
        driver.get(BASE_URL)
        WebDriverWait(driver, 20).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
            and d.execute_script("return !!window.state && typeof window.render==='function'")
        )
        WebDriverWait(driver, 20).until(lambda d: visible(d, SEARCH_BUTTON))
        before = diagnostics(driver)
        if before["screen"] != "home":
            failures.append(f"expected Home before physical Search tap: {before}")
        if not before.get("button"):
            failures.append(f"visible Search button missing: {before}")
        elif before["button"]["h"] < 43.5:
            failures.append(f"Search touch target is too short: {before}")
        if before.get("centerTop") and not before["centerTop"].get("insideButton"):
            failures.append(f"Search center is intercepted before click: {before}")

        if not failures:
            button = next(el for el in driver.find_elements(By.CSS_SELECTOR, SEARCH_BUTTON) if el.is_displayed())
            try:
                button.click()
            except WebDriverException as exc:
                failures.append(f"physical Search click failed: {exc}; diagnostics={diagnostics(driver)}")

        if not failures:
            WebDriverWait(driver, 10).until(
                lambda d: d.execute_script("return window.state?.screen") == "catalog"
            )
            WebDriverWait(driver, 10).until(lambda d: visible(d, ".voto-catalog-search"))
            WebDriverWait(driver, 10).until(
                lambda d: bool(
                    d.execute_script(
                        """
                        return [...document.querySelectorAll(arguments[0])].some(el=>{
                          const r=el.getBoundingClientRect(),s=getComputedStyle(el);
                          return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&el.classList.contains('is-active')&&el.getAttribute('aria-current')==='page';
                        });
                        """,
                        SEARCH_BUTTON,
                    )
                )
            )
            after = diagnostics(driver)
            if after["screen"] != "catalog" or not after["catalogSearchVisible"] or not after["activeSearch"]:
                failures.append(f"physical Search tap did not settle into canonical Catalog state: {after}")

    except Exception as exc:
        failures.append(f"mobile Search tap regression raised: {exc}; diagnostics={diagnostics(driver)}")
    finally:
        driver.quit()

    if failures:
        print("Mobile Search physical-tap QA failed:")
        for failure in failures:
            print("-", failure)
        return 1
    print("Visible mobile Search button accepts a physical tap and opens canonical Catalog with active dock state.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
