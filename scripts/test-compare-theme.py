#!/usr/bin/env python3
"""Regression check for late comparison notices that used to render beige."""
import os, re, time
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
    WebDriverWait(d,10).until(lambda x:x.execute_script("return document.querySelectorAll('.td-journey-unavailable').length>0"))
    time.sleep(.25)
    rows=d.execute_script("""
      return [...document.querySelectorAll('.td-journey-unavailable')].filter(el=>{
        const r=el.getBoundingClientRect(),s=getComputedStyle(el);
        return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
      }).map(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,color:s.color,border:s.border,text:(el.textContent||'').trim()}});
    """)
    if not rows:
        raise SystemExit('comparison theme QA: no visible unavailable notice')
    for row in rows:
        nums=[int(x) for x in re.findall(r'\d+',row['background'])[:3]]
        if len(nums)==3 and min(nums)>=220:
            raise SystemExit(f"comparison theme QA: legacy light notice remains: {row}")
    print(f"Comparison unavailable notices stay in the dark theme ({len(rows)} checked).")
finally:
    d.quit()
