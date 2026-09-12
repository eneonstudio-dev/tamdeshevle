(function(){
  "use strict";

  const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  let accountRoot=null,authRoot=null,accountOpener=null,authOpener=null,lastProfileTrigger=null;
  let accountManualBack=false,authManualBack=false,suppressAccountRemoval=false,suppressAuthRemoval=false;
  let authPreviousOverflow="",authActionBusy=false,cloudUiBusy=false;

  function visibleFocusable(root){
    if(!root)return[];
    return [...root.querySelectorAll(FOCUSABLE)].filter(el=>!el.hidden&&el.getAttribute('aria-hidden')!=='true');
  }

  function trapTab(event,root){
    if(event.key!=='Tab')return false;
    const items=visibleFocusable(root);
    if(!items.length){event.preventDefault();root.focus?.();return true;}
    const first=items[0],last=items[items.length-1],active=document.activeElement;
    if(event.shiftKey&&(active===first||!root.contains(active))){event.preventDefault();last.focus();return true;}
    if(!event.shiftKey&&(active===last||!root.contains(active))){event.preventDefault();first.focus();return true;}
    return false;
  }

  function safeFocus(target){
    if(!target||!document.contains(target)||typeof target.focus!=='function')return false;
    try{target.focus({preventScroll:true});return true}catch{try{target.focus();return true}catch{return false}}
  }

  function ensureResilienceCss(){
    if(document.getElementById('td-account-auth-resilience-style'))return;
    const style=document.createElement('style');
    style.id='td-account-auth-resilience-style';
    style.textContent=`.td-account{height:var(--td-vvh,100dvh);max-height:var(--td-vvh,100dvh);overscroll-behavior:contain}.td-auth-modal{height:var(--td-vvh,100dvh);max-height:var(--td-vvh,100dvh);overflow:auto;overscroll-behavior:contain;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))}.td-auth-card{max-height:calc(var(--td-vvh,100dvh) - 24px);overflow:auto;-webkit-overflow-scrolling:touch}body[data-td-keyboard-open] .td-auth-modal{padding-top:8px;padding-bottom:8px}body[data-td-keyboard-open] .td-auth-card{max-height:calc(var(--td-vvh,100dvh) - 16px)}`;
    document.head.appendChild(style);
  }

  function feedback(root,text){
    if(!root)return;
    const button=root.querySelector('[data-auth]');
    if(!button)return;
    let node=root.querySelector('.td-account-auth-feedback');
    if(!node){node=document.createElement('div');node.className='td-account-auth-feedback';node.setAttribute('role','alert');node.style.cssText='margin-top:8px;font-size:10px;font-weight:800;line-height:1.4;color:#9b2c2c';button.insertAdjacentElement('afterend',node);}
    node.textContent=text||'';
    node.hidden=!text;
  }

  function apply(){
    if(!window.TDAuth)return;
    const root=document.querySelector('.td-account');
    if(!root)return;
    const status=root.querySelector('.td-account-status');
    const button=root.querySelector('[data-auth]');
    if(!status||!button)return;
    const u=TDAuth.user();
    const nextStatus=u
      ? (u.email||'Аккаунт')+' · вход выполнен'
      : (TDAuth.configured()?'Гостевой режим · войди, чтобы синхронизировать данные':'Вход временно недоступен');
    const cloud=TDAuth.cloudStatus?.()||{status:'idle',message:'Облачная копия ещё не проверена'};
    const cloudLabel=root.querySelector('.td-cloud-status');
    if(cloudLabel){
      cloudLabel.textContent=u?cloud.message:'Войди, чтобы сохранить или восстановить корзину.';
      cloudLabel.setAttribute('role',cloud.status==='error'?'alert':'status');
      cloudLabel.setAttribute('aria-live',cloud.status==='error'?'assertive':'polite');
    }
    const cloudBusy=cloud.status==='busy'||cloudUiBusy;
    root.setAttribute('aria-busy',cloudBusy?'true':'false');
    root.querySelector('.td-cloud-actions')?.setAttribute('aria-busy',cloudBusy?'true':'false');
    for(const selector of ['[data-cloud-save]','[data-cloud-restore]']){
      const action=root.querySelector(selector);
      if(action){action.disabled=!u||cloudBusy;action.setAttribute('aria-disabled',action.disabled?'true':'false');}
    }
    button.disabled=cloud.status==='busy'||authActionBusy;
    button.setAttribute('aria-busy',authActionBusy?'true':'false');
    const nextButton=u?'Выйти из аккаунта':'Войти / создать аккаунт';
    const nextMode=u?'signout':'signin';
    if(status.textContent!==nextStatus)status.textContent=nextStatus;
    if(button.textContent!==nextButton)button.textContent=nextButton;
    if(button.dataset.mode!==nextMode)button.dataset.mode=nextMode;
  }

  function enhanceAccount(root){
    if(!root||root.dataset.tdAccountEnhanced==='1')return;
    root.dataset.tdAccountEnhanced='1';
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.tabIndex=-1;
    const title=root.querySelector('.td-account-title');
    if(title){title.id=title.id||'td-account-title';root.setAttribute('aria-labelledby',title.id);root.removeAttribute('aria-label');}
    if(!accountOpener)accountOpener=lastProfileTrigger&&document.contains(lastProfileTrigger)?lastProfileTrigger:document.activeElement;
    if(!history.state?.tdAccount){try{history.pushState({...history.state,tdAccount:true},'');}catch{}}
    apply();
  }

  function enhanceAuth(root){
    if(!root||root.dataset.tdAuthEnhanced==='1')return;
    root.dataset.tdAuthEnhanced='1';
    authPreviousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    authOpener=document.activeElement&&document.contains(document.activeElement)?document.activeElement:accountRoot?.querySelector('[data-auth]');
    root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.tabIndex=-1;
    const card=root.querySelector('.td-auth-card');if(card)card.tabIndex=-1;
    const title=root.querySelector('h2');
    if(title){title.id=title.id||'td-auth-title';root.setAttribute('aria-labelledby',title.id);}
    const msg=root.querySelector('.td-auth-msg');if(msg){msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');}
    if(!history.state?.tdAuth){try{history.pushState({...history.state,tdAccount:Boolean(accountRoot),tdAuth:true},'');}catch{}}
    requestAnimationFrame(()=>safeFocus(root.querySelector('input[type="email"]')||root.querySelector('.td-auth-x')||card||root));
  }

  function accountRemoved(){
    const opener=accountOpener;accountRoot=null;accountOpener=null;
    if(suppressAccountRemoval)suppressAccountRemoval=false;
    else if(history.state?.tdAccount){accountManualBack=true;try{history.back()}catch{accountManualBack=false}}
    requestAnimationFrame(()=>safeFocus(opener||lastProfileTrigger));
  }

  function authRemoved(){
    const opener=authOpener;authRoot=null;authOpener=null;
    document.body.style.overflow=authPreviousOverflow;authPreviousOverflow='';
    if(suppressAuthRemoval)suppressAuthRemoval=false;
    else if(history.state?.tdAuth){authManualBack=true;try{history.back()}catch{authManualBack=false}}
    requestAnimationFrame(()=>safeFocus(opener||accountRoot?.querySelector('[data-auth]')));
  }

  function syncLayers(){
    const nextAccount=document.querySelector('.td-account');
    const nextAuth=document.querySelector('.td-auth-modal');
    if(nextAccount!==accountRoot){
      if(accountRoot&&!nextAccount)accountRemoved();
      accountRoot=nextAccount||accountRoot;
      if(nextAccount){accountRoot=nextAccount;enhanceAccount(nextAccount);}
    }
    if(nextAuth!==authRoot){
      if(authRoot&&!nextAuth)authRemoved();
      authRoot=nextAuth||authRoot;
      if(nextAuth){authRoot=nextAuth;enhanceAuth(nextAuth);}
    }
  }

  document.addEventListener('pointerdown',e=>{
    const trigger=e.target.closest?.('.td-profile-btn');
    if(trigger)lastProfileTrigger=trigger;
  },true);

  document.addEventListener('keydown',event=>{
    if(authRoot&&document.contains(authRoot)){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();authRoot.querySelector('.td-auth-x')?.click();return;}
      trapTab(event,authRoot);return;
    }
    if(accountRoot&&document.contains(accountRoot)){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();window.TDAccountHub?.close?.(accountRoot);return;}
      trapTab(event,accountRoot);
    }
  },true);

  window.addEventListener('popstate',event=>{
    if(authManualBack){authManualBack=false;return;}
    if(accountManualBack){accountManualBack=false;return;}
    if(authRoot&&!event.state?.tdAuth){suppressAuthRemoval=true;authRoot.querySelector('.td-auth-x')?.click();}
    if(accountRoot&&!event.state?.tdAccount){suppressAccountRemoval=true;window.TDAccountHub?.close?.(accountRoot);}
  });

  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('.td-account [data-auth]');
    if(!b||!window.TDAuth)return;
    if(b.dataset.mode==='signout'){
      e.preventDefault();e.stopImmediatePropagation();
      if(authActionBusy)return;
      authActionBusy=true;feedback(accountRoot,'');apply();
      try{await TDAuth.signOut();}
      catch(err){console.warn('Sign out failed',err);feedback(accountRoot,'Не удалось выйти из аккаунта. Проверь соединение и попробуй ещё раз.');}
      finally{authActionBusy=false;apply();}
    }
  },true);

  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('[data-cloud-save],[data-cloud-restore]');
    if(!b||b.disabled||!window.TDAuth||cloudUiBusy)return;
    cloudUiBusy=true;apply();
    try{
      if(b.hasAttribute('data-cloud-save'))await TDAuth.syncLocalToCloud();
      else {
        if(!window.confirm('Заменить текущую корзину, профиль, адрес и историю облачной копией?'))return;
        const changed=await TDAuth.hydrateLocalFromCloud();if(changed)window.TDAccountHub?.open(0);
      }
    }catch(err){console.warn('Cloud operation failed',err);}
    finally{cloudUiBusy=false;apply();}
  });

  const observer=new MutationObserver(syncLayers);
  function start(){
    ensureResilienceCss();
    if(!document.querySelector('.td-account')&&!document.querySelector('.td-auth-modal')&&(history.state?.tdAccount||history.state?.tdAuth)){
      try{const next={...history.state};delete next.tdAccount;delete next.tdAuth;history.replaceState(next,'');}catch{}
    }
    observer.observe(document.body,{childList:true,subtree:true});
    syncLayers();apply();
  }
  window.addEventListener('td:cloud-state',apply);
  window.addEventListener('td:auth-state',()=>{feedback(accountRoot,'');apply();});
  window.addEventListener('td:account-opened',()=>{syncLayers();apply();});
  window.addEventListener('td:cloud-synced',apply);
  window.addEventListener('td:cloud-hydrated',()=>{syncLayers();apply();});
  window.addEventListener('pagehide',()=>observer.disconnect());
  window.addEventListener('pageshow',()=>{observer.disconnect();observer.observe(document.body,{childList:true,subtree:true});syncLayers();});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.TDAccountAuthUI={apply,syncLayers};
})();
