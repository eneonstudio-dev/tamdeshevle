(() => {
  if (document.getElementById('bai-assistant')) return;

  const POSES = {
    idle:'assets/bai/bai-idle.webp',
    greeting:'assets/bai/bai-happy.webp',
    happy:'assets/bai/bai-happy.webp',
    checking:'assets/bai/bai-checking.webp',
    suspicious:'assets/bai/bai-grumpy.webp',
    grumpy:'assets/bai/bai-grumpy.webp',
    thinking:'assets/bai/bai-peek.webp',
    curious:'assets/bai/bai-peek.webp',
    peek:'assets/bai/bai-peek.webp',
    sleep:'assets/bai/bai-sleep.webp',
    goodbye:'assets/bai/bai-tail-peek.webp'
  };
  [...new Set(Object.values(POSES))].forEach(src=>{const i=new Image();i.src=src;});

  const bai=document.createElement('button');
  bai.id='bai-assistant'; bai.className='bai-assistant'; bai.type='button';
  bai.setAttribute('aria-label','Бай — помощник Тамдешевле');
  bai.innerHTML=`<span class="bai-bubble" aria-hidden="true"></span><img class="bai-image" src="${POSES.idle}" alt="" draggable="false">`;
  document.body.appendChild(bai);

  let hideTimer,idleTimer,settleTimer,scrollTimer,lastHint='',stateToken=0;
  const bubble=bai.querySelector('.bai-bubble');
  const image=bai.querySelector('.bai-image');

  const setState=(state,text='',ms=3200,settle=true)=>{
    const token=++stateToken;
    clearTimeout(hideTimer); clearTimeout(settleTimer);
    bai.dataset.state=state;
    image.src=POSES[state]||POSES.idle;
    bubble.textContent=text;
    bai.classList.toggle('is-talking',Boolean(text));
    if(text) hideTimer=setTimeout(()=>{if(token===stateToken)bai.classList.remove('is-talking');},ms);
    if(settle&&!['idle','sleep'].includes(state)) settleTimer=setTimeout(()=>{
      if(token===stateToken)setState('idle','',0,false);
    },Math.max(ms+220,1800));
  };

  const place=()=>{
    const dock=document.querySelector('.dock');
    let bottom=6;
    if(dock){
      const r=dock.getBoundingClientRect();
      if(r.height>20&&r.bottom>innerHeight-8&&r.top<innerHeight) bottom=Math.min(150,Math.ceil(innerHeight-r.top+2));
    }
    bai.style.setProperty('--bai-bottom',`${bottom}px`);
  };

  const wake=()=>{
    clearTimeout(idleTimer);
    if(bai.dataset.state==='sleep')setState('idle','О, ты вернулся 🐾',1500);
    idleTimer=setTimeout(()=>setState('sleep','Я тут подремлю… 😴',2200,false),45000);
  };

  const onScroll=()=>{
    wake(); place();
    bai.classList.add('is-scrolling'); bai.classList.remove('is-talking');
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>{bai.classList.remove('is-scrolling');place();},420);
  };

  const contextHint=()=>{
    const text=document.body.innerText;
    let state='thinking',hint='Добавляй товары — покажу, где корзина дешевле 🐾';
    if(text.includes('≈ каталог')){state='suspicious';hint='≈ — цена из каталога, не подтверждённая цена конкретной точки 🐾';}
    else if(/корзин/i.test(text)&&/пуст/i.test(text)){state='curious';hint='Корзина пустая. Добавь товар — и погнали 🛒';}
    else if(/сравн/i.test(text)){state='checking';hint='Сверяю варианты. Смотри на итог корзины и путь 👀';}
    if(hint===lastHint&&bai.classList.contains('is-talking'))return;
    lastHint=hint; setState(state,hint,3500);
  };

  bai.addEventListener('click',()=>{wake();contextHint();});
  ['pointerdown','keydown'].forEach(type=>window.addEventListener(type,wake,{passive:true}));
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',place,{passive:true});
  document.addEventListener('click',event=>{
    if(event.target.closest('.step button:last-child'))setState('happy','Есть! Ещё товар в корзине 🐾');
    if(event.target.closest('.btn.yellow,.btn.green'))setState('checking','Проверяю цены 🔎',2600);
  });
  window.addEventListener('bai:checking',()=>setState('checking','Проверяю цены 🔎'));
  window.addEventListener('bai:happy',()=>setState('happy','Нашёл вариант дешевле! 🎉'));
  window.addEventListener('bai:grumpy',()=>setState('suspicious','Хм. Тут цена пока не подтверждена 🤨'));
  window.addEventListener('bai:thinking',()=>setState('thinking','Считаю… 🐾'));
  window.addEventListener('bai:peek',contextHint);
  window.addEventListener('bai:goodbye',()=>setState('goodbye','Увидимся 🐾',1800));
  window.addEventListener('bai:hint',e=>e.detail?.text&&setState(e.detail.state||'thinking',e.detail.text,e.detail.ms||3000));

  bai.dataset.state='idle'; place();
  setTimeout(()=>bai.classList.add('is-ready'),250);
  setTimeout(()=>setState('greeting','Сәлам! Я Бай 🐾',2200),650);
  new MutationObserver(place).observe(document.body,{childList:true,subtree:true});
  wake();
})();