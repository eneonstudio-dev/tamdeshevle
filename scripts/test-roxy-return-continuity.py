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
    for name,width,height in (("android",412,915),("desktop",1440,1000)):
        driver=driver_for(width,height)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver,20).until(lambda d:d.execute_script("return document.readyState")=='complete')
            imported=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              import('./votonobay-roxy-return-continuity-v1.js?v=qa').then(()=>done(Boolean(window.TDRoxyReturnContinuityV1))).catch(e=>done(String(e)));
            """)
            if imported is not True:
                raise AssertionError(imported)
            metrics=driver.execute_async_script("""
              const done=arguments[arguments.length-1];
              document.querySelector('.td-ai')?.remove();
              document.querySelector('.td-retailer-handoff')?.remove();
              const session={products:[{id:'milk',name:'Молоко',quantity:1}],lastPlans:[]};
              window.TDShoppingState={get(){return session}};
              window.__returnSubmitCount=0;
              window.TDShoppingAssistant={submit(){window.__returnSubmitCount+=1}};

              const root=document.createElement('section');
              root.className='td-ai';
              root.innerHTML='<div class="td-ai-shell"><div class="td-ai-head"><b>Бай</b></div><div class="td-ai-main" style="height:90px;overflow:auto"><div style="height:360px"><div class="td-ai-msg user">молоко до 1000 ₽</div><div class="td-ai-summary">корзина</div></div></div><div class="td-ai-compose"><textarea aria-label="Сообщение Баю"></textarea><button type="button">Отправить</button></div></div>';
              document.body.appendChild(root);
              const area=root.querySelector('textarea');
              area.value='оставь молоко и добавь хлеб';
              const main=root.querySelector('.td-ai-main');
              main.scrollTop=74;
              const firstLoad={notice:Boolean(document.querySelector('.roxy-return-continuity')),draft:area.value,scroll:main.scrollTop};

              const modal=document.createElement('div');
              modal.className='td-retailer-handoff';
              modal.innerHTML='<section class="td-retailer-card" style="height:300px;overflow:auto"><button class="td-retailer-x">×</button><h2>Собрать в магазине</h2><p>Открывай товары вручную</p><div class="td-retailer-row"><a href="#qa-return" target="_blank"><span>Молоко</span></a></div></section>';
              document.body.appendChild(modal);
              const link=modal.querySelector('a');
              link.addEventListener('click',event=>event.preventDefault());
              link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
              const armedOnly=!modal.querySelector('.roxy-return-continuity');
              window.TDRoxyReturnContinuityV1.visibility(true);
              window.TDRoxyReturnContinuityV1.visibility(false);

              setTimeout(()=>{
                const retailerNote=modal.querySelector('.roxy-return-continuity[data-surface="retailer"]');
                const retailerButton=retailerNote?.querySelector('button');
                const retailer={
                  armedOnly,
                  text:retailerNote?.innerText||'',
                  buttonHeight:retailerButton?.getBoundingClientRect().height||0,
                  draft:area.value,
                  submitCount:window.__returnSubmitCount,
                  state:JSON.stringify(session),
                  overflow:modal.querySelector('.td-retailer-card').scrollWidth-modal.querySelector('.td-retailer-card').clientWidth
                };
                retailerButton?.click();
                retailer.dismissed=!modal.querySelector('.roxy-return-continuity');
                retailer.focused=document.activeElement===link;
                modal.remove();

                const beforeHistory={draft:area.value,scroll:main.scrollTop,state:JSON.stringify(session),submitCount:window.__returnSubmitCount};
                const firstPageshow=window.TDRoxyReturnContinuityV1.pageShow({persisted:false});
                const normalPageshowNotice=Boolean(root.querySelector('.roxy-return-continuity'));
                window.TDRoxyReturnContinuityV1.pageShow({persisted:true});
                setTimeout(()=>{
                  const bayNote=root.querySelector('.roxy-return-continuity[data-surface="bay"]');
                  const bayButton=bayNote?.querySelector('button');
                  const history={
                    firstPageshow,
                    normalPageshowNotice,
                    text:bayNote?.innerText||'',
                    buttonHeight:bayButton?.getBoundingClientRect().height||0,
                    draft:area.value,
                    scroll:main.scrollTop,
                    state:JSON.stringify(session),
                    submitCount:window.__returnSubmitCount,
                    overflow:root.scrollWidth-root.clientWidth
                  };
                  bayButton?.click();
                  history.dismissed=!root.querySelector('.roxy-return-continuity');
                  history.focused=document.activeElement===area;
                  root.setAttribute('data-roxy-network-restored','1');
                  window.TDRoxyReturnContinuityV1.pageShow({persisted:true});
                  setTimeout(()=>done({firstLoad,retailer,beforeHistory,history,networkCollision:Boolean(root.querySelector('.roxy-return-continuity'))}),120);
                },160);
              },180);
            """)
            if metrics['firstLoad']['notice']:
                failures.append(f"{name}: return notice appeared on first load {metrics}")
            retailer=metrics['retailer']
            if not retailer['armedOnly']:
                failures.append(f"{name}: outbound click should arm return state without showing it early {metrics}")
            if 'ВЕРНУЛИСЬ ИЗ МАГАЗИНА?' not in retailer['text'] or 'Цены и наличие здесь не обновлялись автоматически' not in retailer['text']:
                failures.append(f"{name}: retailer return copy does not preserve the truth boundary {metrics}")
            if retailer['buttonHeight']<43.5 or retailer['overflow']>1:
                failures.append(f"{name}: retailer return action is not mobile-safe {metrics}")
            if not retailer['dismissed'] or not retailer['focused']:
                failures.append(f"{name}: retailer continue must dismiss and restore useful focus {metrics}")
            if retailer['draft']!=metrics['firstLoad']['draft'] or retailer['submitCount']!=0:
                failures.append(f"{name}: retailer return changed draft or submitted work {metrics}")

            history=metrics['history']
            before=metrics['beforeHistory']
            if history['firstPageshow'] or history['normalPageshowNotice']:
                failures.append(f"{name}: ordinary pageshow must not masquerade as a return {metrics}")
            if 'Корзина на месте' not in history['text'] or 'Ничего не пересчитывал и не отправлял' not in history['text']:
                failures.append(f"{name}: bfcache return does not explain preserved state safely {metrics}")
            if history['buttonHeight']<43.5 or history['overflow']>1:
                failures.append(f"{name}: Bay return action is not mobile-safe {metrics}")
            if history['draft']!=before['draft'] or history['state']!=before['state'] or history['submitCount']!=before['submitCount']:
                failures.append(f"{name}: return continuity mutated shopping state, draft, or submitted work {metrics}")
            if abs(history['scroll']-before['scroll'])>1:
                failures.append(f"{name}: Bay return notice yanked message scroll position {metrics}")
            if not history['dismissed'] or not history['focused']:
                failures.append(f"{name}: Bay continue must dismiss and return focus to composer {metrics}")
            if metrics['networkCollision']:
                failures.append(f"{name}: return notice must yield to network-recovery authority {metrics}")
        except Exception as exc:
            failures.append(f"{name}: {exc}")
        finally:
            driver.quit()
    if failures:
        print('Roxy return continuity QA failed:')
        for failure in failures: print('-',failure)
        return 1
    print('Roxy return continuity QA passed on desktop and Android-sized viewports: first load stays quiet, retailer/bfcache returns preserve state, and no action or refresh is repeated automatically.')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
