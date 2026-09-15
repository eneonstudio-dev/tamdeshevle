#!/usr/bin/env python3
import json, os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

BASE=os.environ.get('TD_UX_BASE_URL','http://127.0.0.1:4173/')
o=Options()
for arg in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=412,915','--user-agent=Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36'): o.add_argument(arg)
d=webdriver.Chrome(options=o); d.set_window_size(412,915)
try:
    d.get(BASE); WebDriverWait(d,20).until(lambda x:x.execute_script('return document.readyState')=='complete')
    d.execute_script('localStorage.clear()'); d.refresh()
    WebDriverWait(d,20).until(lambda x:x.execute_script("return !!window.TDShoppingAssistant&&!!window.TDShoppingState&&!!window.TDBaiShoppingAgentKernel"))
    d.execute_script("""
      const k=window.TDBaiShoppingAgentKernel, original=k.run.bind(k); window.__routeCalls=[];
      k.run=async args=>{window.__routeCalls.push(JSON.parse(JSON.stringify(args))); return original(args)};
      try{Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(u){setTimeout(()=>u?.onend?.(),0)}}})}catch(_){}
    """)
    d.find_element(By.CSS_SELECTOR,'.v2-hero-bai').click()
    WebDriverWait(d,10).until(lambda x:any(e.is_displayed() for e in x.find_elements(By.CSS_SELECTOR,'.td-ai-compose textarea')))
    a=next(e for e in d.find_elements(By.CSS_SELECTOR,'.td-ai-compose textarea') if e.is_displayed()); a.send_keys('собери мне еду на ужин на 100 рублей')
    next(e for e in d.find_elements(By.CSS_SELECTOR,'.td-ai-compose [data-ai-send]') if e.is_displayed()).click()
    WebDriverWait(d,20).until(lambda x:x.execute_script("return document.querySelector('.td-ai')?.getAttribute('aria-busy')==='false' && window.__routeCalls.length>0"))
    print(json.dumps(d.execute_script("return {calls:window.__routeCalls,state:window.TDShoppingState.snapshot(),brain:window.TDBaiBrain?.status?.()||null,messages:[...document.querySelectorAll('.td-ai-msg')].map(x=>x.textContent.trim())}"),ensure_ascii=False,indent=2))
finally:
    d.quit()
