#!/usr/bin/env python3
"""Browser regression: long product names must stay readable without horizontal overflow."""
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
VIEWPORTS=(("small-mobile",320,760,True),("android",412,915,True),("desktop",1440,1000,False))
LONG_NAME="Молоко ультрапастеризованное СуперПремиумБезЛишнихСокращенийДляБольшойСемейнойКорзины 3,2% без заменителя молочного жира 1 литр"


def driver_for(width,height,mobile):
    options=Options()
    for arg in ("--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--hide-scrollbars",f"--window-size={width},{height}"):
        options.add_argument(arg)
    if mobile:
        options.add_argument("--user-agent=Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36")
    driver=webdriver.Chrome(options=options)
    driver.set_window_size(width,height)
    return driver


def load_runtime(driver):
    result=driver.execute_async_script("""
      const done=arguments[arguments.length-1];
      Promise.all([
        window.TDComparisonResultV2?Promise.resolve():import('./comparison-result-v2.js?v=qa-long-names'),
        window.TDContinueInStoresV1?Promise.resolve():import('./continue-in-stores-v1.js?v=qa-long-names'),
        window.TDRealStoreIntegrationV1?Promise.resolve():import('./real-store-integration-v1.js?v=qa-long-names')
      ]).then(()=>done(true)).catch(error=>done(String(error)));
    """)
    if result is not True:
        raise AssertionError(f"runtime failed to load: {result}")


def seed(driver):
    driver.execute_script("""
      const name=arguments[0];
      const longBest={id:'qa-long-name',sourceId:'qa-long-name',name,pack:'1 л',emoji:'🥛',brand:'',quantity:1,storeId:'pyat',unitPrice:89,price:89,quality:'ESTIMATED'};
      const breadBest={id:'qa-bread',sourceId:'qa-bread',name:'Хлеб ржаной',pack:'400 г',emoji:'🍞',brand:'',quantity:1,storeId:'magnit',unitPrice:55,price:55,quality:'LIVE'};
      const longAlt={...longBest,storeId:'perek',unitPrice:220,price:220,quality:'ESTIMATED'};
      const breadAlt={...breadBest,storeId:'perek',unitPrice:70,price:70,quality:'ESTIMATED'};
      const best={id:'qa-long-best',type:'multi',stores:['pyat','magnit'],products:[longBest,breadBest],goods:144,convenienceCost:120,total:264,quality:'ESTIMATED'};
      const alt={id:'qa-long-alt',type:'one',stores:['perek'],products:[longAlt,breadAlt],goods:290,convenienceCost:0,total:290,quality:'ESTIMATED'};
      TDShoppingState.commit('QA_LONG_PRODUCT_NAME',s=>{
        s.products=[longBest,breadBest];
        s.requiredProducts=['qa-long-name','qa-bread'];
        s.onlyProducts=['qa-long-name','qa-bread'];
        s.selectionMode='only';
        s.lastPlans=[best,alt];
        s.currentTotal=264;
      },'QA long product name');

      const host=document.createElement('section');
      host.className='td-ai-summary roxy-long-name-fixture';
      host.innerHTML=`<div class="td-ai-summary-head"><b>Корзина · 2</b></div><div class="td-ai-line"><span>${name}<small>1 л · Пятёрочка</small></span><b>89 ₽</b></div><div class="td-ai-total"><span>Итого</span><strong>264 ₽</strong></div>`;
      document.body.appendChild(host);
    """,LONG_NAME)


def box_metrics(driver,selector,name_selector=None,side_selector=None):
    return driver.execute_script("""
      const root=document.querySelector(arguments[0]);
      const name=arguments[1]?root?.querySelector(arguments[1]):root;
      const side=arguments[2]?root?.querySelector(arguments[2]):null;
      const rr=root?.getBoundingClientRect(),nr=name?.getBoundingClientRect(),sr=side?.getBoundingClientRect();
      const ns=name?getComputedStyle(name):null;
      return {
        exists:!!root,
        text:name?.textContent?.trim()||'',
        root:rr?{left:rr.left,right:rr.right,width:rr.width,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth}:null,
        name:nr?{left:nr.left,right:nr.right,width:nr.width}:null,
        side:sr?{left:sr.left,right:sr.right,width:sr.width}:null,
        overflowWrap:ns?.overflowWrap||'',whiteSpace:ns?.whiteSpace||'',textOverflow:ns?.textOverflow||'',
        docWidth:document.documentElement.scrollWidth,vw:innerWidth
      };
    """,selector,name_selector,side_selector)


def assert_surface(failures,label,data,full_name):
    if not data.get('exists'):
        failures.append(f"{label}: surface missing")
        return
    if full_name not in data.get('text',''):
        failures.append(f"{label}: full product name was lost {data}")
    if data.get('docWidth',0)>data.get('vw',0)+2:
        failures.append(f"{label}: page overflows horizontally {data}")
    root=data.get('root') or {}
    if root.get('scrollWidth',0)>root.get('clientWidth',0)+2:
        failures.append(f"{label}: surface overflows horizontally {data}")
    if data.get('whiteSpace')=='nowrap' or data.get('textOverflow')=='ellipsis':
        failures.append(f"{label}: decision-critical name is truncated {data}")
    if data.get('overflowWrap') not in ('anywhere','break-word'):
        failures.append(f"{label}: long token has no safe wrap contract {data}")
    name=data.get('name') or {};side=data.get('side') or {}
    if name and side and name.get('right',0)>side.get('left',10**9)+1:
        failures.append(f"{label}: name collides with price/action {data}")


def main():
    failures=[]
    for viewport,width,height,mobile in VIEWPORTS:
        driver=driver_for(width,height,mobile)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return !!window.TDShoppingState"))
            load_runtime(driver)
            WebDriverWait(driver,10).until(lambda d:d.execute_script("return !!window.TDRoxyLongNamesV1"))
            seed(driver)
            time.sleep(.2)

            summary=box_metrics(driver,'.roxy-long-name-fixture .td-ai-line',':scope > span',':scope > b')
            assert_surface(failures,f"{viewport}/Bay summary",summary,LONG_NAME)

            driver.execute_script("TDComparisonResultV2.open()")
            WebDriverWait(driver,10).until(lambda d:d.execute_script("return !!document.querySelector('.td-compare-v2 .td-compare-why')"))
            time.sleep(.2)
            why=box_metrics(driver,'.td-compare-v2 .td-compare-why > div:has(> span):has(> b)',':scope > span',':scope > b')
            assert_surface(failures,f"{viewport}/comparison why",why,LONG_NAME)
            trust=box_metrics(driver,'.td-compare-v2 .td-trust-row',':scope > span',':scope > div')
            assert_surface(failures,f"{viewport}/comparison trust",trust,LONG_NAME)
            driver.save_screenshot(str(OUT/f"{viewport}-long-name-comparison.png"))
            driver.execute_script("TDComparisonResultV2.close({restoreFocus:false})")

            opened=driver.execute_script("return TDRealStoreIntegrationV1.open('pyat', TDShoppingState.get().lastPlans[0])")
            if opened is not True:
                raise AssertionError(f"retailer handoff did not open: {opened}")
            WebDriverWait(driver,10).until(lambda d:d.execute_script("return !!document.querySelector('.td-retailer-row a')"))
            time.sleep(.2)
            retailer=box_metrics(driver,'.td-retailer-row a',':scope > span',':scope > em')
            assert_surface(failures,f"{viewport}/retailer row",retailer,LONG_NAME)
            driver.save_screenshot(str(OUT/f"{viewport}-long-name-retailer.png"))
        except Exception as exc:
            failures.append(f"{viewport}: {exc}")
            try: driver.save_screenshot(str(OUT/f"{viewport}-long-name-failure.png"))
            except Exception: pass
        finally:
            driver.quit()

    if failures:
        print('Roxy long product-name QA failed:')
        for failure in failures: print('-',failure)
        return 1
    print('Roxy long product-name QA passed on small mobile, Android and desktop viewports.')
    return 0


if __name__=='__main__':
    raise SystemExit(main())
