#!/usr/bin/env python3
"""Release Gate D browser contract for honest retailer redirect handoff."""
from __future__ import annotations

import os
import pathlib
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")
OUT = pathlib.Path(os.environ.get("TD_UX_OUT_DIR", "artifacts/ux-browser"))
OUT.mkdir(parents=True, exist_ok=True)
VIEWPORTS = (("desktop", 1440, 1000, False), ("android", 412, 915, True))
RETAILERS = {
    "perek": ("Перекрёсток", "perekrestok.ru"),
    "pyat": ("Пятёрочка", "5ka.ru"),
    "magnit": ("Магнит", "magnit.ru"),
    "lenta": ("Лента", "lenta.com"),
    "dixy": ("Дикси", "dixy.ru"),
}


def driver_for(width: int, height: int, mobile: bool):
    options = Options()
    for arg in (
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--window-size={width},{height}",
    ):
        options.add_argument(arg)
    if mobile:
        options.add_argument(
            "--user-agent=Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
        )
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(width, height)
    return driver


def verify_matrix() -> list[str]:
    failures: list[str] = []
    text = pathlib.Path("RETAILER_CAPABILITIES.md").read_text(encoding="utf-8")
    for _rid, (name, _host) in RETAILERS.items():
        row = next((line for line in text.splitlines() if line.startswith(f"| {name} |")), "")
        if not row:
            failures.append(f"matrix: missing declared retailer {name}")
            continue
        if "REDIRECT" not in row or "| NO |" not in row:
            failures.append(f"matrix: {name} must remain REDIRECT with no cart/order automation: {row}")
    return failures


def load_modules(driver):
    result = driver.execute_async_script(
        """
        const done=arguments[arguments.length-1];
        Promise.all([
          window.TDContinueInStoresV1?Promise.resolve():import('./continue-in-stores-v1.js?v=qa-gate-d'),
          window.TDRealStoreIntegrationV1?Promise.resolve():import('./real-store-integration-v1.js?v=qa-gate-d'),
          window.TDRoxyHandoffV1?Promise.resolve():import('./votonobay-roxy-handoff-v1.js?v=qa-gate-d')
        ]).then(()=>done(true)).catch(error=>done(String(error)));
        """
    )
    if result is not True:
        raise AssertionError(f"handoff modules failed to load: {result}")


def seed_plan(driver):
    driver.execute_script(
        """
        const stores=['perek','pyat','magnit','lenta','dixy','samokat'];
        const names={perek:'Молоко',pyat:'Хлеб',magnit:'Яйца',lenta:'Макароны',dixy:'Яблоки',samokat:'Вода'};
        const products=stores.map((storeId,index)=>({
          id:`gate-d-${storeId}`,
          name:`${names[storeId]} · Gate D`,
          pack:'1 шт',quantity:1,storeId,unitPrice:100+index,price:100+index,quality:'ESTIMATED'
        }));
        const plan={id:'qa-gate-d',type:'multi',stores,products,goods:615,convenienceCost:0,total:615,quality:'ESTIMATED'};
        TDShoppingState.commit('QA_GATE_D',s=>{s.products=products;s.lastPlans=[plan];s.currentTotal=615},'QA Gate D');
        window.__qaGateDPlan=plan;
        """
    )


def continue_metrics(driver):
    return driver.execute_script(
        """
        const plan=window.__qaGateDPlan;
        const supported=TDRealStoreIntegrationV1.supportedRetailers(plan).map(x=>({id:x.id,name:x.name}));
        const root=document.querySelector('.td-continue-stores');
        const rows=[...root?.querySelectorAll('.td-continue-store-row')||[]].map(row=>({
          id:row.dataset.storeId||'',text:row.textContent.trim()
        }));
        const warning=root?.querySelector('.td-continue-stores-warning')?.textContent?.trim()||'';
        const truth=root?.querySelector('.roxy-handoff-truth')?.textContent?.trim()||'';
        const card=root?.querySelector('.td-continue-stores-card');
        const cr=card?.getBoundingClientRect();
        return {
          supported,rows,warning,truth,
          docWidth:document.documentElement.scrollWidth,vw:innerWidth,
          card:cr?{left:cr.left,right:cr.right,width:cr.width}:null
        };
        """
    )


def retailer_metrics(driver, rid: str):
    return driver.execute_script(
        """
        const rid=arguments[0],plan=window.__qaGateDPlan;
        const opened=TDRealStoreIntegrationV1.open(rid,plan);
        const card=document.querySelector('.td-retailer-card');
        const title=card?.querySelector('h2')?.textContent?.trim()||'';
        const intro=card?.querySelector('h2+p')?.textContent?.trim()||'';
        const note=card?.querySelector('.td-retailer-note')?.textContent?.trim()||'';
        const item=card?.querySelector('.td-retailer-row a');
        const main=card?.querySelector('.td-retailer-main');
        const cr=card?.getBoundingClientRect();
        const rect=el=>{const r=el?.getBoundingClientRect();return r?{w:r.width,h:r.height,left:r.left,right:r.right}:null};
        return {
          opened,title,intro,note,
          itemHref:item?.href||'',itemHost:item?new URL(item.href).hostname:'',itemTarget:item?.target||'',itemRel:item?.rel||'',itemRect:rect(item),
          mainHref:main?.href||'',mainHost:main?new URL(main.href).hostname:'',mainTarget:main?.target||'',mainRel:main?.rel||'',mainRect:rect(main),
          docWidth:document.documentElement.scrollWidth,vw:innerWidth,
          card:cr?{left:cr.left,right:cr.right,width:cr.width}:null
        };
        """,
        rid,
    )


def main() -> int:
    failures = verify_matrix()
    expected_ids = set(RETAILERS)

    for viewport, width, height, mobile in VIEWPORTS:
        driver = driver_for(width, height, mobile)
        try:
            driver.get(BASE_URL)
            WebDriverWait(driver, 20).until(lambda d: d.execute_script("return document.readyState") == "complete")
            WebDriverWait(driver, 20).until(lambda d: d.execute_script("return !!window.TDShoppingState"))
            driver.execute_script("localStorage.clear()")
            load_modules(driver)
            seed_plan(driver)

            opened = driver.execute_script("return TDContinueInStoresV1.open(window.__qaGateDPlan)")
            if opened is not True:
                raise AssertionError(f"continue-in-stores refused Gate D plan: {opened}")
            WebDriverWait(driver, 10).until(lambda d: d.execute_script("return !!document.querySelector('.td-continue-stores')"))
            time.sleep(.15)
            data = continue_metrics(driver)
            ids = {item.get("id") for item in data.get("supported", [])}
            if ids != expected_ids:
                failures.append(f"{viewport}: enabled redirect retailers drifted {data.get('supported')}")
            row_ids = {item.get("id") for item in data.get("rows", [])}
            if row_ids != expected_ids:
                failures.append(f"{viewport}: handoff rows must contain exactly declared redirect retailers {data.get('rows')}")
            if "samokat" not in data.get("warning", "").lower() or "не подтверждённого handoff" not in data.get("warning", ""):
                failures.append(f"{viewport}: unsupported retailer must fail closed with explicit warning {data.get('warning')}")
            truth = data.get("truth", "")
            if "Без автопереноса корзины" not in truth or "подтверждаются" not in truth:
                failures.append(f"{viewport}: global redirect truth boundary missing {truth}")
            if data.get("docWidth", 0) > data.get("vw", 0) + 2:
                failures.append(f"{viewport}: continue handoff overflows viewport {data}")
            card = data.get("card") or {}
            if card and (card.get("left", 0) < -2 or card.get("right", 0) > data.get("vw", 0) + 2):
                failures.append(f"{viewport}: continue card leaves viewport {data}")
            driver.save_screenshot(str(OUT / f"{viewport}-gate-d-continue.png"))
            driver.execute_script("TDContinueInStoresV1.close()")

            unsupported = driver.execute_script("return TDRealStoreIntegrationV1.open('samokat',window.__qaGateDPlan)")
            if unsupported is not False:
                failures.append(f"{viewport}: COMPARE_ONLY/undeclared Samokat must not open redirect handoff")

            for rid, (name, host) in RETAILERS.items():
                data = retailer_metrics(driver, rid)
                label = f"{viewport}/{name}"
                if data.get("opened") is not True:
                    failures.append(f"{label}: redirect handoff failed to open")
                    continue
                if name not in data.get("title", ""):
                    failures.append(f"{label}: retailer identity missing from dialog title {data}")
                intro = data.get("intro", "").lower()
                note = data.get("note", "").lower()
                if "вручную" not in intro:
                    failures.append(f"{label}: manual-add boundary missing {data.get('intro')}")
                if "подтверждаются самим магазином" not in note or "не подтверждён" not in note or "перенесены" not in note:
                    failures.append(f"{label}: retailer authority / no-transfer boundary missing {data.get('note')}")
                for prefix in ("item", "main"):
                    actual_host = data.get(f"{prefix}Host", "")
                    if actual_host != host and not actual_host.endswith(f".{host}"):
                        failures.append(f"{label}: {prefix} target escaped official host: {data.get(f'{prefix}Href')}")
                    if data.get(f"{prefix}Target") != "_blank":
                        failures.append(f"{label}: {prefix} target must keep Votonobay open")
                    rel = set(data.get(f"{prefix}Rel", "").split())
                    if not {"noopener", "noreferrer"}.issubset(rel):
                        failures.append(f"{label}: {prefix} external link missing noopener/noreferrer {rel}")
                    rect = data.get(f"{prefix}Rect") or {}
                    if mobile and rect and rect.get("h", 0) < 43.5:
                        failures.append(f"{label}: {prefix} mobile target too short {rect}")
                if data.get("docWidth", 0) > data.get("vw", 0) + 2:
                    failures.append(f"{label}: retailer handoff overflows viewport {data}")
                card = data.get("card") or {}
                if card and (card.get("left", 0) < -2 or card.get("right", 0) > data.get("vw", 0) + 2):
                    failures.append(f"{label}: retailer card leaves viewport {data}")
                driver.save_screenshot(str(OUT / f"{viewport}-gate-d-{rid}.png"))
                driver.execute_script("TDRealStoreIntegrationV1.close()")
        except Exception as exc:
            failures.append(f"{viewport}: {exc}")
            try:
                driver.save_screenshot(str(OUT / f"{viewport}-gate-d-failure.png"))
            except Exception:
                pass
        finally:
            driver.quit()

    if failures:
        print("Retailer handoff Gate D QA failed:")
        for failure in failures:
            print("-", failure)
        return 1
    print("Retailer handoff Gate D QA passed for all five declared REDIRECT retailers on desktop and Android.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
