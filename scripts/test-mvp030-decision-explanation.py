#!/usr/bin/env python3
"""MVP-030 browser regression: Bay must explain the selected plan from actual cost/evidence trade-offs."""
from __future__ import annotations

import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.environ.get('TD_UX_BASE_URL','http://127.0.0.1:4173/')


def driver_for():
    options=Options()
    for arg in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--window-size=412,915'):
        options.add_argument(arg)
    options.add_argument('--user-agent=Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36')
    driver=webdriver.Chrome(options=options)
    driver.set_window_size(412,915)
    return driver


def main():
    d=driver_for()
    try:
        d.get(BASE_URL)
        WebDriverWait(d,20).until(lambda x:x.execute_script("return document.readyState")=='complete')
        WebDriverWait(d,20).until(lambda x:x.execute_script("return !!window.TDShoppingState && !!window.TDRoxyPurchaseSkeletonV1"))
        result=d.execute_async_script("""
          const done=arguments[arguments.length-1];
          (window.TDComparisonResultV2?Promise.resolve():import('./comparison-result-v2.js?v=qa-mvp030'))
            .then(()=>done(true)).catch(error=>done(String(error)));
        """)
        if result is not True:
            raise AssertionError(f'comparison runtime failed: {result}')

        d.execute_script("""
          const live=[
            {id:'milk',name:'Молоко',pack:'1 л',emoji:'🥛',quantity:1,storeId:'pyat',price:40,unitPrice:40,quality:'LIVE'},
            {id:'bread',name:'Хлеб',pack:'1 шт',emoji:'🍞',quantity:1,storeId:'magnit',price:40,unitPrice:40,quality:'LIVE'}
          ];
          const estimated=[
            {id:'milk',name:'Молоко',pack:'1 л',emoji:'🥛',quantity:1,storeId:'perek',price:100,unitPrice:100,quality:'ESTIMATED'},
            {id:'bread',name:'Хлеб',pack:'1 шт',emoji:'🍞',quantity:1,storeId:'perek',price:100,unitPrice:100,quality:'ESTIMATED'}
          ];
          const best={id:'multi-live',type:'multi',stores:['pyat','magnit'],products:live,goods:80,convenienceCost:120,total:200,quality:'LIVE'};
          const alt={id:'one-estimated',type:'one',stores:['perek'],products:estimated,goods:200,convenienceCost:0,total:200,quality:'ESTIMATED'};
          const qaState={
            products:live.map(x=>({...x})),
            requiredProducts:['milk','bread'],
            onlyProducts:['milk','bread'],
            selectionMode:'only',
            mode:'multi',
            stores:[],
            lastPlans:[best,alt],
            currentTotal:200
          };
          window.__qaMvp030State=qaState;
          window.__qaMvp030OriginalGet=TDShoppingState.get;
          TDShoppingState.get=()=>window.__qaMvp030State;
          TDComparisonResultV2.open();
        """)
        WebDriverWait(d,10).until(lambda x:x.execute_script("return !!document.querySelector('.td-compare-v2 .td-compare-verdict[data-mvp030-truth=\"1\"]')"))
        WebDriverWait(d,10).until(lambda x:x.execute_script("return !!document.querySelector('.td-compare-why .roxy-mvp030-facts[data-mvp030-truth=\"1\"]')"))
        data=d.execute_script(r"""
          const verdict=document.querySelector('.td-compare-verdict')?.textContent?.trim()||'';
          const why=document.querySelector('.td-compare-why')?.textContent?.replace(/\s+/g,' ').trim()||'';
          return {verdict,why};
        """)

        verdict=data['verdict'].lower()
        why=data['why'].lower()
        assert 'одинаков' in verdict, data
        assert ('подтверж' in verdict or 'свеж' in verdict), data
        assert ('120' in why and ('разби' in why or 'магазин' in why)), data
        assert ('подтверж' in why or 'свеж' in why), data
        assert 'разница это оправдывает' not in verdict, data
        assert 'текущим приоритетам и удобству' not in verdict, data
        print('MVP-030 decision explanation passed: equal-cost tie is explained by actual fees and evidence, not invented priorities.')
        return 0
    finally:
        d.quit()


if __name__=='__main__':
    raise SystemExit(main())
