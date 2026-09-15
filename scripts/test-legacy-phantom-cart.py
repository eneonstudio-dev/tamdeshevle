#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")
MIGRATION_KEY = "td:cart-migration:legacy-seed-v1"
BACKUP_KEY = "td:legacy-seeded-cart-backup:v1"


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


def ready(driver: webdriver.Chrome) -> bool:
    return bool(driver.execute_script("return !!window.state && !!document.querySelector('#app')"))


def snapshot(driver: webdriver.Chrome) -> dict:
    return driver.execute_script(
        """
        const saved=JSON.parse(localStorage.getItem('td')||'{}');
        const backup=JSON.parse(localStorage.getItem(arguments[0])||'null');
        const cart={...(window.state?.cart||{})};
        const count=Object.values(cart).reduce((sum,value)=>sum+Number(value||0),0);
        return {
          cart,
          count,
          savedCart:saved.cart||{},
          savedTouched:saved.cartTouched===true,
          migration:localStorage.getItem(arguments[1]),
          backup,
          migrationResult:document.documentElement.dataset.votonobayCartMigration||'',
          visibleCount:document.querySelector('.v2-basket-top b')?.textContent||''
        };
        """,
        BACKUP_KEY,
        MIGRATION_KEY,
    )


def seed_and_reload(driver: webdriver.Chrome, saved: dict, *, migrated: bool = False) -> dict:
    driver.execute_script(
        """
        localStorage.setItem('td',arguments[0]);
        localStorage.removeItem(arguments[1]);
        if(arguments[2])localStorage.setItem(arguments[3],'done');
        else localStorage.removeItem(arguments[3]);
        """,
        json.dumps(saved, ensure_ascii=False),
        BACKUP_KEY,
        migrated,
        MIGRATION_KEY,
    )
    driver.refresh()
    WebDriverWait(driver, 20).until(ready)
    return snapshot(driver)


def main() -> int:
    failures: list[str] = []
    driver = driver_for()
    try:
        driver.get(BASE_URL)
        WebDriverWait(driver, 20).until(ready)

        driver.execute_script("localStorage.clear()")
        driver.refresh()
        WebDriverWait(driver, 20).until(ready)
        fresh = snapshot(driver)
        if fresh["count"] != 0 or fresh["cart"]:
            failures.append(f"fresh browser did not start with an empty cart: {fresh}")
        if fresh["migration"] != "done":
            failures.append(f"fresh browser did not seal the one-time migration: {fresh}")

        legacy_five = seed_and_reload(
            driver,
            {
                "screen": "home",
                "city": "msk",
                "storeId": "pyat",
                "cartTouched": True,
                "cart": {"milk": 1, "bread": 1, "chicken": 1, "banana": 1, "eggs": 1},
            },
        )
        if legacy_five["count"] != 0 or legacy_five["savedTouched"]:
            failures.append(f"legacy five-item seeded residue remained visible after refresh: {legacy_five}")
        if legacy_five["migrationResult"] != "cleared-legacy-seed":
            failures.append(f"legacy seeded residue was not identified by the migration: {legacy_five}")
        backup = legacy_five["backup"] or {}
        if len((backup.get("cart") or {})) != 5:
            failures.append(f"legacy cart was not recoverably backed up before quarantine: {legacy_five}")

        legitimate = seed_and_reload(
            driver,
            {
                "screen": "home",
                "city": "msk",
                "storeId": "pyat",
                "cartTouched": True,
                "cart": {"milk": 2, "pasta": 1},
            },
        )
        if legitimate["cart"] != {"milk": 2, "pasta": 1} or legitimate["count"] != 3:
            failures.append(f"legitimate explicit cart was damaged by migration: {legitimate}")
        if legitimate["backup"] is not None:
            failures.append(f"legitimate explicit cart was incorrectly backed up/quarantined: {legitimate}")

        current_same_shape = seed_and_reload(
            driver,
            {
                "screen": "home",
                "city": "msk",
                "storeId": "pyat",
                "cartTouched": True,
                "cart": {"milk": 1, "bread": 1, "chicken": 1, "banana": 1, "eggs": 1},
            },
            migrated=True,
        )
        if current_same_shape["count"] != 5:
            failures.append(f"already-migrated legitimate cart was cleared again: {current_same_shape}")
        if current_same_shape["backup"] is not None:
            failures.append(f"already-migrated cart unexpectedly created a legacy backup: {current_same_shape}")

    except Exception as exc:
        failures.append(str(exc))
    finally:
        driver.quit()

    if failures:
        print("Legacy phantom-cart QA failed:")
        for failure in failures:
            print("-", failure)
        return 1
    print("Fresh carts stay empty, legacy seeded residue is quarantined with backup, and legitimate carts persist.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
