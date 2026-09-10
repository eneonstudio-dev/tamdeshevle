import asyncio, json, sys, urllib.parse, uuid
from http.cookies import SimpleCookie
import aiohttp
from yarl import URL
from camoufox.sync_api import Camoufox

API = "https://5d.5ka.ru/api"
SITE = "https://5ka.ru/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "X-APP-VERSION": "8.45.0",
    "X-PLATFORM": "web",
    "X-CAN-RECEIVE-PUSH": "true",
    "X-DEVICE-ID": str(uuid.uuid4()),
    "format": "json",
    "Origin": "https://5ka.ru",
    "Referer": "https://5ka.ru/",
}

def warm_cookies():
    with Camoufox(headless=True, locale="ru-RU", block_images=False) as browser:
        page = browser.new_page()
        try:
            page.goto(SITE, wait_until="domcontentloaded", timeout=45000)
        except Exception:
            pass
        try:
            page.wait_for_selector("#app", timeout=20000)
        except Exception:
            page.wait_for_timeout(2500)
        return page.context.cookies()

async def collect(config, cookies):
    jar = aiohttp.CookieJar(unsafe=True)
    for item in cookies:
        cookie = SimpleCookie()
        cookie[str(item["name"])] = str(item["value"])
        if item.get("domain"):
            cookie[str(item["name"])]["domain"] = str(item["domain"])
        cookie[str(item["name"])]["path"] = str(item.get("path") or "/")
        domain = str(item.get("domain") or "5ka.ru").lstrip(".")
        jar.update_cookies(cookie, response_url=URL(f"https://{domain}/"))
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(cookie_jar=jar, headers=HEADERS, timeout=timeout) as session:
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
                payload = await get(f"/catalog/v3/stores/{urllib.parse.quote(sap)}/search", {
                    "q": query, "mode": "store", "offset": 0,
                    "limit": config.get("limit_per_query", 30), "include_restrict": "true"
                })
                out["searches"].append({"query": query, "payload": payload})
            except Exception as exc:
                out["searches"].append({"query": query, "error": str(exc)})
        return out

def main():
    config = json.load(sys.stdin)
    cookies = warm_cookies()
    out = asyncio.run(collect(config, cookies))
    json.dump(out, sys.stdout, ensure_ascii=False)

if __name__ == "__main__":
    main()
