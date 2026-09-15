#!/usr/bin/env python3
from __future__ import annotations

import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")


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


def shell_metrics(driver: webdriver.Chrome) -> dict:
    return driver.execute_script(
        """
        const root=document.querySelector('body > .td-ai[data-roxy-bay-panel="1"]');
        const shell=root?.querySelector('.td-ai-shell');
        const handle=root?.querySelector('.roxy-bay-sheet-handle');
        const s=shell?.getBoundingClientRect(),h=handle?.getBoundingClientRect();
        return {
          expanded:root?.dataset.roxyBayExpanded||'',
          shellHeight:s?.height||0,
          viewportHeight:window.innerHeight,
          handleVisible:!!handle && getComputedStyle(handle).display!=='none',
          handleWidth:h?.width||0,
          handleHeight:h?.height||0,
          ariaExpanded:handle?.getAttribute('aria-expanded')||'',
          ariaLabel:handle?.getAttribute('aria-label')||'',
          horizontalOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth
        };
        """
    )


def wait_or_explain(driver: webdriver.Chrome, seconds: int, label: str, predicate) -> None:
    try:
        WebDriverWait(driver, seconds).until(predicate)
    except Exception as exc:
        raise AssertionError(f"{label} timed out; shell={shell_metrics(driver)}") from exc


def compact(metrics: dict) -> bool:
    return (
        metrics["expanded"] == "0"
        and metrics["ariaExpanded"] == "false"
        and metrics["shellHeight"] <= metrics["viewportHeight"] * 0.55
    )


def main() -> int:
    driver = driver_for()
    failures: list[str] = []
    try:
        driver.get(BASE_URL)
        WebDriverWait(driver, 20).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
        )
        WebDriverWait(driver, 20).until(
            lambda d: d.execute_script(
                "return !!window.TDShoppingAssistant && !!window.TDRoxyBayPanel"
            )
        )
        driver.execute_script("window.TDShoppingAssistant.open()")
        WebDriverWait(driver, 10).until(
            lambda d: d.execute_script(
                "return !!document.querySelector('body > .td-ai[data-roxy-bay-panel=\"1\"] .roxy-bay-sheet-handle')"
            )
        )
        driver.execute_script(
            """
            document.querySelector('body > .td-ai textarea')?.blur();
            document.body.removeAttribute('data-td-keyboard-open');
            const root=document.querySelector('body > .td-ai');
            window.TDRoxyBayPanel.setExpanded(root,false);
            """
        )

        wait_or_explain(driver, 5, "initial collapse", lambda d: compact(shell_metrics(d)))
        collapsed = shell_metrics(driver)
        if not collapsed["handleVisible"]:
            failures.append(f"mobile sheet handle is not visible: {collapsed}")
        if collapsed["handleWidth"] < 70 or collapsed["handleHeight"] < 43.5:
            failures.append(f"mobile sheet handle touch target is too small: {collapsed}")
        if not compact(collapsed):
            failures.append(f"collapsed semantics/geometry are wrong: {collapsed}")
        if collapsed["horizontalOverflow"] > 1:
            failures.append(f"collapsed mini-Bay causes horizontal overflow: {collapsed}")

        driver.find_element(By.CSS_SELECTOR, ".roxy-bay-sheet-handle").click()
        wait_or_explain(
            driver,
            5,
            "expand tap",
            lambda d: (
                (m := shell_metrics(d))["expanded"] == "1"
                and m["ariaExpanded"] == "true"
                and m["shellHeight"] >= collapsed["shellHeight"] + 120
            ),
        )

        driver.find_element(By.CSS_SELECTOR, ".roxy-bay-sheet-handle").click()
        wait_or_explain(driver, 5, "second collapse tap", lambda d: compact(shell_metrics(d)))
        collapsed_again = shell_metrics(driver)
        if not compact(collapsed_again):
            failures.append(f"second tap did not restore compact mini-Bay: {collapsed_again}")
        if collapsed_again["horizontalOverflow"] > 1:
            failures.append(f"second collapsed state causes horizontal overflow: {collapsed_again}")

    except Exception as exc:
        failures.append(str(exc))
    finally:
        driver.quit()

    if failures:
        print("Bay sheet collapse QA failed:")
        for failure in failures:
            print("-", failure)
        return 1
    print("Bay oval handle expands and collapses a genuinely compact mobile sheet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
