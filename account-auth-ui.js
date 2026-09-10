(function(){
  "use strict";
  function apply(){
    if(!window.TDAuth)return;
    const root=document.querySelector('.td-account');
    if(!root)return;
    const status=root.querySelector('.td-account-status');
    const button=root.querySelector('[data-auth]');
    if(!status||!button)return;
    const u=TDAuth.user();
    const nextStatus=u
      ? (u.email||'Аккаунт')+' · синхронизация включена'
      : (TDAuth.configured()?'Гостевой режим · войди, чтобы синхронизировать данные':'Гостевой режим · backend ждёт подключения Supabase');
    const nextButton=u?'Выйти из аккаунта':'Войти / создать аккаунт';
    const nextMode=u?'signout':'signin';
    if(status.textContent!==nextStatus)status.textContent=nextStatus;
    if(button.textContent!==nextButton)button.textContent=nextButton;
    if(button.dataset.mode!==nextMode)button.dataset.mode=nextMode;
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('.td-account [data-auth]');
    if(!b||!window.TDAuth)return;
    if(b.dataset.mode==='signout'){
      e.preventDefault();e.stopImmediatePropagation();
      try{await TDAuth.signOut();apply();}catch(err){console.warn('Sign out failed',err);}
    }
  },true);
  const obs=new MutationObserver(mutations=>{
    const accountAdded=mutations.some(m=>[...m.addedNodes].some(node=>
      node.nodeType===1&&(node.matches?.('.td-account')||node.querySelector?.('.td-account'))
    ));
    if(accountAdded)queueMicrotask(apply);
  });
  function start(){obs.observe(document.body,{childList:true,subtree:true});apply();}
  window.addEventListener('td:auth-state',apply);
  window.addEventListener('td:cloud-synced',apply);
  window.addEventListener('td:cloud-hydrated',apply);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.TDAccountAuthUI={apply};
})();
