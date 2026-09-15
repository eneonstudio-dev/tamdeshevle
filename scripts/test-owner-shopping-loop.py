#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")


def driver_for() -> webdriver.Chrome:
    options = Options()
    for arg in (
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=412,915",
        "--user-agent=Mozilla/5.0 (Linux; Android 13; SM-N986N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
    ):
        options.add_argument(arg)
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(412, 915)
    return driver


def visible(driver: webdriver.Chrome, selector: str) -> bool:
    return bool(driver.execute_script(
        """
        return [...document.querySelectorAll(arguments[0])].some(el=>{
          const r=el.getBoundingClientRect(),s=getComputedStyle(el);
          return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0.01;
        });
        """,
        selector,
    ))


def entry_snapshot(driver: webdriver.Chrome) -> dict:
    return driver.execute_script(
        """
        const button=document.querySelector('.v2-hero-bai');
        const r=button?.getBoundingClientRect();
        const x=r?r.left+r.width/2:0,y=r?r.top+r.height/2:0;
        const top=r?document.elementFromPoint(x,y):null;
        const bs=button?getComputedStyle(button):null;
        return {
          screen:document.body.dataset.votonobayScreen||null,
          button:Boolean(button),
          display:bs?.display||null,
          opacity:bs?.opacity||null,
          visibility:bs?.visibility||null,
          pointer:bs?.pointerEvents||null,
          rect:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null,
          centerTop:top?{tag:top.tagName,id:top.id||'',className:String(top.className||''),insideButton:Boolean(button&&button.contains(top))}:null,
          askType:typeof window.tdBayFirstAsk,
          assistantOpenType:typeof window.TDShoppingAssistant?.open,
          capturedClicks:Number(window.__ownerEntryClicks||0),
          aiCount:document.querySelectorAll('.td-ai').length,
          overlayOpen:document.body.dataset.tdOverlayOpen||null
        };
        """
    )


def snapshot(driver: webdriver.Chrome) -> dict:
    return driver.execute_script(
        """
        const state=window.TDShoppingState?.snapshot?.()||null;
        const brain=window.TDBaiBrain?.status?.()||null;
        const messages=[...document.querySelectorAll('.td-ai-msg')].map(el=>({
          role:el.classList.contains('user')?'user':'assistant',
          text:(el.textContent||'').trim()
        }));
        const summary=document.querySelector('.td-ai-summary');
        const checkout=document.querySelector('.td-ai-checkout');
        return {
          state,
          brain,
          messages,
          summary:(summary?.textContent||'').trim(),
          checkoutVisible:Boolean(checkout&&checkout.getBoundingClientRect().width&&checkout.getBoundingClientRect().height),
          busy:document.querySelector('.td-ai')?.getAttribute('aria-busy')||null
        };
        """
    )


def product_signature(state: dict | None) -> list[tuple[str, int, str]]:
    rows=[]
    for product in (state or {}).get('products') or []:
        rows.append((str(product.get('sourceId') or product.get('id') or ''), int(product.get('quantity') or 0), str(product.get('storeId') or '')))
    return sorted(rows)


def send_turn(driver: webdriver.Chrome, text: str) -> dict:
    before=snapshot(driver)
    old_messages=len(before['messages'])
    textarea=next(el for el in driver.find_elements(By.CSS_SELECTOR, '.td-ai-compose textarea') if el.is_displayed())
    textarea.click()
    textarea.send_keys(Keys.CONTROL, 'a')
    textarea.send_keys(text)
    button=next(el for el in driver.find_elements(By.CSS_SELECTOR, '.td-ai-compose [data-ai-send]') if el.is_displayed())
    try:
        button.click()
    except WebDriverException as exc:
        raise AssertionError(f"physical Bay send click failed for {text!r}: {exc}; snapshot={snapshot(driver)}") from exc
    WebDriverWait(driver, 20).until(lambda d: len(snapshot(d)['messages']) >= old_messages + 2)
    WebDriverWait(driver, 20).until(lambda d: snapshot(d)['busy'] == 'false')
    current=snapshot(driver)
    if current['messages'][-2]['role']!='user' or current['messages'][-2]['text']!=text:
        raise AssertionError(f"visible conversation did not preserve user turn {text!r}: {current}")
    if current['messages'][-1]['role']!='assistant':
        raise AssertionError(f"Bay reply missing after {text!r}: {current}")
    return current


def main() -> int:
    driver=driver_for()
    failures: list[str]=[]
    trace: list[dict]=[]
    try:
        driver.get(BASE_URL)
        WebDriverWait(driver, 20).until(lambda d: d.execute_script("return document.readyState") == "complete")
        driver.execute_script("localStorage.clear()")
        driver.refresh()
        WebDriverWait(driver, 20).until(
            lambda d: d.execute_script("return document.readyState") == "complete"
            and d.execute_script("return !!window.TDShoppingAssistant && !!window.TDShoppingState && !!window.TDBai && !!window.tdBayFirstAsk")
        )
        driver.execute_script(
            """
            try {
              Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
                cancel(){},
                speak(utterance){setTimeout(()=>utterance?.onend?.(),0)}
              }});
            } catch (_) {}
            const entry=document.querySelector('.v2-hero-bai');
            window.__ownerEntryClicks=0;
            entry?.addEventListener('click',()=>{window.__ownerEntryClicks+=1},{capture:true});
            """
        )
        WebDriverWait(driver, 10).until(lambda d: visible(d, '.v2-hero-bai'))
        before_entry=entry_snapshot(driver)
        if before_entry.get('centerTop') and not before_entry['centerTop'].get('insideButton'):
            raise AssertionError(f"canonical Home Bay entry center is intercepted before click: {before_entry}")
        entry=next(el for el in driver.find_elements(By.CSS_SELECTOR, '.v2-hero-bai') if el.is_displayed())
        try:
            entry.click()
        except WebDriverException as exc:
            raise AssertionError(f"physical canonical Home Bay entry click failed: {exc}; entry={entry_snapshot(driver)}") from exc
        time.sleep(.35)
        if entry_snapshot(driver).get('capturedClicks',0) < 1:
            raise AssertionError("physical click never reached canonical Home Bay entry")
        WebDriverWait(driver, 8).until(lambda d: visible(d, '.td-ai-compose textarea') and visible(d, '.td-ai-compose [data-ai-send]'))

        dinner=send_turn(driver, 'собери мне еду на ужин на 100 рублей')
        trace.append({'turn':'dinner100','snapshot':dinner})
        if dinner['state'].get('budget') != 100:
            failures.append(f"100-ruble dinner lost budget: {dinner}")
        if dinner['state'].get('products') and float(dinner['state'].get('currentTotal') or 0) > 100.01:
            failures.append(f"100-ruble dinner violates its own budget: {dinner}")
        prefs=set(dinner['state'].get('preferences') or [])
        brain_goal=(dinner.get('brain') or {}).get('goal') or {}
        if 'dinner' not in prefs and brain_goal.get('occasion') != 'dinner':
            failures.append(f"dinner intent was not retained: {dinner}")
        before_hello=(dinner['state'].get('budget'), product_signature(dinner['state']), list(dinner['state'].get('stores') or []))

        hello=send_turn(driver, 'привет')
        trace.append({'turn':'hello','snapshot':hello})
        after_hello=(hello['state'].get('budget'), product_signature(hello['state']), list(hello['state'].get('stores') or []))
        if after_hello != before_hello:
            failures.append(f"greeting mutated shopping state: before={before_hello} after={after_hello}")
        if 'не понял' in hello['messages'][-1]['text'].lower():
            failures.append(f"ordinary greeting is rejected as an unknown shopping edit: {hello['messages'][-1]}")

        budget=send_turn(driver, 'собери мне корзину на 7000 рублей')
        trace.append({'turn':'basket7000','snapshot':budget})
        if budget['state'].get('budget') != 7000:
            failures.append(f"7000-ruble basket did not replace budget: {budget}")
        if not budget['state'].get('products'):
            failures.append(f"7000-ruble basket produced no products: {budget}")
        if float(budget['state'].get('currentTotal') or 0) > 7000.01:
            failures.append(f"7000-ruble basket exceeds budget: {budget}")

        magnit=send_turn(driver, 'Магнитом')
        trace.append({'turn':'magnit','snapshot':magnit})
        stores=list(magnit['state'].get('stores') or [])
        if stores != ['magnit']:
            failures.append(f"Magnit follow-up did not scope retailer projection: {magnit}")
        plan=(magnit['state'].get('lastPlans') or [None])[0] or {}
        plan_stores={str(row.get('storeId') or '') for row in (plan.get('products') or []) if row}
        if plan.get('products') and plan_stores != {'magnit'}:
            failures.append(f"Magnit projection still mixes store lines: stores={plan_stores}; snapshot={magnit}")
        before_yes=(magnit['state'].get('budget'), product_signature(magnit['state']), list(magnit['state'].get('stores') or []))

        yes=send_turn(driver, 'да')
        trace.append({'turn':'yes','snapshot':yes})
        after_yes=(yes['state'].get('budget'), product_signature(yes['state']), list(yes['state'].get('stores') or []))
        if after_yes != before_yes:
            failures.append(f"plain confirmation unexpectedly mutated the selected Magnit plan: before={before_yes} after={after_yes}")
        final_reply=yes['messages'][-1]['text'].lower()
        if 'не понял' in final_reply:
            failures.append(f"confirmation after a valid Magnit projection is rejected: {yes['messages'][-1]}")
        if any(word in final_reply for word in ('оформил заказ','заказ оформлен','оплатил','купил за тебя')):
            failures.append(f"Bay overclaims retailer/order capability after confirmation: {yes['messages'][-1]}")
        WebDriverWait(driver, 10).until(lambda d: snapshot(d)['checkoutVisible'])
        final=snapshot(driver)
        if not final['summary'] or 'магнит' not in final['summary'].lower():
            failures.append(f"visible final basket summary does not explain the Magnit projection: {final}")
        if not final['checkoutVisible']:
            failures.append(f"visible honest next-step card is missing after confirmed basket: {final}")

    except Exception as exc:
        failures.append(f"owner shopping loop regression raised: {exc}; entry={entry_snapshot(driver)}; snapshot={snapshot(driver)}")
    finally:
        if failures:
            print('Conversation trace:')
            print(json.dumps(trace, ensure_ascii=False, indent=2)[:30000])
            try:
                logs=driver.get_log('browser')
                if logs:
                    print('Browser console:')
                    print(json.dumps(logs[-80:], ensure_ascii=False, indent=2)[:16000])
            except Exception:
                pass
        driver.quit()

    if failures:
        print('Owner Bay shopping-loop QA failed:')
        for failure in failures:
            print('-', failure)
        return 1
    print('Owner Bay shopping loop passes through the canonical physical mobile UI: dinner 100 -> hello -> basket 7000 -> Magnit -> yes, with stable state and honest next step.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())