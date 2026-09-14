const TD_USER_DATA_COPY=Object.freeze({
  account:{
    title:"Перед входом",
    body:"Если продолжить, введённый email будет передан подключённому облачному сервису входа, чтобы прислать ссылку для авторизации.",
    note:"Отмена остановит это действие до передачи email.",
    confirm:"Продолжить"
  },
  cloud_save:{
    title:"Сохранить данные в облако?",
    body:"Votonobay отправит в облачную копию данные этого аккаунта: профиль, текущую корзину и подтверждённую историю, доступную для синхронизации.",
    note:"Сохранение запускается только этой кнопкой. Автоматически ничего не отправляем.",
    confirm:"Сохранить"
  },
  cloud_restore:{
    title:"Загрузить данные из облака?",
    body:"Votonobay запросит сохранённые данные этого аккаунта из облачной копии.",
    note:"После этого приложение отдельно попросит подтвердить замену данных на устройстве.",
    confirm:"Загрузить"
  },
  receipt:{
    title:"Отправить чек на проверку?",
    body:"Фото чека и заполненные данные о покупке будут отправлены в облачную очередь проверки.",
    note:"До проверки чек не влияет на рейтинг. Отмена оставит черновик на устройстве и не начнёт отправку.",
    confirm:"Отправить"
  }
});

const TD_USER_DATA_FOCUSABLE='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let tdUserDataActive=null;

function tdUserDataEnsureStyle(){
  if(document.getElementById("td-user-data-participation-style"))return;
  const style=document.createElement("style");
  style.id="td-user-data-participation-style";
  style.textContent=`
    .td-user-data-participation{position:fixed;inset:0;z-index:920;background:rgba(10,14,12,.64);display:grid;place-items:end center;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));overscroll-behavior:contain}
    .td-user-data-card{width:min(420px,100%);max-height:calc(100dvh - 24px);overflow:auto;background:#f4f1ea;color:#161410;border-radius:26px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);outline:none;-webkit-overflow-scrolling:touch}
    .td-user-data-kicker{font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#0f7b4a}
    .td-user-data-card h2{font:900 24px/1.08 Manrope,system-ui,sans-serif;letter-spacing:-.04em;margin:7px 0 9px}
    .td-user-data-body,.td-user-data-note{font:700 12px/1.55 Manrope,system-ui,sans-serif;color:#615a50}
    .td-user-data-note{margin-top:10px;padding:11px 12px;border-radius:14px;background:#fff;color:#464038}
    .td-user-data-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}
    .td-user-data-actions button{min-height:48px;border:0;border-radius:15px;padding:11px 14px;font:900 13px Manrope,system-ui,sans-serif;cursor:pointer}
    .td-user-data-cancel{background:#fff;color:#161410}
    .td-user-data-confirm{background:#0f7b4a;color:#fff}
    @media(min-width:700px){.td-user-data-participation{place-items:center}.td-user-data-card{border-radius:24px}}
    @media(max-width:360px){.td-user-data-actions{grid-template-columns:1fr}}
    @media(prefers-reduced-motion:no-preference){.td-user-data-card{animation:td-user-data-in .16s ease-out}}
    @keyframes td-user-data-in{from{opacity:.7;transform:translateY(12px)}to{opacity:1;transform:none}}
  `;
  document.head.appendChild(style);
}

function tdUserDataVisibleFocus(root){
  return [...root.querySelectorAll(TD_USER_DATA_FOCUSABLE)].filter(node=>!node.hidden&&node.getAttribute("aria-hidden")!=="true"&&node.offsetParent!==null);
}

function tdUserDataRestoreAria(items){
  for(const item of items||[]){
    if(!item.el||!item.el.isConnected)continue;
    if(item.value==null)item.el.removeAttribute("aria-hidden");
    else item.el.setAttribute("aria-hidden",item.value);
  }
}

function tdUserDataClose(result){
  const active=tdUserDataActive;
  if(!active)return false;
  tdUserDataActive=null;
  active.root.remove();
  document.body.style.overflow=active.previousOverflow;
  tdUserDataRestoreAria(active.obscured);
  if(active.opener&&active.opener.isConnected&&typeof active.opener.focus==="function"){
    requestAnimationFrame(()=>{try{active.opener.focus({preventScroll:true})}catch{try{active.opener.focus()}catch{}}});
  }
  active.resolve(Boolean(result));
  return true;
}

function tdUserDataHandleKeydown(event){
  const active=tdUserDataActive;
  if(!active)return false;
  if(event.key==="Escape"){
    event.preventDefault();
    tdUserDataClose(false);
    return true;
  }
  if(event.key!=="Tab")return false;
  const items=tdUserDataVisibleFocus(active.root);
  if(!items.length){event.preventDefault();active.card.focus();return true;}
  const first=items[0],last=items[items.length-1],current=document.activeElement;
  if(event.shiftKey&&(current===first||!active.root.contains(current))){event.preventDefault();last.focus();return true;}
  if(!event.shiftKey&&(current===last||!active.root.contains(current))){event.preventDefault();first.focus();return true;}
  return true;
}

function tdUserDataConfirm(kind,options={}){
  const copy=TD_USER_DATA_COPY[kind];
  if(!copy||tdUserDataActive)return Promise.resolve(false);
  tdUserDataEnsureStyle();
  const opener=options.opener&&options.opener.isConnected?options.opener:document.activeElement;
  const previousOverflow=document.body.style.overflow;
  const obscured=[...document.querySelectorAll(".td-auth-modal,.td-account,.receipt-entry-backdrop")].map(el=>({el,value:el.getAttribute("aria-hidden")}));
  for(const item of obscured)item.el.setAttribute("aria-hidden","true");
  const root=document.createElement("div");
  root.className="td-user-data-participation";
  root.dataset.participationKind=kind;
  root.innerHTML=`<section class="td-user-data-card" role="dialog" aria-modal="true" aria-labelledby="td-user-data-title" aria-describedby="td-user-data-description" tabindex="-1"><div class="td-user-data-kicker">Перед передачей данных</div><h2 id="td-user-data-title">${copy.title}</h2><p class="td-user-data-body" id="td-user-data-description">${copy.body}</p><p class="td-user-data-note">${copy.note}</p><div class="td-user-data-actions"><button class="td-user-data-cancel" type="button" data-participation-cancel>Отмена</button><button class="td-user-data-confirm" type="button" data-participation-confirm>${copy.confirm}</button></div></section>`;
  document.body.appendChild(root);
  document.body.style.overflow="hidden";
  const card=root.querySelector(".td-user-data-card");
  const promise=new Promise(resolve=>{tdUserDataActive={root,card,opener,previousOverflow,obscured,resolve};});
  root.querySelector("[data-participation-cancel]").addEventListener("click",()=>tdUserDataClose(false));
  root.querySelector("[data-participation-confirm]").addEventListener("click",()=>tdUserDataClose(true));
  root.addEventListener("click",event=>{if(event.target===root)tdUserDataClose(false);});
  requestAnimationFrame(()=>root.querySelector("[data-participation-confirm]")?.focus());
  return promise;
}

window.TDUserDataParticipation=Object.freeze({
  confirm:tdUserDataConfirm,
  cancel:()=>tdUserDataClose(false),
  handleKeydown:tdUserDataHandleKeydown,
  isOpen:()=>Boolean(tdUserDataActive),
  copy:TD_USER_DATA_COPY
});
