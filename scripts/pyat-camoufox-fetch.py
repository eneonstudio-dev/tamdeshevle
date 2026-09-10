import asyncio
import json
import sys
from urllib.parse import quote

from human_requests.abstraction import HttpMethod
from pyaterochka_api import PyaterochkaAPI


async def collect(config):
    sap_code = str(config["store_context"]["sap_code"])
    limit = int(config.get("limit_per_query", 30))
    async with PyaterochkaAPI(headless=False, timeout_ms=45000) as api:
        # Every request uses the warmed browser session and the headers caught
        # from 5ka itself. Plain HTTP requests receive a 403 and cannot prove
        # a store-scoped price.
        store_response = await api._request(
            HttpMethod.GET,
            f"{api.CATALOG_URL}/cita/v1/stores/{quote(sap_code, safe='')}",
        )
        store = store_response.json()
        searches = []
        for query in config.get("queries", []):
            try:
                response = await api.Catalog.search(
                    sap_code_store_id=sap_code,
                    query=query,
                    include_restrict=True,
                    limit=limit,
                )
                searches.append({"query": query, "payload": response.json()})
            except Exception as error:
                searches.append({"query": query, "error": str(error)})
        return {"store": store, "searches": searches}


def main():
    config = json.load(sys.stdin)
    json.dump(asyncio.run(collect(config)), sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
