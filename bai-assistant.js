(() => {
  if (document.getElementById('bai-assistant')) return;
  const bai = document.createElement('button');
  bai.id = 'bai-assistant';
  bai.className = 'bai-assistant';
  bai.type = 'button';
  bai.setAttribute('aria-label', 'Бай — помощник Тамдешевле');
  bai.innerHTML = `<span class="bai-bubble" aria-hidden="true">Я тут. Ищу, где дешевле 👀</span><img src="assets/bai/bai-happy.webp" alt="" draggable="false">`;
  document.body.appendChild(bai);

  let hideTimer;
  const say = (text) => {
    const bubble = bai.querySelector('.bai-bubble');
    bubble.textContent = text;
    bai.classList.add('is-talking');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => bai.classList.remove('is-talking'), 3200);
  };

  bai.addEventListener('click', () => say('Бай! Добавляй товары — сравним корзину 🐾'));
  document.addEventListener('click', (event) => {
    if (event.target.closest('.step button:last-child')) say('Есть! Ещё товар в корзине 🐾');
    if (event.target.closest('.btn.yellow,.btn.green')) say('Секунду, проверяю цены 🔎');
  });
  window.addEventListener('bai:checking', () => say('Проверяю цены 🔎'));
  window.addEventListener('bai:happy', () => say('Нашёл вариант дешевле! 🎉'));

  setTimeout(() => bai.classList.add('is-ready'), 450);
  setTimeout(() => say('Привет! Я Бай. Помогу найти дешевле 🐾'), 1100);
})();