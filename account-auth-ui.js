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

  function patchAccountOpen(){
    if(!window.TDAccountHub||typeof window.TDAccountHub.open!=="function"||window.TDAccountHub.__authPatched)return;
    const originalOpen=window.TDAccountHub.open;
    window.TDAccountHub.open=function(){
      const result=originalOpen.apply(this,arguments);
      queueMicrotask(apply);
      return result;
    };
    window.TDAccountHub.__authPatched=true;
  }

  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('.td-account [data-auth]');
    if(!b||!window.TDAuth)return;
    if(b.dataset.mode==='signout'){
      e.preventDefault();e.stopImmediatePropagation();
      try{await TDAuth.signOut();apply();}catch(err){console.warn('Sign out failed',err);}
    }
  },true);

  window.addEventListener('td:auth-state',apply);
  window.addEventListener('td:cloud-synced',apply);
  window.addEventListener('td:cloud-hydrated',apply);

  function start(){patchAccountOpen();apply();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.TDAccountAuthUI={apply,patchAccountOpen};
})();
