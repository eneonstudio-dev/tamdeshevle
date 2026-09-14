#!/usr/bin/env python3
"""Real-browser contract for the Roxy purchase handoff state."""
from __future__ import annotations

import os
import pathlib
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.environ.get("TD_UX_BASE_URL","http://127.0.0.1:4173/")
OUT=pathlib.Path(os.environ.get("TD_UX_OUT_DIR","artifacts/ux-browser"))
OUT.mkdir(parents=True,exist_ok=True)
VIEWPORTS=(("desktop",1440,1000,False),("android",412,915,True))


def driver_for(width,height,mobile):
    options=Options()
    for arg in ("--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--hide-scrollbars",f"--window-size={width},{height}"):
        options.add_argument(arg)
    if mobile:
        options.add_argument("--user-agent=Mozilla/5.0 (Linux; Android 13; SM-N986N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36")
    driver=webdriver.Chrome(options=options)
    driver.set_window_size(width,height)
    return driver


def visible(driver,selector):
    return driver.execute_script("""
      const el=document.querySelector(arguments[0]);
      if(!el)return false;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
    """,selector)


def open_handoff(driver):
    result=driver.execute_async_script("""
      const done=arguments[arguments.length-1];
      const pyat={id:'milk',name:'Молоко 3,2%',pack:'1 л',quantity:1,storeId:'pyat',unitPrice:89,price:89,quality:'LIVE'};
      const magnit={id:'bread',name:'Хлеб',pack:'400 г',quantity:1,storeId:'magnit',unitPrice:55,price:55,quality:'LIVE'};
      const plan={id:'qa-handoff',type:'split',stores:['pyat','magnit'],products:[pyat,magnit],goods:144,convenienceCost:0,total:144,quality:'VERIFIED'};
      TDShoppingState.commit('QA_HANDOFF',s=>{s.products=[pyat,magnit];s.lastPlans=[plan];s.currentTotal=144},'QA handoff seed');
      Promise.all([
        import('./continue-in-stores-v1.js?v=qa-roxy-handoff'),
        import('./purchase-experience-v1.js?v=qa-roxy-handoff'),
        import('./votonobay-roxy-handoff-v1.js?v=qa-roxy-handoff')
      ]).then(async()=>done(await TDContinueInStoresV1.open(plan))).catch(error=>done(String(error)));
    """)
    if result is not True:
        raise AssertionError(f"handoff failed to open: {result}")


def metrics(driver):
    return driver.execute_script("""
      const root=document.querySelector('.td-continue-stores[data-roxy-handoff="1"]');
      const card=root?.querySelector('.td-continue-stores-card');
      const title=card?.querySelector('h2')?.textContent?.trim()||'';
      const eyebrow=card?.querySelector(':scope>small')?.textContent?.trim()||'';
      const truth=card?.querySelector('.roxy-handoff-truth');
      const rows=[...card?.querySelectorAll('.td-continue-store-row')||[]];
      const metas=[...card?.querySelectorAll('.roxy-handoff-store-meta')||[]];
      const buttons=[...card?.querySelectorAll('button')||[]].map(b=>{const r=b.getBoundingClientRect();return{w:r.width,h:r.height,text:b.textContent.trim()}});
      const rr=root?.getBoundingClientRect(),cr=card?.getBoundingClientRect();
      return {
        title,eyebrow,truth:truth?.textContent?.trim()||'',rows:rows.length,metas:metas.length,
        buttons,stylesheet:!!document.querySelector('link[data-roxy-handoff-v1="1"]'),
        root:rr?{left:rr.left,right:rr.right,width:rr.width}:null,
        card:cr?{left:cr.left,right:cr.right,width:cr.width}:null,
        docWidth:document.documentElement.scrollWidth,vw:innerWidth
      };
    """)


def success_metrics(driver):
    return driver.execute_script("""
      const root=document.querySelector('.td-continue-stores[data-roxy-handoff="1"]');
      const success=root?.querySelector('.roxy-handoff-success');
      return {
        complete:root?.querySelector('.td-continue-stores-card')?.dataset.roxyHandoffComplete||'',
        text:success?.textContent?.trim()||'',
        bay:success?.querySelector('img')?.getAttribute('src')||''
      };
    """)


def main():
    failures=[]
    for name,width,height,mobile in VIEWPORTS:
        driver=driver_for(width,height,mobile)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return !!window.TDShoppingState"))
            driver.execute_script("localStorage.clear(); location.reload()")
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return !!window.TDShoppingState"))
            open_handoff(driver)
            WebDriverWait(driver,10).until(lambda d:visible(d,'.td-continue-stores[data-roxy-handoff="1"]'))
            time.sleep(.2)
            data=metrics(driver)
            label=f"{name}/handoff"
            if data.get('title')!='Дальше — в магазин': failures.append(f"{label}: wrong title {data}")
            if data.get('eyebrow')!='ПЕРЕХОД К ПОКУПКЕ': failures.append(f"{label}: wrong eyebrow {data}")
            truth=data.get('truth','')
            if 'Без автопереноса корзины' not in truth or 'подтверждаются' not in truth: failures.append(f"{label}: truth boundary missing {data}")
            if data.get('rows')!=2 or data.get('metas')!=2: failures.append(f"{label}: store handoff rows not decorated {data}")
            if not data.get('stylesheet'): failures.append(f"{label}: stylesheet missing")
            if data.get('docWidth',0)>data.get('vw',0)+2: failures.append(f"{label}: horizontal overflow {data}")
            card=data.get('card') or {}
            if card and (card.get('left',0)<-2 or card.get('right',0)>data.get('vw',0)+2): failures.append(f"{label}: card leaves viewport {data}")
            if mobile:
                too_short=[b for b in data.get('buttons',[]) if b.get('h',0)<43.5 and b.get('text')!='×']
                if too_short: failures.append(f"{label}: mobile touch targets too short {too_short}")
            driver.save_screenshot(str(OUT/f"{name}-roxy-handoff.png"))

            driver.execute_script("document.querySelectorAll('.td-continue-store-row [data-plus]').forEach(b=>b.click())")
            WebDriverWait(driver,5).until(lambda d:visible(d,'.roxy-handoff-success'))
            time.sleep(.1)
            success=success_metrics(driver)
            if success.get('complete')!='1': failures.append(f"{label}: completion marker missing {success}")
            if 'не подтверждение оплаты' not in success.get('text',''): failures.append(f"{label}: completion overclaims purchase {success}")
            if 'bai-happy-approved-v1.webp' not in success.get('bay',''): failures.append(f"{label}: approved happy Bay missing {success}")
            driver.save_screenshot(str(OUT/f"{name}-roxy-handoff-success.png"))
        except Exception as exc:
            failures.append(f"{name}/handoff: {exc}")
            try: driver.save_screenshot(str(OUT/f"{name}-roxy-handoff-failure.png"))
            except Exception: pass
        finally:
            driver.quit()
    if failures:
        print('Roxy handoff QA failed:')
        for failure in failures: print('-',failure)
        return 1
    print('Roxy handoff QA passed on desktop and Android-sized viewports.')
    return 0


if __name__=='__main__':
    raise SystemExit(main())
