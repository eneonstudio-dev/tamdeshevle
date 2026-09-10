import json, sys, time, urllib.parse
from camoufox.sync_api import Camoufox

API="https://5d.5ka.ru/api"; SITE="https://5ka.ru/"
HEADERS={"Accept":"application/json, text/plain, */*","X-APP-VERSION":"8.45.0","X-PLATFORM":"web","X-CAN-RECEIVE-PUSH":"true","format":"json"}

def solve(page):
    page.goto(SITE,wait_until="domcontentloaded",timeout=45000)
    for _ in range(5):
        page.wait_for_timeout(1500)
        label=page.locator('input[type="checkbox"] + label')
        try:
            if label.count() and label.first.is_visible():
                label.first.click(timeout=5000)
                page.wait_for_timeout(4000)
                continue
        except Exception:
            pass
        if "xpvnsulc" not in page.url:
            break
    page.wait_for_timeout(2500)

def get_json(page,path,params=None):
    url=API+path
    if params:url+="?"+urllib.parse.urlencode(params)
    last=None
    for _ in range(3):
        try:
            result=page.evaluate("""async p=>{const r=await fetch(p.url,{headers:p.headers,credentials:'include'});return {status:r.status,text:await r.text()}}""",{"url":url,"headers":HEADERS})
            if result["status"]!=200:raise RuntimeError(f"HTTP {result['status']}: {result['text'][:160]}")
            return json.loads(result["text"])
        except Exception as exc:
            last=exc;page.wait_for_timeout(2000)
    raise last

def walk(v):
    if isinstance(v,dict):
        yield v
        for x in v.values():yield from walk(x)
    elif isinstance(v,list):
        for x in v:yield from walk(x)

def main():
    config=json.load(sys.stdin);sap=str(config["store_context"]["sap_code"])
    with Camoufox(headless=False,locale="ru-RU",block_images=False) as browser:
        page=browser.new_page();solve(page)
        store=get_json(page,f"/cita/v1/stores/{urllib.parse.quote(sap)}")
        searches=[]
        for query in config.get("queries",[]):
            try:
                payload=get_json(page,f"/catalog/v3/stores/{urllib.parse.quote(sap)}/search",{"q":query,"mode":"store","offset":0,"limit":config.get("limit_per_query",30),"include_restrict":"true"})
                searches.append({"query":query,"payload":payload})
            except Exception as exc:searches.append({"query":query,"error":str(exc)})
    json.dump({"store":store,"searches":searches},sys.stdout,ensure_ascii=False)
if __name__=="__main__":main()
