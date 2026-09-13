#!/usr/bin/env python3
"""Real-browser contract for Roxy Empty / Loading / Error / Offline states."""
from __future__ import annotations

import os
import pathlib
import time
from dataclasses import dataclass

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("TD_UX_BASE_URL", "http://127.0.0.1:4173/")
OUT = pathlib.Path(os.environ.get("TD_UX_OUT_DIR", "artifacts/ux-browser"))
OUT.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Viewport:
    name: str
    width: int
    height: int
    mobile: bool


VIEWPORTS = (
    Viewport("desktop", 1440, 1000, False),
    Viewport("android", 412, 915, True),
)

EXPECTED = {
    "empty": ("bai-curious-approved-v1.webp", "Готов включиться"),
    "loading": ("bai-checking-approved-v1.webp", "Проверяю"),
    "error": ("bai-suspicious-approved-v1.webp", "Спокойно, поправим"),
    "offline": ("bai-sleeping-approved-v1.webp", "Жду сеть"),
}


def driver_for(viewport: Viewport) -> webdriver.Chrome:
    options = Options()
    for arg in (
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--window-size={viewport.width},{viewport.height}",
    ):
        options.add_argument(arg)
    if viewport.mobile:
        options.add_argument(
            "--user-agent=Mozilla/5.0 (Linux; Android 13; SM-N986N) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
        )
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(viewport.width, viewport.height)
    return driver


def visible(driver: webdriver.Chrome, selector: str) -> bool:
    return bool(
        driver.execute_script(
            """
            return [...document.querySelectorAll(arguments[0])].some(el => {
              const r=el.getBoundingClientRect(),s=getComputedStyle(el);
              return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
            });
            """,
            selector,
        )
    )


def wait_ready(driver: webdriver.Chrome) -> None:
    WebDriverWait(driver, 20).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )
    WebDriverWait(driver, 20).until(
        lambda d: d.execute_script(
            "return !!window.state && !!window.TDShoppingAssistant && "
            "!!window.TDBaiRuntimeStatesV1 && !!window.TDRoxyRuntimeStatesV1 && "
            "!!window.TDRoxyBayPanel"
        )
    )


def open_bay(driver: webdriver.Chrome, mobile: bool) -> None:
    driver.execute_script("window.TDShoppingAssistant.open()")
    WebDriverWait(driver, 10).until(
        lambda d: visible(d, "body>.td-ai[data-roxy-bay-panel='1'] .td-ai-shell")
    )
    if mobile:
        driver.execute_script(
            """
            const root=document.querySelector('body>.td-ai');
            window.TDRoxyBayPanel?.setExpanded?.(root,true);
            document.querySelector('body>.td-ai textarea')?.blur();
            document.body.removeAttribute('data-td-keyboard-open');
            """
        )
    preload = driver.execute_async_script(
        """
        const done=arguments[arguments.length-1];
        const files=[
          'assets/bai/bai-curious-approved-v1.webp',
          'assets/bai/bai-checking-approved-v1.webp',
          'assets/bai/bai-suspicious-approved-v1.webp',
          'assets/bai/bai-sleeping-approved-v1.webp'
        ];
        Promise.all(files.map(src=>new Promise((resolve,reject)=>{
          const img=new Image();img.onload=resolve;img.onerror=()=>reject(new Error(src));img.src=src;
        }))).then(()=>done(true)).catch(error=>done(String(error)));
        """
    )
    if preload is not True:
        raise AssertionError(f"approved Bay runtime assets did not preload: {preload}")


def restore_online(driver: webdriver.Chrome) -> None:
    driver.execute_script(
        """
        try{delete window.navigator.onLine}catch(e){}
        window.dispatchEvent(new Event('online'));
        window.TDBaiRuntimeStatesV1?.paint?.();
        window.TDRoxyRuntimeStatesV1?.decorate?.();
        """
    )


def reset_messages(driver: webdriver.Chrome, *, user: bool, error: bool) -> None:
    driver.execute_script(
        """
        const root=document.querySelector('body>.td-ai');
        if(!root)return;
        root.removeAttribute('data-bai-busy');
        root.querySelectorAll('.td-ai-msg.user,.td-ai-msg.assistant').forEach(node=>node.remove());
        const messages=root.querySelector('.td-ai-messages');
        if(!messages)return;
        if(arguments[0]){
          const user=document.createElement('div');
          user.className='td-ai-msg user';
          user.textContent='Собери обычную продуктовую корзину';
          messages.appendChild(user);
        }
        const assistant=document.createElement('div');
        assistant.className='td-ai-msg assistant';
        assistant.textContent=arguments[1]
          ? 'Не получилось обработать сообщение до конца'
          : 'Понял. Сейчас посмотрю.';
        messages.appendChild(assistant);
        window.TDBaiRuntimeStatesV1.paint();
        window.TDRoxyRuntimeStatesV1.decorate();
        """,
        user,
        error,
    )


def force_mode(driver: webdriver.Chrome, mode: str) -> None:
    restore_online(driver)
    if mode == "empty":
        reset_messages(driver, user=False, error=False)
    elif mode == "loading":
        reset_messages(driver, user=True, error=False)
        driver.execute_script(
            """
            const root=document.querySelector('body>.td-ai');
            root.setAttribute('data-bai-busy','1');
            window.TDBaiRuntimeStatesV1.paint();
            window.TDRoxyRuntimeStatesV1.decorate();
            """
        )
    elif mode == "error":
        reset_messages(driver, user=True, error=True)
    elif mode == "offline":
        reset_messages(driver, user=True, error=False)
        driver.execute_script(
            """
            Object.defineProperty(window.navigator,'onLine',{configurable:true,value:false});
            window.dispatchEvent(new Event('offline'));
            window.TDBaiRuntimeStatesV1.paint();
            window.TDRoxyRuntimeStatesV1.decorate();
            """
        )
    else:
        raise ValueError(mode)
    WebDriverWait(driver, 10).until(
        lambda d: d.execute_script(
            "return document.querySelector('body>.td-ai')?.dataset.baiRuntimeState"
        ) == mode
    )
    WebDriverWait(driver, 10).until(
        lambda d: visible(d, ".td-ai-state-card .roxy-runtime-state-visual")
    )
    time.sleep(0.08)


def metrics(driver: webdriver.Chrome) -> dict:
    return driver.execute_script(
        """
        const root=document.querySelector('body>.td-ai');
        const card=root?.querySelector('.td-ai-state-card');
        const visual=card?.querySelector('.roxy-runtime-state-visual');
        const img=visual?.querySelector('img');
        const label=visual?.querySelector('em');
        const avatar=root?.querySelector('.roxy-bay-head-avatar');
        const rr=root?.getBoundingClientRect(),cr=card?.getBoundingClientRect();
        const buttons=card?[...card.querySelectorAll('button')].filter(el=>{
          const r=el.getBoundingClientRect(),s=getComputedStyle(el);
          return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
        }).map(el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,text:el.textContent.trim()}}):[];
        return {
          mode:root?.dataset.baiRuntimeState||'',
          cardState:card?.dataset.state||'',
          hidden:!!card?.hidden,
          visualState:visual?.dataset.state||'',
          src:img?.getAttribute('src')||'',
          avatarSrc:avatar?.getAttribute('src')||'',
          loaded:!!img&&img.complete&&img.naturalWidth>0,
          label:label?.textContent?.trim()||'',
          vw:innerWidth,
          docWidth:document.documentElement.scrollWidth,
          root:rr?{left:rr.left,right:rr.right,top:rr.top,bottom:rr.bottom,width:rr.width,height:rr.height}:null,
          card:cr?{left:cr.left,right:cr.right,top:cr.top,bottom:cr.bottom,width:cr.width,height:cr.height}:null,
          buttons
        };
        """
    )


def assert_state(driver: webdriver.Chrome, viewport: Viewport, mode: str, failures: list[str]) -> None:
    expected_asset, expected_label = EXPECTED[mode]
    data = metrics(driver)
    label = f"{viewport.name}/runtime-{mode}"
    if data["mode"] != mode or data["cardState"] != mode or data["visualState"] != mode:
        failures.append(f"{label}: state mismatch {data}")
    if data["hidden"]:
        failures.append(f"{label}: state card is hidden")
    if expected_asset not in data["src"]:
        failures.append(f"{label}: wrong Bay asset {data['src']!r}")
    if expected_asset not in data["avatarSrc"]:
        failures.append(f"{label}: panel Bay did not follow runtime state {data['avatarSrc']!r}")
    if data["label"] != expected_label:
        failures.append(f"{label}: wrong Bay label {data['label']!r}")
    if not data["loaded"]:
        failures.append(f"{label}: approved Bay image failed to decode")
    if data["docWidth"] > data["vw"] + 2:
        failures.append(f"{label}: horizontal overflow {data}")
    for key in ("root", "card"):
        rect = data.get(key) or {}
        if rect and (rect.get("left", 0) < -2 or rect.get("right", 0) > data["vw"] + 2):
            failures.append(f"{label}: {key} leaves viewport {rect}")
    if viewport.mobile:
        for button in data["buttons"]:
            if button["h"] < 43.5 or button["w"] < 43.5:
                failures.append(f"{label}: touch target too small {button}")
    driver.save_screenshot(str(OUT / f"{viewport.name}-runtime-{mode}.png"))


def assert_reduced_motion(driver: webdriver.Chrome, viewport: Viewport, failures: list[str]) -> None:
    driver.execute_cdp_cmd(
        "Emulation.setEmulatedMedia",
        {
            "media": "screen",
            "features": [{"name": "prefers-reduced-motion", "value": "reduce"}],
        },
    )
    force_mode(driver, "loading")
    styles = driver.execute_script(
        """
        const img=document.querySelector('.roxy-runtime-state-visual img');
        const progress=document.querySelector('.roxy-runtime-state-progress span');
        return {
          reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
          imageAnimation:img?getComputedStyle(img).animationName:'',
          progressAnimation:progress?getComputedStyle(progress).animationName:''
        };
        """
    )
    label = f"{viewport.name}/runtime-reduced-motion"
    if not styles["reduced"]:
        failures.append(f"{label}: media emulation did not activate")
    if styles["imageAnimation"] != "none" or styles["progressAnimation"] != "none":
        failures.append(f"{label}: decorative motion still active {styles}")
    driver.execute_cdp_cmd("Emulation.setEmulatedMedia", {"media": "screen", "features": []})


def assert_recovery(driver: webdriver.Chrome, viewport: Viewport, failures: list[str]) -> None:
    restore_online(driver)
    reset_messages(driver, user=True, error=False)
    WebDriverWait(driver, 10).until(
        lambda d: d.execute_script(
            "return document.querySelector('body>.td-ai')?.dataset.baiRuntimeState"
        ) == "normal"
    )
    recovered = driver.execute_script(
        """
        const card=document.querySelector('body>.td-ai .td-ai-state-card');
        return {
          hidden:!!card?.hidden,
          visual:!!card?.querySelector('.roxy-runtime-state-visual'),
          progress:!!card?.querySelector('.roxy-runtime-state-progress')
        };
        """
    )
    if not recovered["hidden"] or recovered["visual"] or recovered["progress"]:
        failures.append(f"{viewport.name}/runtime-recovery: stale runtime UI remains {recovered}")


def main() -> int:
    failures: list[str] = []
    for viewport in VIEWPORTS:
        driver = driver_for(viewport)
        try:
            driver.get(BASE_URL)
            wait_ready(driver)
            open_bay(driver, viewport.mobile)
            for mode in ("empty", "loading", "error", "offline"):
                force_mode(driver, mode)
                assert_state(driver, viewport, mode, failures)
            assert_reduced_motion(driver, viewport, failures)
            assert_recovery(driver, viewport, failures)
        except Exception as exc:
            failures.append(f"{viewport.name}/runtime: {exc}")
            try:
                driver.save_screenshot(str(OUT / f"{viewport.name}-runtime-failure.png"))
            except Exception:
                pass
        finally:
            try:
                restore_online(driver)
            except Exception:
                pass
            driver.quit()

    if failures:
        print("Roxy runtime-state QA failed:")
        for failure in failures:
            print("-", failure)
        return 1
    print(
        "Roxy runtime-state QA passed on desktop and Android-sized viewports "
        "for empty/loading/error/offline, recovery and reduced motion."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
