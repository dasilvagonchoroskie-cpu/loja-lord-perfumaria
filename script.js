document.getElementById('ano').textContent = new Date().getFullYear();

// Número de WhatsApp da loja (Juliano)
const WHATSAPP_LOJA = '5564992221728';

if (WHATSAPP_LOJA) {
  const btn = document.getElementById('whatsapp-btn');
  btn.href = 'https://wa.me/' + WHATSAPP_LOJA;
  btn.style.display = 'flex';
}

const PLACEHOLDER_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="10" y="2" width="4" height="3" rx="0.5"/>
    <rect x="11" y="5" width="2" height="3"/>
    <path d="M8 8h8l2 4v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-9z"/>
  </svg>
`;

db.collection('produtos').get().then(function(snapshot) {
  const container = document.getElementById('produtos-lista');
  container.innerHTML = '';

  if (snapshot.empty) {
    container.innerHTML = '<p class="loading-msg">Catálogo em preparação — novidades em breve.</p>';
    return;
  }

  let temProdutoVisivel = false;

  snapshot.forEach(function(doc) {
    const data = doc.data();
    if (data.disponivel === false) return; // produto desativado não aparece
    temProdutoVisivel = true;

    const precoFormatado = data.preco
      ? 'R$ ' + Number(data.preco).toFixed(2).replace('.', ',')
      : '';

    const mensagem = encodeURIComponent('Olá! Tenho interesse no perfume: ' + (data.nome || ''));
    const linkComprar = WHATSAPP_LOJA
      ? `https://wa.me/${WHATSAPP_LOJA}?text=${mensagem}`
      : '#';

    const imagemHtml = data.foto
      ? `<img src="${escapeHtml(data.foto)}" alt="${escapeHtml(data.nome || '')}" class="produto-img">`
      : `<div class="produto-img-placeholder">${PLACEHOLDER_ICON}<span>Sem foto</span></div>`;

    const card = document.createElement('article');
    card.className = 'produto-card';
    card.innerHTML = `
      ${imagemHtml}
      <div class="produto-info">
        <h3>${escapeHtml(data.nome || '')}</h3>
        <p>${escapeHtml(data.descricao || '')}</p>
        <div class="produto-preco">${precoFormatado}</div>
        <a href="${linkComprar}" target="_blank" rel="noopener" class="produto-comprar">Comprar via WhatsApp</a>
      </div>
    `;
    container.appendChild(card);
  });

  if (!temProdutoVisivel) {
    container.innerHTML = '<p class="loading-msg">Catálogo em preparação — novidades em breve.</p>';
  }
}).catch(function(error) {
  console.error('Erro ao carregar produtos:', error);
  document.getElementById('produtos-lista').innerHTML = '<p class="loading-msg">Não foi possível carregar o catálogo agora. Erro: ' + error.code + '</p>';
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
