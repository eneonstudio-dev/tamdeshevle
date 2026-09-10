import asyncio, json, sys, urllib.parse, uuid
from http.cookies import SimpleCookie
import aiohttp
from yarl import URL
from camoufox.sync_api import Camoufox

API = "https://5d.5ka.ru/api"
SITE = "https://5ka.ru/"

def warm_session():
    observed = {}
    with Camoufox(headless=True, locale="ru-RU", block_images=False) as browser:
        page = browser.new_page()
        def sniff(request):
            if "5d.5ka.ru" not in request.url:
                return
            h = request.headers or {}
            for key in ("x-app-version", "x-device-id", "x-platform", "x-can-receive-push"):
                if h.get(key): observed[key] = h[key]
        page.on("request", sniff)
        try:
            page.goto(SITE, wait_until="domcontentloaded", timeout=45000)
        except Exception:
            pass
        try:
            page.wait_for_selector("#app", timeout=20000)
        except Exception:
            page.wait_for_timeout(3000)
        try:
            ua = page.evaluate("navigator.userAgent")
        except Exception:
            ua = "Mozilla/5.0"
        return page.context.cookies(), ua, observed

async def collect(config, cookies, user_agent, observed):
    jar = aiohttp.CookieJar(unsafe=True)
    for item in cookies:
        cookie = SimpleCookie()
        cookie[str(item["name"])] = str(item["value"])
        if item.get("domain"):
            cookie[str(item["name"])]["domain"] = str(item["domain"])
        cookie[str(item["name"])]["path"] = str(item.get("path") or "/")
        domain = str(item.get("domain") or "5ka.ru").lstrip(".")
        jar.update_cookies(cookie, response_url=URL(f"https://{domain}/"))
    headers = {
        "User-Agent": user_agent,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "ru-RU,ru;q=0.9",
        "X-APP-VERSION": observed.get("x-app-version", "8.45.0"),
        "X-PLATFORM": observed.get("x-platform", "web"),
        "X-CAN-RECEIVE-PUSH": observed.get("x-can-receive-push", "true"),
        "X-DEVICE-ID": observed.get("x-device-id", str(uuid.uuid4())),
        "format": "json",
        "Origin": "https://5ka.ru",
        "Referer": "https://5ka.ru/",
    }
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(cookie_jar=jar, headers=headers, timeout=timeout) as session:
        async def get(path, params=None):
            url = URL(API + path).with_query(params or {})
            async with session.get(url, allow_redirects=False) as response:
                text = await response.text()
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}: {path}: {text[:200]}")
                return json.loads(text)
        sap = str(config["store_context"]["sap_code"])
        out = {"store": await get(f"/cita/v1/stores/{urllib.parse.quote(sap)}"), "searches": []}
        for query in config.get("queries", []):
            try:
                payload = await get(f"/catalog/v3/stores/{urllib.parse.quote(sap)}/search", {"q":query,"mode":"store","offset":0,"limit":config.get("limit_per_query",30),"include_restrict":"true"})
                out["searches"].append({"query":query,"payload":payload})
            except Exception as exc:
                out["searches"].append({"query":query,"error":str(exc)})
        return out

def main():
    config=json.load(sys.stdin)
    cookies,ua,observed=warm_session()
    out=asyncio.run(collect(config,cookies,ua,observed))
    json.dump(out,sys.stdout,ensure_ascii=False)
if __name__=="__main__": main()
