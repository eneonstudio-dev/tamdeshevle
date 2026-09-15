#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.environ.get("TD_UX_BASE_URL","http://127.0.0.1:4173/")
ARTIFACTS=Path("artifacts/ux-browser")
ARTIFACTS.mkdir(parents=True,exist_ok=True)


def driver_for(width:int,height:int):
    options=Options()
    for arg in (
        "--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
        f"--window-size={width},{height}",
    ):
        options.add_argument(arg)
    driver=webdriver.Chrome(options=options)
    driver.set_window_size(width,height)
    return driver


def wait_ready(driver):
    WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
    WebDriverWait(driver,15).until(lambda d:d.execute_script("""
      const hero=document.querySelector('.v2-hero.v2-bay-first[data-roxy-approved="1"]');
      return Boolean(hero && window.__TDRoxyUxWaveV1 && window.TDRoxyUxWave && window.TDAccountHub && window.TDBai);
    """))


def surface_fits_viewport(driver,selector):
    return driver.execute_script("""
      const node=document.querySelector(arguments[0]);
      if(!node)return false;
      const r=node.getBoundingClientRect();
      return r.left >= -2 && r.right <= window.innerWidth + 2;
    """,selector)


def click_list_navigation(driver):
    return driver.execute_script("""
      const nodes=[...document.querySelectorAll('.v2-nav button,.v2-mobile-nav button,.v2-bottom-nav button')];
      const visible=node=>{
        const style=getComputedStyle(node);
        const rect=node.getBoundingClientRect();
        return style.display!=='none' && style.visibility!=='hidden' && rect.width>0 && rect.height>0;
      };
      const target=nodes.find(node=>visible(node) && /Спис/.test(node.textContent||''));
      if(!target)return false;
      target.click();
      return true;
    """)


def main():
    failures=[]
    cases=(("android",412,915),("narrow",320,760),("desktop",1440,1000))
    for name,width,height in cases:
        driver=driver_for(width,height)
        try:
            driver.get(BASE_URL)
            wait_ready(driver)

            home=driver.execute_script("""
              const hero=document.querySelector('.v2-hero.v2-bay-first[data-roxy-approved="1"]');
              const bai=hero?.querySelector('.v2-hero-bai');
              const link=document.querySelector('link[data-roxy-ux-wave]');
              const hs=hero?getComputedStyle(hero):null;
              const r=hero?.getBoundingClientRect();
              const br=bai?.getBoundingClientRect();
              return {
                screen:document.getElementById('app')?.dataset.screen||'',
                title:hero?.querySelector('.v2-hero-copy h1')?.innerText||'',
                cssLoaded:Boolean(link && link.sheet),
                heroTop:r?.top||0,
                heroHeight:r?.height||0,
                baiTop:br?.top||0,
                viewportHeight:window.innerHeight,
                marginTop:hs?parseFloat(hs.marginTop):999
              };
            """)
            if home['screen']!='home' or 'Спросить Бая' not in home['title'] or not home['cssLoaded']:
                failures.append(f"{name}: approved compact Home or UX-wave CSS missing {home}")
            if width<=740 and home['marginTop']>12.5:
                failures.append(f"{name}: Home top spacing is not compact {home}")
            if width<=740 and home['heroTop']>104:
                failures.append(f"{name}: approved Home starts too low for compact mobile composition {home}")
            if width<=740 and (home['baiTop']<=0 or home['baiTop']>=home['viewportHeight']):
                failures.append(f"{name}: primary Bay visual is not present in the opening mobile viewport {home}")
            if not surface_fits_viewport(driver,'.v2-hero.v2-bay-first'):
                failures.append(f"{name}: Home hero escapes the viewport horizontally")
            if driver.execute_script("return Boolean(document.querySelector('.roxy-bay-card'))") and not surface_fits_viewport(driver,'.roxy-bay-card'):
                failures.append(f"{name}: Roxy quick-start card escapes the viewport horizontally")

            # Seed only the existing local demo basket so the List screen has stable rows.
            # Navigation itself goes through the real UI; the UX wave never receives a
            # privileged state setter and must not mutate this basket.
            driver.execute_script("""
              state.cart={milk:2,bread:1,chicken:1};
              state.cartTouched=true;
              persist();
            """)
            if not click_list_navigation(driver):
                failures.append(f"{name}: no visible real List navigation control")
                continue
            WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.getElementById('app')?.dataset.screen==='cart' && Boolean(document.querySelector('#app .wrap'))"))
            WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.querySelectorAll('.v2-list-bay').length===1"))
            driver.execute_script("window.dispatchEvent(new CustomEvent('td:v2-rendered'));window.dispatchEvent(new CustomEvent('td:v2-rendered')); ")
            WebDriverWait(driver,3).until(lambda d:d.execute_script("return document.querySelectorAll('.v2-list-bay').length===1"))
            before=driver.execute_script("return JSON.stringify(state.cart)")
            list_ui=driver.execute_script("""
              const card=document.querySelector('.v2-list-bay');
              const host=document.querySelector('#app .wrap');
              const firstItem=host?.querySelector('.item');
              const button=card?.querySelector('.v2-list-bay-open');
              const cs=button?getComputedStyle(button):null;
              const beforeItems=Boolean(card && (!firstItem || (card.compareDocumentPosition(firstItem)&Node.DOCUMENT_POSITION_FOLLOWING)));
              return {
                count:document.querySelectorAll('.v2-list-bay').length,
                inList:Boolean(card && host && card.parentElement===host),
                beforeItems,
                text:card?.innerText||'',
                buttonHeight:button?.getBoundingClientRect().height||0,
                buttonMinHeight:cs?parseFloat(cs.minHeight):0
              };
            """)
            if list_ui['count']!=1 or not list_ui['inList'] or not list_ui['beforeItems'] or 'Хочешь поменять список словами?' not in list_ui['text']:
                failures.append(f"{name}: Bay-on-List card is missing, misplaced or duplicated {list_ui}")
            if list_ui['buttonHeight']<43.5 or list_ui['buttonMinHeight']<43.5:
                failures.append(f"{name}: Bay-on-List action is below touch-target contract {list_ui}")
            if not surface_fits_viewport(driver,'.v2-list-bay'):
                failures.append(f"{name}: Bay-on-List card escapes the viewport horizontally")

            driver.find_element(By.CSS_SELECTOR,".v2-list-bay-open").click()
            WebDriverWait(driver,8).until(lambda d:d.execute_script("return Boolean(document.querySelector('.td-ai,.bai-panel,[data-bai-panel=true]'))"))
            after=driver.execute_script("return JSON.stringify(state.cart)")
            if before!=after:
                failures.append(f"{name}: opening Bay from List mutated basket: {before} -> {after}")

            # Account must take exclusive layer ownership itself. Leave the Bay conversation
            # open on purpose: opening Account has to close it through Bay's own close action,
            # without changing the current List or basket.
            driver.execute_script("window.TDAccountHub.open(0);")
            WebDriverWait(driver,6).until(lambda d:d.execute_script("return document.querySelector('.td-account.td-account-polished')!==null"))
            account=driver.execute_script("""
              const root=document.querySelector('.td-account.td-account-polished');
              const close=root?.querySelector('.td-account-close');
              const tab=root?.querySelector('.td-account-tab');
              const local=root?.querySelector('.td-account-local-badge');
              const visible=node=>{
                if(!node||!node.isConnected||node.hidden||node.getAttribute('aria-hidden')==='true')return false;
                const style=getComputedStyle(node),rect=node.getBoundingClientRect();
                return style.display!=='none' && style.visibility!=='hidden' && rect.width>0 && rect.height>0;
              };
              return {
                local:local?.innerText||'',
                closeHeight:close?.getBoundingClientRect().height||0,
                tabHeight:tab?.getBoundingClientRect().height||0,
                overflow:root ? root.scrollWidth-root.clientWidth : 999,
                cloudEnabled:[...root?.querySelectorAll('[data-cloud-save],[data-cloud-restore]')||[]].some(x=>!x.disabled),
                bayOverlayVisible:[...document.querySelectorAll('.td-ai,.bai-panel,[data-bai-panel=true]')].some(visible),
                screen:document.getElementById('app')?.dataset.screen||'',
                cart:JSON.stringify(state.cart)
              };
            """)
            if account['local']!='Локальный режим':
                failures.append(f"{name}: Account local-only presentation badge missing {account}")
            if account['closeHeight']<43.5:
                failures.append(f"{name}: Account close control below 44px {account}")
            if width<=740 and account['tabHeight']<43.5:
                failures.append(f"{name}: Account tab below 44px on mobile {account}")
            if account['overflow']>2:
                failures.append(f"{name}: Account has horizontal overflow {account}")
            if account['cloudEnabled']:
                failures.append(f"{name}: UX polish accidentally enabled local-only cloud controls {account}")
            if account['bayOverlayVisible']:
                failures.append(f"{name}: Bay conversation remains visible behind Account {account}")
            if account['screen']!='cart' or account['cart']!=before:
                failures.append(f"{name}: Account layer handoff changed List/basket state {account}")

            driver.save_screenshot(str(ARTIFACTS/f"roxy-ux-wave-{name}.png"))
        except Exception as exc:
            failures.append(f"{name}: {exc}")
        finally:
            driver.quit()

    if failures:
        print("Roxy UX-wave browser QA failed:")
        for failure in failures:
            print("-",failure)
        return 1
    print("Roxy UX-wave browser QA passed: compact approved Home, one non-mutating Bay-on-List entry, exclusive polished local-only Account layer and bounded mobile wave surfaces.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
