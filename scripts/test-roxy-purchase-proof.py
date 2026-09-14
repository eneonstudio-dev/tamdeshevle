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
            imported=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              import('./purchase-proof.js?v=qa-roxy-proof').then(()=>done(Boolean(window.TDPurchaseProof))).catch(e=>done(String(e)));
            """)
            if imported is not True:
                raise AssertionError(imported)
            initial=driver.execute_script("""
              localStorage.removeItem('td:purchase-proof-v1');
              document.querySelector('.td-purchase-proof')?.remove();
              const session={lastPlans:[
                {id:'multi',type:'multi',total:4420,products:[{id:'milk',quantity:1,price:100,storeId:'pyat'}]},
                {id:'one',type:'one',total:4850,products:[{id:'milk',quantity:1,price:100,storeId:'pyat'}]}
              ]};
              window.TDShoppingState={get(){return session}};
              const opener=document.createElement('button');opener.id='qa-proof-opener';opener.textContent='Уже купил';document.body.appendChild(opener);opener.focus();
              const direct=window.TDPurchaseProof.save({proof:'self'});
              const opened=window.TDPurchaseProof.open();
              const root=document.querySelector('.td-purchase-proof'),card=root?.querySelector('.td-purchase-proof-card'),input=root?.querySelector('[data-proof-total]'),actions=[...root?.querySelectorAll('.td-proof-actions button')||[]],close=root?.querySelector('[data-proof-close]');
              return {
                opened,directWasNull:direct===null,entries:window.TDPurchaseProof.entries().length,
                value:input?.value||'',placeholder:input?.placeholder||'',note:root?.querySelector('.td-proof-note')?.innerText||'',plan:root?.querySelector('.td-proof-plan')?.innerText||'',
                dialogRole:card?.getAttribute('role')||'',ariaModal:card?.getAttribute('aria-modal')||'',focused:document.activeElement===input,
                actionHeights:actions.map(x=>x.getBoundingClientRect().height),closeHeight:close?.getBoundingClientRect().height||0,
                overflow:(root?.scrollWidth||0)-(root?.clientWidth||0)
              };
            """)
            if not initial['opened'] or not initial['directWasNull'] or initial['entries']!=0:
                failures.append(f"{name}: proof must fail closed without an explicit actual total {initial}")
            if initial['value']!='' or '4420' not in initial['placeholder'] or 'не подставляю' not in initial['note']:
                failures.append(f"{name}: planned amount leaked into the actual-total field {initial}")
            if '≈' not in initial['plan']:
                failures.append(f"{name}: planned total should remain visibly approximate in proof UI {initial}")
            if initial['dialogRole']!='dialog' or initial['ariaModal']!='true':
                failures.append(f"{name}: purchase proof is missing dialog semantics {initial}")
            if initial['closeHeight']<43.5 or any(h<43.5 for h in initial['actionHeights']) or initial['overflow']>1:
                failures.append(f"{name}: purchase proof actions are not mobile-safe {initial}")

            invalid=driver.execute_script("""
              const root=document.querySelector('.td-purchase-proof');
              root.querySelector('[data-proof-self]').click();
              return {status:root.querySelector('[data-proof-status]').innerText,entries:window.TDPurchaseProof.entries().length,stillOpen:Boolean(document.querySelector('.td-purchase-proof'))};
            """)
            if 'Введи сумму' not in invalid['status'] or invalid['entries']!=0 or not invalid['stillOpen']:
                failures.append(f"{name}: empty confirmation must not create a purchase fact {invalid}")

            saved=driver.execute_script("""
              const root=document.querySelector('.td-purchase-proof'),input=root.querySelector('[data-proof-total]');
              input.value='4310';input.dispatchEvent(new Event('input',{bubbles:true}));root.querySelector('[data-proof-self]').click();
              const row=window.TDPurchaseProof.entries()[0]||null;
              return row;
            """)
            if not saved or saved.get('proof')!='self' or saved.get('actualTotal')!=4310 or saved.get('plannedTotal')!=4420:
                failures.append(f"{name}: explicit user amount was not saved as self-reported proof {saved}")
            driver.save_screenshot(str(ARTIFACTS/f"roxy-purchase-proof-{name}.png"))
            WebDriverWait(driver,4).until(lambda d:not d.execute_script("return Boolean(document.querySelector('.td-purchase-proof'))"))
            focused_back=driver.execute_script("return document.activeElement?.id==='qa-proof-opener'")
            if not focused_back:
                failures.append(f"{name}: closing proof did not restore focus to the opener")
        except Exception as exc:
            failures.append(f"{name}: {exc}")
        finally:
            driver.quit()
    if failures:
        print('Roxy purchase proof QA failed:')
        for failure in failures: print('-',failure)
        return 1
    print('Roxy purchase proof QA passed on desktop and Android-sized viewports: planned totals never become purchase facts without explicit user input, and the proof dialog stays mobile/accessibility safe.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
