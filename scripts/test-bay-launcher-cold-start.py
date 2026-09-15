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
    WebDriverWait(d,20).until(lambda x:x.execute_script("return document.readyState") == "complete" and x.execute_script("return !!document.querySelector('.v2-hero-bai') && !!window.tdBayFirstAsk"))
    state=d.execute_script("""
      const body=document.body;
      const entry=document.querySelector('.v2-hero-bai');
      const primary=document.querySelector('.v2-bay-primary');
      const legacy=document.querySelector('#bai-assistant');
      const es=getComputedStyle(entry), ps=primary?getComputedStyle(primary):null, ls=legacy?getComputedStyle(legacy):null;
      const r=entry.getBoundingClientRect();
      const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      const ae=document.activeElement;
      return {
        bodyClass:body.className,
        screen:body.dataset.votonobayScreen||null,
        innerWidth:innerWidth,
        innerHeight:innerHeight,
        visualViewport:window.visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null,
        activeElement:ae?{tag:ae.tagName,id:ae.id||'',className:String(ae.className||'')}:null,
        entryDisplay:es.display,
        entryOpacity:es.opacity,
        entryVisibility:es.visibility,
        entryPointer:es.pointerEvents,
        entryRect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
        entryCenterTop:top?{tag:top.tagName,id:top.id||'',className:String(top.className||''),insideEntry:entry.contains(top)}:null,
        primaryDisplay:ps?.display||null,
        primaryOpacity:ps?.opacity||null,
        primaryPointer:ps?.pointerEvents||null,
        legacyDisplay:ls?.display||null,
        legacyOpacity:ls?.opacity||null,
        legacyPointer:ls?.pointerEvents||null,
        askType:typeof window.tdBayFirstAsk,
        assistantOpenType:typeof window.TDShoppingAssistant?.open,
        overlayOpen:body.dataset.tdOverlayOpen||null
      };
    """)
    print(json.dumps(state,ensure_ascii=False,indent=2))
    rect=state['entryRect']
    if state['entryDisplay']=='none' or float(state['entryOpacity']) <= .01 or state['entryVisibility']=='hidden' or state['entryPointer']=='none' or rect['width'] <= 0 or rect['height'] <= 0 or not state['entryCenterTop'] or not state['entryCenterTop']['insideEntry']:
        raise AssertionError(f"canonical Home Bay entry is not physically available after cold start: {state}")
    if state['askType'] != 'function' or state['assistantOpenType'] != 'function':
        raise AssertionError(f"canonical Home Bay entry has no loaded assistant path: {state}")
    print('Canonical Home Bay entry is physically available after cold start. Legacy floating Bay may remain intentionally hidden on Home.')
finally:
    d.quit()