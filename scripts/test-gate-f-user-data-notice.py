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
    # Test-only pre-document override. Production release-scope.js remains local-first;
    # this isolated browser validates the disclosure layer that protects remote mode
    # when those flows are explicitly enabled in a future reviewed release.
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": """
      Object.defineProperty(window,'TDReleaseScope',{
        configurable:true,
        get(){return {mode:'qa-remote-enabled',flags:{closedBeta:false,remoteAccount:true,cloudSync:true,receiptUpload:true},enabled:()=>true};},
        set(_){}
      });
    """})
    driver.set_window_size(width,height)
    return driver


def wait_ready(driver):
    WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
    loaded=driver.execute_async_script("""
      const done=arguments[arguments.length-1];
      const ready=window.TDUserDataParticipationReady;
      if(!ready){done(false);return;}
      Promise.resolve(ready).then(api=>done(Boolean(api&&window.TDUserDataParticipation))).catch(()=>done(false));
    """)
    if loaded is not True:
        raise AssertionError("participation module did not load")


def modal_state(driver):
    return driver.execute_script("""
      const root=document.querySelector('.td-user-data-participation');
      const card=root?.querySelector('.td-user-data-card');
      const buttons=[...(root?.querySelectorAll('.td-user-data-actions button')||[])];
      return root?{
        kind:root.dataset.participationKind||'',
        title:root.querySelector('h2')?.innerText||'',
        body:root.querySelector('.td-user-data-body')?.innerText||'',
        note:root.querySelector('.td-user-data-note')?.innerText||'',
        role:card?.getAttribute('role')||'',
        ariaModal:card?.getAttribute('aria-modal')||'',
        heights:buttons.map(x=>x.getBoundingClientRect().height),
        overflow:Math.max(0,root.scrollWidth-root.clientWidth),
        activeClass:document.activeElement?.className||''
      }:null;
    """)


def main():
    failures=[]
    for name,width,height in (("android",412,915),("desktop",1440,1000)):
        driver=driver_for(width,height)
        try:
            driver.get(BASE_URL)
            wait_ready(driver)
            driver.execute_script("window.__gateCounts={auth:0,save:0,restore:0,receipt:0};")

            # Auth: capture guard must run before the existing form handler/network action.
            auth_opened=driver.execute_script("""
              window.TDAuth.open();
              const form=document.querySelector('.td-auth-modal form');
              if(!form)return false;
              const input=form.querySelector('input[type="email"]');
              input.value='gate-f@example.com';
              form.onsubmit=event=>{event.preventDefault();window.__gateCounts.auth+=1;};
              const submit=form.querySelector('button[type="submit"]');
              submit.id='qa-auth-submit';
              submit.focus();
              form.requestSubmit(submit);
              return true;
            """)
            if not auth_opened:
                failures.append(f"{name}: auth form was unavailable")
                continue
            WebDriverWait(driver,3).until(lambda d:d.execute_script("return Boolean(document.querySelector('.td-user-data-participation'))"))
            state=modal_state(driver)
            if not state or state['kind']!='account' or state['role']!='dialog' or state['ariaModal']!='true':
                failures.append(f"{name}: account disclosure lacks dialog semantics {state}")
            if 'email' not in state['body'] or 'Отмена' not in state['note']:
                failures.append(f"{name}: account disclosure is not explicit about transfer/cancel {state}")
            if any(h<43.5 for h in state['heights']) or state['overflow']>1:
                failures.append(f"{name}: participation dialog is not mobile-safe {state}")
            if driver.execute_script("return window.__gateCounts.auth")!=0:
                failures.append(f"{name}: auth action ran before disclosure approval")

            # Escape must cancel only the participation dialog, not the underlying auth modal.
            driver.execute_script("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));")
            WebDriverWait(driver,2).until(lambda d:not d.execute_script("return Boolean(document.querySelector('.td-user-data-participation'))"))
            after_escape=driver.execute_script("return {count:window.__gateCounts.auth,authOpen:Boolean(document.querySelector('.td-auth-modal')),hidden:document.querySelector('.td-auth-modal')?.getAttribute('aria-hidden'),focus:document.activeElement?.id||''};")
            if after_escape['count']!=0 or not after_escape['authOpen'] or after_escape['hidden'] is not None:
                failures.append(f"{name}: Escape did not fail closed/restore underlying auth {after_escape}")

            # Approval replays exactly one original auth action.
            driver.execute_script("document.querySelector('.td-auth-modal form').requestSubmit(document.querySelector('#qa-auth-submit'));")
            WebDriverWait(driver,2).until(lambda d:d.execute_script("return document.querySelector('.td-user-data-participation')?.dataset.participationKind==='account'"))
            driver.execute_script("document.querySelector('[data-participation-confirm]').click();")
            WebDriverWait(driver,2).until(lambda d:d.execute_script("return window.__gateCounts.auth===1"))
            if driver.execute_script("return window.__gateCounts.auth")!=1:
                failures.append(f"{name}: approved auth action did not replay exactly once")
            driver.execute_script("document.querySelector('.td-auth-x')?.click();")

            # Cloud save/restore: use the real account buttons but stub only the transfer methods.
            cloud_setup=driver.execute_script("""
              window.TDAuth.user=()=>({id:'qa-user',email:'qa@example.com'});
              window.TDAuth.syncLocalToCloud=async()=>{window.__gateCounts.save+=1;return true;};
              window.TDAuth.hydrateLocalFromCloud=async()=>{window.__gateCounts.restore+=1;return false;};
              window.confirm=()=>true;
              window.TDAccountHub.open(0);
              window.dispatchEvent(new CustomEvent('td:auth-state'));
              window.TDAccountAuthUI?.apply?.();
              const save=document.querySelector('[data-cloud-save]'),restore=document.querySelector('[data-cloud-restore]');
              if(!save||!restore)return false;
              save.disabled=false;restore.disabled=false;
              save.click();
              return true;
            """)
            if not cloud_setup:
                failures.append(f"{name}: cloud controls unavailable")
            else:
                WebDriverWait(driver,2).until(lambda d:d.execute_script("return document.querySelector('.td-user-data-participation')?.dataset.participationKind==='cloud_save'"))
                if driver.execute_script("return window.__gateCounts.save")!=0:
                    failures.append(f"{name}: cloud save ran before approval")
                driver.execute_script("document.querySelector('[data-participation-cancel]').click();")
                WebDriverWait(driver,2).until(lambda d:not d.execute_script("return Boolean(document.querySelector('.td-user-data-participation'))"))
                if driver.execute_script("return window.__gateCounts.save")!=0:
                    failures.append(f"{name}: cancelling cloud save still ran transfer")
                driver.execute_script("document.querySelector('[data-cloud-save]').click();")
                WebDriverWait(driver,2).until(lambda d:d.execute_script("return document.querySelector('.td-user-data-participation')?.dataset.participationKind==='cloud_save'"))
                driver.execute_script("document.querySelector('[data-participation-confirm]').click();")
                WebDriverWait(driver,2).until(lambda d:d.execute_script("return window.__gateCounts.save===1"))

                driver.execute_script("document.querySelector('[data-cloud-restore]').disabled=false;document.querySelector('[data-cloud-restore]').click();")
                WebDriverWait(driver,2).until(lambda d:d.execute_script("return document.querySelector('.td-user-data-participation')?.dataset.participationKind==='cloud_restore'"))
                restore_state=modal_state(driver)
                if not restore_state or 'отдельно попросит подтвердить замену' not in restore_state['note']:
                    failures.append(f"{name}: restore disclosure does not preserve destructive-confirmation boundary {restore_state}")
                driver.execute_script("document.querySelector('[data-participation-confirm]').click();")
                WebDriverWait(driver,2).until(lambda d:d.execute_script("return window.__gateCounts.restore===1"))
                driver.execute_script("window.TDAccountHub.close();")

            # Receipt: existing queue action must stay local until explicit approval.
            receipt_setup=driver.execute_script("""
              window.TDAuth.submitReceiptEvidence=async()=>{window.__gateCounts.receipt+=1;return {status:'pending'};};
              window.TDReceiptEntry.open();
              const form=document.querySelector('.receipt-entry-form'),button=document.querySelector('.receipt-upload');
              if(!form||!button)return false;
              form._receiptObservation={receipt_id:'qa',store:{store_id:'qa',chain_id:'qa',address:'qa'},observed_at:new Date().toISOString(),items:[]};
              form._receiptPhoto=new File(['qa'],'receipt.jpg',{type:'image/jpeg'});
              button.disabled=false;
              button.id='qa-receipt-upload';
              button.focus();
              button.click();
              return true;
            """)
            if not receipt_setup:
                failures.append(f"{name}: receipt upload action unavailable")
            else:
                WebDriverWait(driver,2).until(lambda d:d.execute_script("return document.querySelector('.td-user-data-participation')?.dataset.participationKind==='receipt'"))
                receipt_state=modal_state(driver)
                if not receipt_state or 'Фото чека' not in receipt_state['body'] or 'не начнёт отправку' not in receipt_state['note']:
                    failures.append(f"{name}: receipt disclosure is incomplete {receipt_state}")
                if driver.execute_script("return window.__gateCounts.receipt")!=0:
                    failures.append(f"{name}: receipt upload ran before approval")
                driver.save_screenshot(str(ARTIFACTS/f"gate-f-user-data-notice-{name}.png"))
                driver.execute_script("document.querySelector('[data-participation-cancel]').click();")
                WebDriverWait(driver,2).until(lambda d:not d.execute_script("return Boolean(document.querySelector('.td-user-data-participation'))"))
                cancelled=driver.execute_script("return {count:window.__gateCounts.receipt,focus:document.activeElement?.id||''};")
                if cancelled['count']!=0:
                    failures.append(f"{name}: cancelling receipt disclosure still uploaded data")
                driver.execute_script("document.querySelector('#qa-receipt-upload').disabled=false;document.querySelector('#qa-receipt-upload').click();")
                WebDriverWait(driver,2).until(lambda d:d.execute_script("return document.querySelector('.td-user-data-participation')?.dataset.participationKind==='receipt'"))
                driver.execute_script("document.querySelector('[data-participation-confirm]').click();")
                WebDriverWait(driver,2).until(lambda d:d.execute_script("return window.__gateCounts.receipt===1"))
                if driver.execute_script("return window.__gateCounts.receipt")!=1:
                    failures.append(f"{name}: approved receipt action did not replay exactly once")
        except Exception as exc:
            failures.append(f"{name}: {exc}")
        finally:
            driver.quit()

    if failures:
        print("Gate F user-data participation QA failed:")
        for failure in failures: print("-",failure)
        return 1
    print("Gate F user-data participation QA passed on desktop and Android-sized viewports: auth, cloud and receipt transfers fail closed until explicit per-action approval, cancellation performs no transfer, and the disclosure dialog is accessible/mobile-safe.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
