#!/usr/bin/env python3
from __future__ import annotations
import json
import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.environ.get("TD_UX_BASE_URL","http://127.0.0.1:4173/")
ARTIFACTS=Path("artifacts/ux-browser")
ARTIFACTS.mkdir(parents=True,exist_ok=True)


def driver_for(width=412,height=915):
    options=Options()
    for arg in ("--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",f"--window-size={width},{height}"):
        options.add_argument(arg)
    driver=webdriver.Chrome(options=options)
    driver.set_window_size(width,height)
    return driver


def main():
    driver=driver_for()
    try:
        sep="&" if "?" in BASE_URL else "?"
        driver.get(f"{BASE_URL}{sep}bai_debug=1")
        WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
        WebDriverWait(driver,15).until(lambda d:d.execute_script("return Boolean(window.TDShoppingAssistant&&window.TDBaiChatQualityV3)"))
        driver.execute_script("localStorage.removeItem('td_bai_regression_candidates_v1'); window.TDShoppingAssistant.open();")
        WebDriverWait(driver,8).until(lambda d:d.find_element(By.CSS_SELECTOR,".td-ai textarea"))

        textarea=driver.find_element(By.CSS_SELECTOR,".td-ai textarea")
        textarea.send_keys("Добавь молоко")
        driver.find_element(By.CSS_SELECTOR,".td-ai [data-ai-send]").click()

        WebDriverWait(driver,15).until(lambda d:d.execute_script("return document.querySelectorAll('.td-ai-msg.assistant').length>=2"))
        WebDriverWait(driver,8).until(lambda d:d.execute_script("return Boolean(document.querySelector('.td-ai-msg.assistant:last-of-type [data-bai-quality-meta]'))"))

        badge=driver.execute_script("return document.querySelector('.td-ai-msg.assistant:last-of-type .td-ai-brain-badge')?.innerText||''")
        if badge!="Мозг: RULES":
            raise AssertionError(f"expected deterministic RULES brain trace in local-only beta, got {badge!r}")

        button=driver.find_element(By.CSS_SELECTOR,".td-ai-msg.assistant:last-of-type .td-ai-bad-response")
        if button.text!="Не то":
            raise AssertionError(f"bad-response action missing: {button.text!r}")
        button.click()
        WebDriverWait(driver,4).until(lambda d:d.find_element(By.CSS_SELECTOR,".td-ai-msg.assistant:last-of-type .td-ai-bad-response").text=="Сохранено локально")

        raw=driver.execute_script("return localStorage.getItem('td_bai_regression_candidates_v1')||'[]'")
        cases=json.loads(raw)
        if len(cases)!=1:
            raise AssertionError(f"expected one local regression candidate, got {len(cases)}")
        case=cases[0]
        if case.get("request")!="Добавь молоко" or case.get("provider")!="rules":
            raise AssertionError(f"unexpected captured case: {case}")
        if "operation_types" not in case or not isinstance(case["operation_types"],list):
            raise AssertionError(f"operation type trace missing: {case}")
        if any(key in case.get("state",{}) for key in ("email","access_token","session","auth")):
            raise AssertionError(f"sensitive state leaked into local case: {case}")

        driver.save_screenshot(str(ARTIFACTS/"bai-chat-quality-debug-android.png"))
        print("Bay chat-quality browser QA passed: RULES trace is visible in debug mode and 'Не то' stores one minimized local regression candidate.")
        return 0
    except Exception as exc:
        driver.save_screenshot(str(ARTIFACTS/"bai-chat-quality-debug-failure.png"))
        print(f"Bay chat-quality browser QA failed: {exc}")
        return 1
    finally:
        driver.quit()


if __name__=="__main__":
    raise SystemExit(main())
