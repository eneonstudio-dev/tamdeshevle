(() => {
  if (document.getElementById('bai-assistant')) return;
  const bai = document.createElement('button');
  bai.id = 'bai-assistant'; bai.className = 'bai-assistant'; bai.type = 'button';
  bai.setAttribute('aria-label', 'Бай — помощник Тамдешевле');
  bai.innerHTML = `<span class="bai-bubble" aria-hidden="true"></span><img src="assets/bai/bai-happy.webp" alt="" draggable="false">`;
  document.body.appendChild(bai);

  let hideTimer, idleTimer, lastHint = '';
  const bubble = bai.querySelector('.bai-bubble');
  const setState = (state, text, ms = 3200) => {
    bai.dataset.state = state; bubble.textContent = text;
    bai.classList.toggle('is-talking', Boolean(text)); clearTimeout(hideTimer);
    if (text) hideTimer = setTimeout(() => bai.classList.remove('is-talking'), ms);
  };
  const wake = () => {
    clearTimeout(idleTimer);
    if (bai.dataset.state === 'sleep') setState('idle', 'О, ты вернулся 🐾', 1800);
    idleTimer = setTimeout(() => setState('sleep', 'Я тут подремлю… разбудишь 😴', 2600), 45000);
  };
  const contextHint = () => {
    const text = document.body.innerText;
    let hint = 'Добавляй товары — покажу, где корзина дешевле 🐾';
    if (text.includes('≈ каталог')) hint = '≈ — цена из регионального каталога. Она не считается подтверждённой ценой магазина 🐾';
    else if (/корзин/i.test(text) && /пуст/i.test(text)) hint = 'Корзина пустая. Добавь хотя бы один товар — дальше я помогу 🛒';
    else if (/сравн/i.test(text)) hint = 'Смотри не только на итог: доставка может поменять самый выгодный вариант 👀';
    else if (/профил|настройк/i.test(text)) hint = 'Тут можно настроить Тамдешевле под себя. Я мешать не буду 🐾';
    if (hint === lastHint && bai.classList.contains('is-talking')) return;
    lastHint = hint; setState('peek', hint, 4300);
  };

  bai.addEventListener('click', () => { wake(); contextHint(); });
  ['pointerdown','keydown','scroll'].forEach(type => window.addEventListener(type, wake, {passive:true}));
  document.addEventListener('click', (event) => {
    if (event.target.closest('.step button:last-child')) setState('happy', 'Есть! Ещё товар в корзине 🐾');
    if (event.target.closest('.btn.yellow,.btn.green')) setState('checking', 'Секунду, проверяю цены 🔎', 4200);
  });
  window.addEventListener('bai:checking', () => setState('checking', 'Проверяю цены 🔎'));
  window.addEventListener('bai:happy', () => setState('happy', 'Нашёл вариант дешевле! 🎉'));
  window.addEventListener('bai:grumpy', () => setState('grumpy', 'Хм. Тут цена пока не подтверждена 🤨'));
  window.addEventListener('bai:peek', contextHint);
  window.addEventListener('bai:hint', (e) => e.detail?.text && setState(e.detail.state || 'peek', e.detail.text, e.detail.ms || 3500));

  setTimeout(() => bai.classList.add('is-ready'), 450);
  setTimeout(() => setState('greeting', 'Сәлам! Я Бай. Помогу найти дешевле 🐾', 3600), 900);
  wake();
})();