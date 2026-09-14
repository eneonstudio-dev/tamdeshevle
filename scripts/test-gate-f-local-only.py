#!/usr/bin/env python3
from __future__ import annotations
import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.environ.get("TD_UX_BASE_URL","http://127.0.0.1:4173/")
ARTIFACTS=Path("artifacts/ux-browser")
ARTIFACTS.mkdir(parents=True,exist_ok=True)


def driver_for(width,height):
    options=Options()
    for arg in ("--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",f"--window-size={width},{height}"):
        options.add_argument(arg)
    driver=webdriver.Chrome(options=options)
    driver.set_window_size(width,height)
    return driver


def main():
    failures=[]
    for name,width,height in (("android",412,915),("desktop",1440,1000)):
        driver=driver_for(width,height)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            WebDriverWait(driver,10).until(lambda d:d.execute_script("return Boolean(window.TDAuth&&window.TDAccountHub&&window.TDReceiptEntry)"))

            scope=driver.execute_script("""
              return {
                mode:window.TD_RELEASE_SCOPE?.personalDataMode||'',
                cloud:window.TD_RELEASE_SCOPE?.accountCloudEnabled,
                receipt:window.TD_RELEASE_SCOPE?.receiptProofUploadEnabled,
                supabase:window.TD_SUPABASE,
                configured:window.TDAuth.configured(),
                user:window.TDAuth.user(),
                receiptFn:typeof window.TDAuth.submitReceiptEvidence
              };
            """)
            if scope['mode']!='local-only' or scope['cloud'] is not False or scope['receipt'] is not False:
                failures.append(f"{name}: release scope is not local-only {scope}")
            if scope['supabase'] is not None or scope['configured'] is not False or scope['user'] is not None or scope['receiptFn']!='object':
                failures.append(f"{name}: personal-data runtime did not fail closed {scope}")

            driver.execute_script("window.TDAccountHub.open(0);")
            WebDriverWait(driver,4).until(lambda d:d.execute_script("return document.querySelector('.td-account [data-auth]')?.disabled===true"))
            account=driver.execute_script("""
              const root=document.querySelector('.td-account');
              return {
                authDisabled:root?.querySelector('[data-auth]')?.disabled,
                authText:root?.querySelector('[data-auth]')?.innerText||'',
                status:root?.querySelector('.td-account-status')?.innerText||'',
                cloud:root?.querySelector('.td-cloud-status')?.innerText||'',
                saveDisabled:root?.querySelector('[data-cloud-save]')?.disabled,
                restoreDisabled:root?.querySelector('[data-cloud-restore]')?.disabled
              };
            """)
            if not account['authDisabled'] or account['authText']!='Локальный режим':
                failures.append(f"{name}: account entry is not visibly disabled {account}")
            if 'данные хранятся только на этом устройстве' not in account['status']:
                failures.append(f"{name}: account local-only explanation missing {account}")
            if 'Облачная синхронизация отключена' not in account['cloud'] or not account['saveDisabled'] or not account['restoreDisabled']:
                failures.append(f"{name}: cloud controls are not fail-closed {account}")

            driver.execute_script("window.dispatchEvent(new CustomEvent('td:auth-requested'));")
            driver.implicitly_wait(0.1)
            if driver.execute_script("return Boolean(document.querySelector('.td-auth-modal'))"):
                failures.append(f"{name}: auth modal opened despite local-only scope")
            driver.execute_script("window.TDAccountHub.close();")

            driver.execute_script("window.TDReceiptEntry.open();")
            WebDriverWait(driver,4).until(lambda d:d.execute_script("return document.querySelector('.receipt-upload')?.disabled===true"))
            receipt=driver.execute_script("""
              const button=document.querySelector('.receipt-upload');
              return {disabled:button?.disabled,text:button?.innerText||''};
            """)
            if not receipt['disabled'] or 'отключена в закрытой бете' not in receipt['text']:
                failures.append(f"{name}: receipt cloud upload is not visibly disabled {receipt}")

            local=driver.execute_script("""
              const before=window.TDReceiptEntry.loadDrafts().length;
              const ok=window.TDReceiptEntry.saveDraft({receipt_id:'gate-f-local-only',items:[]},'device-only.jpg');
              const after=window.TDReceiptEntry.loadDrafts().length;
              return {ok,before,after};
            """)
            if not local['ok'] or local['after']!=local['before']+1:
                failures.append(f"{name}: local receipt draft path stopped working {local}")

            driver.save_screenshot(str(ARTIFACTS/f"gate-f-local-only-{name}.png"))
        except Exception as exc:
            failures.append(f"{name}: {exc}")
        finally:
            driver.quit()

    if failures:
        print("Gate F local-only browser QA failed:")
        for failure in failures: print("-",failure)
        return 1
    print("Gate F local-only browser QA passed on desktop and Android-sized viewports: personal-data cloud flows are disabled, local-only messaging is visible, and device-local receipt drafts still work.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
