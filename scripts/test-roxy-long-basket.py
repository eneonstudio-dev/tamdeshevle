#!/usr/bin/env python3
from __future__ import annotations
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.environ.get("TD_UX_BASE_URL","http://127.0.0.1:4173/")

def driver_for(width,height):
    options=Options()
    for arg in ("--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",f"--window-size={width},{height}"):
        options.add_argument(arg)
    driver=webdriver.Chrome(options=options)
    driver.set_window_size(width,height)
    return driver

def main():
    failures=[]
    for name,width,height,expected in (("android",412,915,5),("desktop",1440,1000,8)):
        driver=driver_for(width,height)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            result=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              import('./votonobay-roxy-long-basket-v1.js?v=qa').then(()=>done(true)).catch(e=>done(String(e)));
            """)
            if result is not True: raise AssertionError(result)
            driver.execute_script("""
              const host=document.createElement('section');
              host.className='td-ai-summary';
              host.innerHTML='<div class="td-ai-summary-head"><b>Корзина · 10</b></div>'+Array.from({length:10},(_,i)=>`<div class="td-ai-line"><span>Товар ${i+1}</span><b>${i+1} ₽</b></div>`).join('')+'<div class="td-ai-total"><span>Итого</span><strong>55 ₽</strong></div>';
              document.body.appendChild(host);
              TDRoxyLongBasketV1.decorate(host);
            """)
            WebDriverWait(driver,5).until(lambda d:d.execute_script("return (document.querySelector('.roxy-long-basket-toggle')?.getBoundingClientRect().height||0)>=43.5"))
            metrics=driver.execute_script("""
              const host=document.querySelector('.td-ai-summary'),button=host.querySelector('.roxy-long-basket-toggle');
              return {visible:[...host.querySelectorAll(':scope > .td-ai-line')].filter(x=>!x.hidden).length,text:button?.textContent||'',expanded:button?.getAttribute('aria-expanded')||'',height:button?.getBoundingClientRect().height||0};
            """)
            if metrics['visible']!=expected: failures.append(f"{name}: expected {expected} visible, got {metrics}")
            if not metrics['text'].startswith('Показать ещё '): failures.append(f"{name}: missing disclosure copy {metrics}")
            if metrics['expanded']!='false': failures.append(f"{name}: wrong collapsed aria state {metrics}")
            if metrics['height']<43.5: failures.append(f"{name}: toggle touch target too short {metrics}")
            expanded=driver.execute_script("""
              const host=document.querySelector('.td-ai-summary');host.querySelector('.roxy-long-basket-toggle').click();
              const button=host.querySelector('.roxy-long-basket-toggle');
              return {visible:[...host.querySelectorAll(':scope > .td-ai-line')].filter(x=>!x.hidden).length,text:button.textContent,expanded:button.getAttribute('aria-expanded')};
            """)
            if expanded['visible']!=10 or expanded['expanded']!='true' or expanded['text']!='Свернуть корзину': failures.append(f"{name}: expand failed {expanded}")
        except Exception as exc:
            failures.append(f"{name}: {exc}")
        finally:
            driver.quit()
    if failures:
        print('Roxy long basket QA failed:')
        for failure in failures: print('-',failure)
        return 1
    print('Roxy long basket QA passed on desktop and Android-sized viewports.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
