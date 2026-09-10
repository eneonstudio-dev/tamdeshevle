import asyncio, json, sys
from pyaterochka_api import PyaterochkaAPI

def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)

def find_store_payload(payload, sap):
    for obj in walk(payload):
        code = obj.get("sapCode", obj.get("sap_code", obj.get("storeSapCode")))
        if code is not None and str(code) == sap:
            return obj
    raise RuntimeError(f"Store {sap} was not returned by store-scoped geolocation")

async def main_async(config):
    sap = str(config["store_context"]["sap_code"])
    async with PyaterochkaAPI(headless=False, timeout_ms=35000) as api:
        geo = (await api.Geolocation.geocode(country="Россия", city="Москва", street="Кировоградская улица", house="17")).json()
        pos = geo["response"]["GeoObjectCollection"]["featureMember"][0]["GeoObject"]["Point"]["pos"]
        lon, lat = [float(x) for x in pos.split()]
        stores = (await api.Geolocation.find_store(longitude=lon, latitude=lat)).json()
        store = find_store_payload(stores, sap)
        searches = []
        for query in config.get("queries", []):
            try:
                payload = (await api.Catalog.search(sap_code_store_id=sap, query=query, limit=config.get("limit_per_query", 30))).json()
                searches.append({"query": query, "payload": payload})
            except Exception as exc:
                searches.append({"query": query, "error": str(exc)})
        return {"store": store, "searches": searches}

def main():
    config = json.load(sys.stdin)
    json.dump(asyncio.run(main_async(config)), sys.stdout, ensure_ascii=False)
if __name__ == "__main__": main()
