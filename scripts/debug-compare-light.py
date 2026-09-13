#!/usr/bin/env python3
import json, os, time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

url=os.environ.get('TD_UX_BASE_URL','http://127.0.0.1:4173/')
o=Options();o.add_argument('--headless=new');o.add_argument('--no-sandbox');o.add_argument('--disable-dev-shm-usage');o.add_argument('--window-size=1440,1000')
d=webdriver.Chrome(options=o)
try:
    d.get(url)
    WebDriverWait(d,20).until(lambda x:x.execute_script("return !!window.state && typeof window.go==='function'"))
    d.execute_script("localStorage.clear();state.storeId='pyat';state.cart={milk:1,bread:1,chicken:1,banana:1};state.cartTouched=true;window.render();window.go('compare')")
    time.sleep(1.2)
    rows=d.execute_script("""
      const needle='Переход недоступен';
      return [...document.querySelectorAll('body *')].filter(el=>{
        const r=el.getBoundingClientRect(),s=getComputedStyle(el),t=(el.textContent||'').trim();
        return t.includes(needle)&&r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
      }).map(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return {tag:el.tagName,id:el.id,cls:el.className,text:(el.textContent||'').trim().slice(0,500),outer:el.outerHTML.slice(0,1200),bg:s.backgroundColor,bgi:s.backgroundImage,color:s.color,border:s.border,borderRadius:s.borderRadius,position:s.position,left:r.left,top:r.top,width:r.width,height:r.height};
      }).sort((a,b)=>a.width*b.height-b.width*a.height).slice(0,20);
    """)
    print('COMPARE_LIGHT='+json.dumps(rows,ensure_ascii=False))
finally:
    d.quit()
