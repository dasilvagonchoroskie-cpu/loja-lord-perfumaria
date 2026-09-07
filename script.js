document.getElementById('ano').textContent = new Date().getFullYear();

// Valores padrão — usados até o Juliano configurar pelo painel administrativo
const WHATSAPP_PADRAO = '5564992221728';
const EMAIL_PADRAO = 'lordperfumaria1@gmail.com';

const PLACEHOLDER_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="10" y="2" width="4" height="3" rx="0.5"/>
    <rect x="11" y="5" width="2" height="3"/>
    <path d="M8 8h8l2 4v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-9z"/>
  </svg>
`;

function onFotoProdutoErro(imgEl) {
  const placeholder = document.createElement('div');
  placeholder.className = 'produto-img-placeholder';
  placeholder.innerHTML = PLACEHOLDER_ICON + '<span>Sem foto</span>';
  imgEl.replaceWith(placeholder);
}

function extrairYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function aplicarConfiguracoes(config) {
  const whatsapp = (config.whatsapp || WHATSAPP_PADRAO).trim();
  const email = (config.email || EMAIL_PADRAO).trim();

  if (whatsapp) {
    const btn = document.getElementById('whatsapp-btn');
    btn.href = 'https://wa.me/' + whatsapp;
    btn.style.display = 'flex';
  }

  const emailLink = document.getElementById('email-contato');
  if (emailLink && email) {
    emailLink.href = 'mailto:' + email;
    emailLink.textContent = email;
  }

  if (config.heroTitulo) {
    document.getElementById('hero-titulo').textContent = config.heroTitulo;
  }
  if (config.heroDescricao) {
    document.getElementById('hero-descricao').textContent = config.heroDescricao;
  }

  // Banner: faixa larga abaixo do cabeçalho. Quando existe, o desenho
  // do frasco no hero some (pra não ficar repetindo imagem de perfume).
  if (config.bannerUrl) {
    const bannerWrap = document.getElementById('banner-wrap');
    document.getElementById('banner-img').src = config.bannerUrl;
    bannerWrap.style.display = 'block';
    document.getElementById('hero-art').style.display = 'none';
    document.getElementById('hero-container').classList.add('sem-arte');
  }

  const videoId = extrairYoutubeId(config.videoUrl);
  if (videoId) {
    document.getElementById('video-wrap').innerHTML =
      '<iframe src="https://www.youtube.com/embed/' + videoId + '" title="Vídeo Lord Perfumaria" allowfullscreen loading="lazy"></iframe>';
    document.getElementById('video-section').style.display = 'block';
  }

  return whatsapp;
}

function carregarProdutos(whatsapp) {
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
      const linkComprar = whatsapp
        ? `https://wa.me/${whatsapp}?text=${mensagem}`
        : '#';

      // Se a foto falhar ao carregar (link quebrado, apagado do ImgBB etc.),
      // onFotoProdutoErro troca pelo mesmo aviso "Sem foto" — nunca mais fica
      // um quadro em branco sem explicação.
      const imagemHtml = data.foto
        ? `<img src="${escapeHtml(data.foto)}" alt="${escapeHtml(data.nome || '')}" class="produto-img" loading="lazy" onerror="onFotoProdutoErro(this)">`
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
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Carrega configurações da loja primeiro (com fallback seguro), depois os produtos
db.collection('config').doc('site').get().then(function(doc) {
  const config = doc.exists ? doc.data() : {};
  const whatsapp = aplicarConfiguracoes(config);
  carregarProdutos(whatsapp);
}).catch(function() {
  const whatsapp = aplicarConfiguracoes({});
  carregarProdutos(whatsapp);
});
