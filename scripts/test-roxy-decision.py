#!/usr/bin/env python3
"""Browser contract for the Roxy conclusion-first Bay decision surface."""
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


def driver_for(name,width,height,mobile):
    options=Options()
    for arg in ("--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--hide-scrollbars",f"--window-size={width},{height}"):
        options.add_argument(arg)
    if mobile:
        options.add_argument("--user-agent=Mozilla/5.0 (Linux; Android 13; SM-N986N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36")
    driver=webdriver.Chrome(options=options)
    driver.set_window_size(width,height)
    return driver


def visible(driver,selector):
    return driver.execute_script("""
      return [...document.querySelectorAll(arguments[0])].some(el=>{
        const r=el.getBoundingClientRect(),s=getComputedStyle(el);
        return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
      });
    """,selector)


def seed_decision(driver):
    driver.execute_script("""
      const line={id:'milk',sourceId:'milk',name:'Молоко 3,2%',pack:'1 л',emoji:'🥛',brand:'',quantity:1,storeId:'pyat',unitPrice:89,price:89,quality:'LIVE'};
      const best={id:'qa-one',type:'one',stores:['pyat'],products:[line],goods:89,convenienceCost:0,total:89,quality:'VERIFIED'};
      TDShoppingState.commit('QA_DECISION',s=>{
        s.products=[line];
        s.requiredProducts=['milk'];
        s.onlyProducts=['milk'];
        s.selectionMode='only';
        s.lastPlans=[best];
        s.currentTotal=89;
      },'QA decision seed');
      TDShoppingAssistant.refresh();
    """)


def main():
    failures=[]
    for name,width,height,mobile in VIEWPORTS:
        driver=driver_for(name,width,height,mobile)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return !!window.TDShoppingState && !!window.TDShoppingAssistant"))
            driver.execute_script("localStorage.clear(); location.reload()")
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return !!window.TDShoppingState && !!window.TDShoppingAssistant && !!window.TDRoxyBayPanel"))
            driver.execute_script("TDShoppingAssistant.open()")
            WebDriverWait(driver,10).until(lambda d:visible(d,"body>.td-ai .td-ai-shell"))
            seed_decision(driver)
            WebDriverWait(driver,10).until(lambda d:visible(d,'.td-ai-decision-cta[data-roxy-decision="1"]'))
            driver.execute_script("return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
            time.sleep(.20)
            metrics=driver.execute_script("""
              const root=document.querySelector('body>.td-ai');
              const decision=root?.querySelector('.td-ai-decision-cta[data-roxy-decision="1"]');
              const alt=root?.querySelector('.roxy-decision-alternatives');
              const details=root?.querySelector('.roxy-decision-details');
              const primary=decision?.querySelector('.td-ai-decision-primary');
              const why=decision?.querySelector('.roxy-decision-why');
              const tradeoff=decision?.querySelector('.roxy-decision-tradeoff');
              const bay=decision?.querySelector('.roxy-decision-bay');
              const title=decision?.querySelector('.roxy-decision-heading>b')?.textContent?.trim()||'';
              const order=(a,b)=>a&&b?Boolean(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING):null;
              const dr=decision?.getBoundingClientRect(),pr=primary?.getBoundingClientRect();
              return {
                title,why:!!why,tradeoff:!!tradeoff,bay:!!bay,hasAlternatives:!!alt,
                decisionBeforeAlternatives:order(decision,alt),
                decisionBeforeDetails:order(decision,details),
                primary:pr?{w:pr.width,h:pr.height,text:primary.textContent.trim()}:null,
                decision:dr?{left:dr.left,right:dr.right,top:dr.top,bottom:dr.bottom,width:dr.width,height:dr.height}:null,
                stylesheet:!!document.querySelector('link[data-roxy-decision-v1="1"]'),
                docWidth:document.documentElement.scrollWidth,vw:innerWidth,vh:innerHeight
              };
            """)
            label=f"{name}/decision"
            if metrics.get("title")!="Я бы выбрал этот план.": failures.append(f"{label}: wrong verdict title {metrics}")
            if not metrics.get("why"): failures.append(f"{label}: WHY block missing")
            if not metrics.get("tradeoff"): failures.append(f"{label}: tradeoff block missing")
            if not metrics.get("bay"): failures.append(f"{label}: Bay reaction missing")
            if metrics.get("hasAlternatives") and metrics.get("decisionBeforeAlternatives") is not True: failures.append(f"{label}: alternatives appear before verdict {metrics}")
            if metrics.get("decisionBeforeDetails") is not True: failures.append(f"{label}: basket details appear before verdict {metrics}")
            if not metrics.get("stylesheet"): failures.append(f"{label}: Roxy decision stylesheet missing")
            if metrics.get("docWidth",0)>metrics.get("vw",0)+2: failures.append(f"{label}: horizontal overflow {metrics}")
            primary=metrics.get("primary") or {}
            if mobile and primary.get("h",0)<43.5: failures.append(f"{label}: primary action too short {primary}")
            decision=metrics.get("decision") or {}
            if decision and (decision.get("left",0)<-2 or decision.get("right",0)>metrics.get("vw",0)+2): failures.append(f"{label}: decision leaves viewport horizontally {metrics}")
            if mobile and decision and not (decision.get("bottom",0)>100 and decision.get("top",99999)<metrics.get("vh",0)-100): failures.append(f"{label}: verdict is not revealed before basket details {metrics}")
            driver.save_screenshot(str(OUT/f"{name}-decision.png"))
        except Exception as exc:
            failures.append(f"{name}/decision: {exc}")
            try: driver.save_screenshot(str(OUT/f"{name}-decision-failure.png"))
            except Exception: pass
        finally:
            driver.quit()
    if failures:
        print("Roxy decision QA failed:")
        for failure in failures: print("-",failure)
        return 1
    print("Roxy decision QA passed on desktop and Android-sized viewports.")
    return 0


if __name__=="__main__":
    raise SystemExit(main())
