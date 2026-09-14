#!/usr/bin/env python3
from __future__ import annotations
import os
import time
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
    for name,width,height in (("android",412,915),("desktop",1440,1000)):
        driver=driver_for(width,height)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            imported=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              import('./votonobay-roxy-network-recovery-v1.js?v=qa').then(()=>done(true)).catch(e=>done(String(e)));
            """)
            if imported is not True:
                raise AssertionError(imported)
            metrics=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              document.querySelector('.td-ai')?.remove();
              window.__roxySubmitCount=0;
              window.TDShoppingAssistant={submit(){window.__roxySubmitCount+=1}};
              const root=document.createElement('section');
              root.className='td-ai';
              root.innerHTML='<div class="td-ai-shell"><div class="td-ai-head"><b>Бай</b></div><div class="td-ai-main"><div class="td-ai-messages"></div></div><div class="td-ai-compose"><textarea aria-label="Сообщение Баю"></textarea><button type="button" data-ai-mic>●</button><button type="button" class="td-ai-send">Отправить</button></div></div>';
              document.body.appendChild(root);
              const area=root.querySelector('textarea');
              area.value='молоко, хлеб и яйца до 1000 ₽';
              TDRoxyNetworkRecoveryV1.attach(root,false);
              const offline={state:root.dataset.roxyNetwork,banner:Boolean(root.querySelector('.roxy-network-restored'))};
              TDRoxyNetworkRecoveryV1.sync(true);
              setTimeout(()=>{
                const note=root.querySelector('.roxy-network-restored');
                const button=note?.querySelector('[data-roxy-network-continue]');
                const restored={
                  offline,
                  state:root.dataset.roxyNetwork,
                  restored:root.getAttribute('data-roxy-network-restored'),
                  noteText:note?.innerText||'',
                  buttonHeight:button?.getBoundingClientRect().height||0,
                  draft:area.value,
                  submitCount:window.__roxySubmitCount,
                  overflow:root.scrollWidth-root.clientWidth
                };
                button?.click();
                setTimeout(()=>done({...restored,
                  dismissed:!root.querySelector('.roxy-network-restored'),
                  focused:document.activeElement===area,
                  draftAfter:area.value,
                  submitAfter:window.__roxySubmitCount
                }),80);
              },140);
            """)
            if metrics['offline']['state']!='offline' or metrics['offline']['banner']:
                failures.append(f"{name}: offline phase should rely on the existing runtime card, not a reconnect banner {metrics}")
            if metrics['state']!='online' or metrics['restored']!='1':
                failures.append(f"{name}: reconnect acknowledgement missing {metrics}")
            if 'СЕТЬ ВЕРНУЛАСЬ' not in metrics['noteText'] or 'Ничего не отправляю повторно' not in metrics['noteText']:
                failures.append(f"{name}: reconnect copy does not state the safe boundary {metrics}")
            if metrics['buttonHeight']<43.5:
                failures.append(f"{name}: continue touch target is too short {metrics}")
            if metrics['draft']!='молоко, хлеб и яйца до 1000 ₽' or metrics['draftAfter']!=metrics['draft']:
                failures.append(f"{name}: reconnect flow changed the user's draft {metrics}")
            if metrics['submitCount']!=0 or metrics['submitAfter']!=0:
                failures.append(f"{name}: reconnect flow must not auto-submit or repeat shopping actions {metrics}")
            if not metrics['dismissed'] or not metrics['focused']:
                failures.append(f"{name}: continue must dismiss the notice and return focus to compose {metrics}")
            if metrics['overflow']>1:
                failures.append(f"{name}: reconnect notice causes horizontal overflow {metrics}")
        except Exception as exc:
            failures.append(f"{name}: {exc}")
        finally:
            driver.quit()
    if failures:
        print('Roxy network recovery QA failed:')
        for failure in failures: print('-',failure)
        return 1
    print('Roxy network recovery QA passed on desktop and Android-sized viewports: reconnect is explicit, preserves the draft, and never auto-repeats shopping actions.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
