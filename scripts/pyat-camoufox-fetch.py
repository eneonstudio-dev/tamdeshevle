import asyncio,json,sys,urllib.parse,uuid
from http.cookies import SimpleCookie
import aiohttp
from yarl import URL
from camoufox.sync_api import Camoufox
API="https://5d.5ka.ru/api";SITE="https://5ka.ru/"
def warm():
    with Camoufox(headless=False,locale="ru-RU",block_images=False) as browser:
        page=browser.new_page();page.goto(SITE,wait_until="domcontentloaded",timeout=45000)
        for _ in range(5):
            page.wait_for_timeout(1500);label=page.locator('input[type="checkbox"] + label')
            try:
                if label.count() and label.first.is_visible():label.first.click(timeout=5000);page.wait_for_timeout(4000);continue
            except Exception:pass
            if "xpvnsulc" not in page.url:break
        page.wait_for_timeout(2500)
        try:ua=page.evaluate("navigator.userAgent")
        except Exception:ua="Mozilla/5.0"
        return page.context.cookies(),ua
async def collect(config,cookies,ua):
    jar=aiohttp.CookieJar(unsafe=True)
    for item in cookies:
        c=SimpleCookie();c[item["name"]]=item["value"]
        if item.get("domain"):c[item["name"]]["domain"]=item["domain"]
        c[item["name"]]["path"]=item.get("path") or "/";domain=(item.get("domain") or "5ka.ru").lstrip(".");jar.update_cookies(c,response_url=URL(f"https://{domain}/"))
    headers={"User-Agent":ua,"Accept":"application/json, text/plain, */*","Accept-Language":"ru-RU,ru;q=0.9","X-APP-VERSION":"8.45.0","X-PLATFORM":"web","X-CAN-RECEIVE-PUSH":"true","X-DEVICE-ID":str(uuid.uuid4()),"format":"json","Origin":"https://5ka.ru","Referer":"https://5ka.ru/"}
    async with aiohttp.ClientSession(cookie_jar=jar,headers=headers,timeout=aiohttp.ClientTimeout(total=30)) as s:
        async def get(path,params=None):
            async with s.get(URL(API+path).with_query(params or {}),allow_redirects=False) as r:
                text=await r.text()
                if r.status!=200:raise RuntimeError(f"HTTP {r.status}: {path}: {text[:200]}")
                return json.loads(text)
        sap=str(config["store_context"]["sap_code"]);store=await get(f"/cita/v1/stores/{urllib.parse.quote(sap)}");searches=[]
        for q in config.get("queries",[]):
            try:searches.append({"query":q,"payload":await get(f"/catalog/v3/stores/{urllib.parse.quote(sap)}/search",{"q":q,"mode":"store","offset":0,"limit":config.get("limit_per_query",30),"include_restrict":"true"})})
            except Exception as e:searches.append({"query":q,"error":str(e)})
        return{"store":store,"searches":searches}
def main():
    config=json.load(sys.stdin);cookies,ua=warm();json.dump(asyncio.run(collect(config,cookies,ua)),sys.stdout,ensure_ascii=False)
if __name__=="__main__":main()
