#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")

opts=Options()
for arg in (
    "--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
    "--window-size=412,915",
    "--user-agent=Mozilla/5.0 (Linux; Android 13; SM-N986N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
): opts.add_argument(arg)

d=webdriver.Chrome(options=opts)
d.set_window_size(412,915)
try:
    d.get(BASE_URL)
    WebDriverWait(d,20).until(lambda x:x.execute_script("return document.readyState") == "complete")
    d.execute_script("localStorage.clear()")
    d.refresh()
    WebDriverWait(d,20).until(lambda x:x.execute_script("return document.readyState") == "complete" and x.execute_script("return !!document.querySelector('#bai-assistant')"))
    state=d.execute_script("""
      const body=document.body;
      const host=document.querySelector('#bai-assistant');
      const button=document.querySelector('.bai-character');
      const hs=getComputedStyle(host), bs=getComputedStyle(button);
      const r=button.getBoundingClientRect();
      const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      const ae=document.activeElement;
      return {
        bodyClass:body.className,
        screen:body.dataset.votonobayScreen||null,
        keyboardAttr:body.hasAttribute('data-td-keyboard-open'),
        keyboardValue:body.getAttribute('data-td-keyboard-open'),
        innerWidth:innerWidth,
        innerHeight:innerHeight,
        visualViewport:window.visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null,
        activeElement:ae?{tag:ae.tagName,id:ae.id||'',className:String(ae.className||''),type:ae.type||null}:null,
        hostClass:host.className,
        hostDisplay:hs.display,
        hostOpacity:hs.opacity,
        hostPointer:hs.pointerEvents,
        buttonDisplay:bs.display,
        buttonOpacity:bs.opacity,
        buttonPointer:bs.pointerEvents,
        rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
        centerTop:top?{tag:top.tagName,id:top.id||'',className:String(top.className||''),insideButton:button.contains(top)}:null,
        uiParked:host.dataset.uiParked||null,
        overlayOpen:body.dataset.tdOverlayOpen||null
      };
    """)
    print(json.dumps(state,ensure_ascii=False,indent=2))
    if state['hostDisplay']=='none' or float(state['hostOpacity']) <= .01 or state['hostPointer']=='none' or not state['centerTop'] or not state['centerTop']['insideButton']:
        raise AssertionError(f"mobile Bay launcher is not physically available after cold start: {state}")
    print('Mobile Bay launcher is physically available after cold start.')
finally:
    d.quit()
