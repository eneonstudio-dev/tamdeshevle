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
      ? (u.email||'Аккаунт')+' · вход выполнен'
      : (TDAuth.configured()?'Гостевой режим · войди, чтобы синхронизировать данные':'Вход временно недоступен');
    const cloud=TDAuth.cloudStatus?.()||{status:'idle',message:'Облачная копия ещё не проверена'};
    const cloudLabel=root.querySelector('.td-cloud-status');
    if(cloudLabel)cloudLabel.textContent=u?cloud.message:'Войди, чтобы сохранить или восстановить корзину.';
    for(const selector of ['[data-cloud-save]','[data-cloud-restore]']){
      const action=root.querySelector(selector);if(action)action.disabled=!u||cloud.status==='busy';
    }
    button.disabled=cloud.status==='busy';
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

  document.addEventListener('click',async e=>{
    const b=e.target.closest?.('[data-cloud-save],[data-cloud-restore]');
    if(!b||b.disabled||!window.TDAuth)return;
    try{
      if(b.hasAttribute('data-cloud-save'))await TDAuth.syncLocalToCloud();
      else {
        if(!window.confirm('Заменить текущую корзину, профиль, адрес и историю облачной копией?'))return;
        const changed=await TDAuth.hydrateLocalFromCloud();if(changed)window.TDAccountHub?.open(0);
      }
    }catch(err){console.warn('Cloud operation failed',err);}
    apply();
  });
  window.addEventListener('td:cloud-state',apply);
  window.addEventListener('td:auth-state',apply);
  window.addEventListener('td:account-opened',apply);
  window.addEventListener('td:cloud-synced',apply);
  window.addEventListener('td:cloud-hydrated',apply);

  function start(){apply();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.TDAccountAuthUI={apply};
})();
