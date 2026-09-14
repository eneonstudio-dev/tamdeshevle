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
    for name,width,height,mobile in (("android",412,915,True),("desktop",1440,1000,False)):
        driver=driver_for(width,height)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            result=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              import('./votonobay-roxy-mobile-compose-v1.js?v=qa').then(()=>done(true)).catch(e=>done(String(e)));
            """)
            if result is not True:
                raise AssertionError(result)
            metrics=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              const old=document.querySelector('.td-ai');old?.remove();
              const root=document.createElement('section');
              root.className='td-ai';
              root.innerHTML=`<div class="td-ai-shell"><div class="td-ai-main"><div style="height:1200px">Длинный ответ Бая</div></div><div class="td-ai-compose"><textarea aria-label="Сообщение Баю"></textarea><button type="button" data-ai-mic>●</button><button type="button" class="td-ai-send">Отправить</button></div></div>`;
              document.body.appendChild(root);
              TDRoxyMobileComposeV1.decorate(root);
              const area=root.querySelector('textarea'),main=root.querySelector('.td-ai-main');
              area.value=Array.from({length:18},(_,i)=>`длинная строка ${i+1}`).join('\n');
              area.dispatchEvent(new Event('input',{bubbles:true}));
              main.scrollTop=200;
              const state=TDRoxyMobileComposeV1.snapshot(main);
              const fake={height:580,offsetTop:0,innerHeight:915};
              const viewport=TDRoxyMobileComposeV1.applyViewport(root,fake,state);
              setTimeout(()=>{
                const send=root.querySelector('.td-ai-send'),mic=root.querySelector('[data-ai-mic]');
                const first={
                  decorated:root.dataset.roxyMobileCompose,
                  keyboard:root.hasAttribute('data-roxy-keyboard-open'),
                  heightVar:root.style.getPropertyValue('--td-ai-vvh'),
                  scrollTop:main.scrollTop,
                  areaHeight:area.getBoundingClientRect().height,
                  areaScroll:area.dataset.roxyTextareaScroll,
                  sendHeight:send.getBoundingClientRect().height,
                  micHeight:mic.getBoundingClientRect().height,
                  viewportKeyboard:viewport.keyboard,
                  horizontalOverflow:root.scrollWidth-root.clientWidth
                };
                main.scrollTop=main.scrollHeight;
                const bottomState=TDRoxyMobileComposeV1.snapshot(main);
                TDRoxyMobileComposeV1.applyViewport(root,fake,bottomState);
                setTimeout(()=>done({...first,bottomGap:main.scrollHeight-main.scrollTop-main.clientHeight}),80);
              },100);
            """)
            if metrics['decorated']!='1': failures.append(f"{name}: composer layer not decorated {metrics}")
            if metrics['areaHeight']<47.5 or metrics['areaHeight']>105: failures.append(f"{name}: textarea growth outside cap {metrics}")
            if metrics['areaScroll']!='1': failures.append(f"{name}: long textarea did not become internally scrollable {metrics}")
            if metrics['sendHeight']<43.5 or metrics['micHeight']<43.5: failures.append(f"{name}: composer touch target too short {metrics}")
            if abs(metrics['scrollTop']-200)>3: failures.append(f"{name}: keyboard viewport yanked reader from old content {metrics}")
            if metrics['bottomGap']>3: failures.append(f"{name}: near-bottom conversation did not stay at latest content {metrics}")
            if metrics['horizontalOverflow']>1: failures.append(f"{name}: horizontal overflow {metrics}")
            if mobile:
                if not metrics['keyboard'] or not metrics['viewportKeyboard']: failures.append(f"{name}: keyboard state not detected {metrics}")
                if metrics['heightVar']!='580px': failures.append(f"{name}: visual viewport height not applied {metrics}")
            else:
                if metrics['keyboard'] or metrics['viewportKeyboard']: failures.append(f"{name}: desktop falsely entered keyboard state {metrics}")
        except Exception as exc:
            failures.append(f"{name}: {exc}")
        finally:
            driver.quit()
    if failures:
        print('Roxy mobile composer QA failed:')
        for failure in failures: print('-',failure)
        return 1
    print('Roxy mobile composer QA passed on desktop and Android-sized viewports.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
