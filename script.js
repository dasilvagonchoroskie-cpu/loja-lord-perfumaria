document.getElementById('ano').textContent = new Date().getFullYear();

// TROCAR pelo número de WhatsApp do Juliano quando tiver (com DDI e DDD, ex: 5564999998888)
const WHATSAPP_LOJA = '556492221728';

if (WHATSAPP_LOJA !== '556492221728') {
  const btn = document.getElementById('whatsapp-btn');
  btn.href = 'https://wa.me/' + WHATSAPP_LOJA;
  btn.style.display = 'flex';
}

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
    const linkComprar = WHATSAPP_LOJA !== '556492221728'
      ? `https://wa.me/${WHATSAPP_LOJA}?text=${mensagem}`
      : '#';

    const imagemHtml = data.foto
      ? `<img src="${escapeHtml(data.foto)}" alt="${escapeHtml(data.nome || '')}" class="produto-img">`
      : `<div class="produto-img-placeholder">Sem foto</div>`;

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
  document.getElementById('produtos-lista').innerHTML = '<p class="loading-msg">Não foi possível carregar o catálogo agora.</p>';
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
