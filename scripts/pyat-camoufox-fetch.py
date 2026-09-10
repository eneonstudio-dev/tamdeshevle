import json, sys, urllib.parse
from camoufox.sync_api import Camoufox

API = "https://5d.5ka.ru/api"
SITE = "https://5ka.ru/"
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "X-APP-VERSION": "8.45.0",
    "X-PLATFORM": "web",
    "X-CAN-RECEIVE-PUSH": "true",
    "format": "json",
}

def browser_json(page, path, params=None):
    url = API + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    result = page.evaluate("""async (p) => {
      const r = await fetch(p.url, {method:'GET', headers:p.headers, credentials:'include'});
      return {status:r.status, text:await r.text()};
    }""", {"url": url, "headers": HEADERS})
    if result["status"] != 200:
        raise RuntimeError(f"HTTP {result['status']}: {path}: {result['text'][:160]}")
    return json.loads(result["text"])

def main():
    config = json.load(sys.stdin)
    sap = str(config["store_context"]["sap_code"])
    out = {"store": None, "searches": []}
    with Camoufox(headless=True, locale="ru-RU", block_images=False) as browser:
        page = browser.new_page()
        page.goto(SITE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(3500)
        out["store"] = browser_json(page, f"/cita/v1/stores/{urllib.parse.quote(sap)}")
        for query in config.get("queries", []):
            try:
                payload = browser_json(page, f"/catalog/v3/stores/{urllib.parse.quote(sap)}/search", {
                    "q": query, "mode": "store", "offset": 0,
                    "limit": config.get("limit_per_query", 30), "include_restrict": "true"
                })
                out["searches"].append({"query": query, "payload": payload})
            except Exception as exc:
                out["searches"].append({"query": query, "error": str(exc)})
    json.dump(out, sys.stdout, ensure_ascii=False)

if __name__ == "__main__":
    main()
