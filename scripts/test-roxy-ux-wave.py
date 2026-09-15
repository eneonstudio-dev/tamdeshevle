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


def no_horizontal_overflow(driver,selector):
    return driver.execute_script("""
      const node=document.querySelector(arguments[0]);
      if(!node)return false;
      return node.scrollWidth <= node.clientWidth + 2;
    """,selector)


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
              const card=hero?.querySelector('.roxy-bay-card');
              const bai=hero?.querySelector('.v2-hero-bai img,.v2-bay-avatar');
              const link=document.querySelector('link[data-roxy-ux-wave]');
              const hs=hero?getComputedStyle(hero):null;
              const bs=bai?getComputedStyle(bai):null;
              return {
                screen:document.getElementById('app')?.dataset.screen||'',
                title:hero?.querySelector('.v2-hero-copy h1')?.innerText||'',
                cssLoaded:Boolean(link && link.sheet),
                heroTop:hero?.getBoundingClientRect().top||0,
                heroBottom:hero?.getBoundingClientRect().bottom||0,
                cardTop:card?.getBoundingClientRect().top||0,
                marginTop:hs?parseFloat(hs.marginTop):999,
                baiWidth:bs?parseFloat(bs.width):0
              };
            """)
            if home['screen']!='home' or 'Спросить Бая' not in home['title'] or not home['cssLoaded']:
                failures.append(f"{name}: approved compact Home or UX-wave CSS missing {home}")
            if width<=740 and home['marginTop']>12.5:
                failures.append(f"{name}: Home top spacing is not compact {home}")
            if width<=740 and home['baiWidth'] and home['baiWidth']>162:
                failures.append(f"{name}: Bay visual remained oversized on compact Home {home}")
            if not no_horizontal_overflow(driver,"#app"):
                failures.append(f"{name}: Home has horizontal overflow")

            # Seed only the existing local demo basket so the List screen has stable rows.
            # The UX wave itself must never mutate this object.
            driver.execute_script("""
              state.cart={milk:2,bread:1,chicken:1};
              state.cartTouched=true;
              persist();
              setScreen('cart');
            """)
            WebDriverWait(driver,8).until(lambda d:d.execute_script("return document.querySelectorAll('.v2-list-bay').length===1"))
            driver.execute_script("window.dispatchEvent(new CustomEvent('td:v2-rendered'));window.dispatchEvent(new CustomEvent('td:v2-rendered')); ")
            WebDriverWait(driver,3).until(lambda d:d.execute_script("return document.querySelectorAll('.v2-list-bay').length===1"))
            before=driver.execute_script("return JSON.stringify(state.cart)")
            list_ui=driver.execute_script("""
              const card=document.querySelector('.v2-list-bay');
              const button=card?.querySelector('.v2-list-bay-open');
              const cs=button?getComputedStyle(button):null;
              return {
                count:document.querySelectorAll('.v2-list-bay').length,
                text:card?.innerText||'',
                buttonHeight:button?.getBoundingClientRect().height||0,
                buttonMinHeight:cs?parseFloat(cs.minHeight):0
              };
            """)
            if list_ui['count']!=1 or 'Хочешь поменять список словами?' not in list_ui['text']:
                failures.append(f"{name}: Bay-on-List card is missing or duplicated {list_ui}")
            if list_ui['buttonHeight']<43.5 or list_ui['buttonMinHeight']<43.5:
                failures.append(f"{name}: Bay-on-List action is below touch-target contract {list_ui}")
            if not no_horizontal_overflow(driver,"#app"):
                failures.append(f"{name}: List has horizontal overflow")

            driver.find_element(By.CSS_SELECTOR,".v2-list-bay-open").click()
            WebDriverWait(driver,8).until(lambda d:d.execute_script("return Boolean(document.querySelector('.td-ai,.bai-panel,[data-bai-panel=true]'))"))
            after=driver.execute_script("return JSON.stringify(state.cart)")
            if before!=after:
                failures.append(f"{name}: opening Bay from List mutated basket: {before} -> {after}")

            # Close Bay surface before opening account so layer/focus ownership stays explicit.
            driver.execute_script("window.TDBai?.closePanel?.();document.querySelector('.td-ai [data-close],.td-ai .td-ai-close')?.click?.();")
            driver.execute_script("window.TDAccountHub.open(0);")
            WebDriverWait(driver,6).until(lambda d:d.execute_script("return document.querySelector('.td-account.td-account-polished')!==null"))
            account=driver.execute_script("""
              const root=document.querySelector('.td-account.td-account-polished');
              const close=root?.querySelector('.td-account-close');
              const tab=root?.querySelector('.td-account-tab');
              const local=root?.querySelector('.td-account-local-badge');
              return {
                local:local?.innerText||'',
                closeHeight:close?.getBoundingClientRect().height||0,
                tabHeight:tab?.getBoundingClientRect().height||0,
                overflow:root ? root.scrollWidth-root.clientWidth : 999,
                cloudEnabled:[...root?.querySelectorAll('[data-cloud-save],[data-cloud-restore]')||[]].some(x=>!x.disabled)
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
    print("Roxy UX-wave browser QA passed: compact approved Home, one non-mutating Bay-on-List entry, polished local-only Account and no mobile horizontal overflow.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
