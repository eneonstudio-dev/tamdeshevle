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
    if(u){
      status.textContent=(u.email||'Аккаунт')+' · синхронизация включена';
      button.textContent='Выйти из аккаунта';
      button.dataset.mode='signout';
    }else{
      status.textContent=TDAuth.configured()?'Гостевой режим · войди, чтобы синхронизировать данные':'Гостевой режим · backend ждёт подключения Supabase';
      button.textContent='Войти / создать аккаунт';
      button.dataset.mode='signin';
    }
  }
  document.addEventListener('click',async e=>{
    const b=e.target.closest&&e.target.closest('.td-account [data-auth]');
    if(!b||!window.TDAuth)return;
    if(b.dataset.mode==='signout'){
      e.preventDefault();e.stopImmediatePropagation();
      try{await TDAuth.signOut();apply();}catch(err){console.warn('Sign out failed',err);}
    }
  },true);
  const obs=new MutationObserver(()=>queueMicrotask(apply));
  function start(){obs.observe(document.body,{childList:true,subtree:true});apply();}
  window.addEventListener('td:auth-state',apply);
  window.addEventListener('td:cloud-synced',apply);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.TDAccountAuthUI={apply};
})();
