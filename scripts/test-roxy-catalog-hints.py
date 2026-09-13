#!/usr/bin/env python3
"""Real-browser contract for the approved subtle Bay catalog hint."""
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
    return bool(driver.execute_script("""
      return [...document.querySelectorAll(arguments[0])].some(el=>{
        const r=el.getBoundingClientRect(),s=getComputedStyle(el);
        return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0';
      });
    """,selector))


def main():
    failures=[]
    for name,width,height,mobile in VIEWPORTS:
        driver=driver_for(width,height,mobile)
        label=f"{name}/catalog-hint"
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return !!window.state && typeof window.go==='function'"))
            driver.execute_script("localStorage.clear(); location.reload()")
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return !!window.state && typeof window.go==='function'"))
            driver.execute_script("state.storeId='pyat'; state.q='молоко'; go('catalog')")
            WebDriverWait(driver,10).until(lambda d:d.execute_script("return state.screen")=='catalog')
            WebDriverWait(driver,10).until(lambda d:visible(d,'.voto-catalog-search'))
            WebDriverWait(driver,10).until(lambda d:d.execute_script("return !!window.TDRoxyCatalogHintsV1"))
            WebDriverWait(driver,10).until(lambda d:visible(d,'.roxy-catalog-bay-hint'))
            time.sleep(.20)

            metrics=driver.execute_script("""
              const hint=document.querySelector('.roxy-catalog-bay-hint');
              const search=document.querySelector('.voto-catalog-search');
              const product=[...document.querySelectorAll('.voto-product-card,.wrap>.item')].find(el=>{
                const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
              });
              const ask=hint?.querySelector('.roxy-catalog-bay-ask');
              const dismiss=hint?.querySelector('.roxy-catalog-bay-dismiss');
              const img=hint?.querySelector('img');
              const hr=hint?.getBoundingClientRect(),sr=search?.getBoundingClientRect(),pr=product?.getBoundingClientRect(),ar=ask?.getBoundingClientRect(),dr=dismiss?.getBoundingClientRect();
              const hs=hint?getComputedStyle(hint):null;
              return {
                vw:innerWidth,docWidth:document.documentElement.scrollWidth,
                hint:hr?{left:hr.left,right:hr.right,top:hr.top,bottom:hr.bottom,width:hr.width,height:hr.height}:null,
                search:sr?{top:sr.top,bottom:sr.bottom}:null,
                product:pr?{top:pr.top,bottom:pr.bottom}:null,
                ask:ar?{w:ar.width,h:ar.height,text:ask.textContent.trim()}:null,
                dismiss:dr?{w:dr.width,h:dr.height}:null,
                position:hs?.position||'',
                title:hint?.querySelector('.roxy-catalog-bay-copy b')?.textContent?.trim()||'',
                bayLoaded:!!img&&img.complete&&img.naturalWidth>0,
                stylesheet:!!document.querySelector('link[data-roxy-catalog-hints-v1="1"]')
              };
            """)

            if metrics.get('title')!='Смотри на корзину целиком.': failures.append(f"{label}: wrong hint copy {metrics}")
            if metrics.get('position')=='fixed': failures.append(f"{label}: hint became floating UI {metrics}")
            if not metrics.get('stylesheet'): failures.append(f"{label}: stylesheet missing")
            if not metrics.get('bayLoaded'): failures.append(f"{label}: approved Bay reaction did not load")
            if metrics.get('docWidth',0)>metrics.get('vw',0)+2: failures.append(f"{label}: horizontal overflow {metrics}")
            hint=metrics.get('hint') or {}
            search=metrics.get('search') or {}
            product=metrics.get('product') or {}
            if hint and (hint.get('left',0)<-2 or hint.get('right',0)>metrics.get('vw',0)+2): failures.append(f"{label}: hint leaves viewport {metrics}")
            if hint and search and hint.get('top',0)<search.get('bottom',0)-2: failures.append(f"{label}: hint overlaps search instead of following it {metrics}")
            if hint and product and hint.get('bottom',0)>product.get('top',0)+2: failures.append(f"{label}: hint overlaps product cards {metrics}")
            if mobile:
                for key in ('ask','dismiss'):
                    target=metrics.get(key) or {}
                    if target.get('h',0)<43.5 or target.get('w',0)<43.5: failures.append(f"{label}: {key} touch target too small {target}")

            driver.save_screenshot(str(OUT/f"{name}-catalog-hint.png"))

            driver.execute_script("document.querySelector('.roxy-catalog-bay-ask')?.click()")
            WebDriverWait(driver,10).until(lambda d:visible(d,'body>.td-ai .td-ai-shell'))
            driver.execute_script("document.querySelector('body>.td-ai [data-ai-close]')?.click()")
            WebDriverWait(driver,10).until(lambda d:not visible(d,'body>.td-ai .td-ai-shell'))

            driver.execute_script("document.querySelector('.roxy-catalog-bay-dismiss')?.click()")
            WebDriverWait(driver,10).until(lambda d:not visible(d,'.roxy-catalog-bay-hint'))
            driver.execute_script("window.TDRoxyCatalogHintsV1?.decorate?.()")
            time.sleep(.20)
            if visible(driver,'.roxy-catalog-bay-hint'):
                failures.append(f"{label}: dismissed hint reappeared in the same browsing session")
        except Exception as exc:
            failures.append(f"{label}: {exc}")
            try: driver.save_screenshot(str(OUT/f"{name}-catalog-hint-failure.png"))
            except Exception: pass
        finally:
            driver.quit()

    if failures:
        print("Roxy catalog hint QA failed:")
        for failure in failures: print("-",failure)
        return 1
    print("Roxy catalog hint QA passed on desktop and Android-sized viewports.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
