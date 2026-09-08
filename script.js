document.getElementById('ano').textContent = new Date().getFullYear();

// Valores padrão — usados até o Juliano configurar pelo painel administrativo
const WHATSAPP_PADRAO = '5564992221728';
const EMAIL_PADRAO = 'lordperfumaria1@gmail.com';
const NOME_LOJA = 'LORD PERFUMARIA';

let PIX_CONFIG = null; // definido em aplicarConfiguracoes() se houver chave Pix cadastrada

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

// Clareia (quantidade positiva) ou escurece (quantidade negativa) uma cor hex.
// Usado pra gerar sozinho as variações (fundo dos cartões, bordas, tons
// esmaecidos) a partir das 3 cores que o Juliano escolhe, mantendo a paleta
// inteira coerente em vez de só trocar 3 cores soltas.
function ajustarCor(hex, quantidade) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(function(c) { return c + c; }).join('');
  const num = parseInt(hex, 16);
  let r = (num >> 16) + quantidade;
  let g = ((num >> 8) & 0x00FF) + quantidade;
  let b = (num & 0x0000FF) + quantidade;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1).toUpperCase();
}

function extrairYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ===================== PIX (BR Code / EMV QR estático, padrão Banco Central) =====================

function crc16Pix(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlvPix(id, value) {
  const len = String(value.length).padStart(2, '0');
  return id + len + value;
}

function gerarPixCopiaCola(opts) {
  const chave = opts.chave;
  const nome = (opts.nome || NOME_LOJA).substring(0, 25);
  const cidade = (opts.cidade || 'BRASIL').substring(0, 15);
  let txid = (opts.txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25);
  if (!txid) txid = '***';

  const merchantAccountInfo = tlvPix('00', 'BR.GOV.BCB.PIX') + tlvPix('01', chave);

  let payload =
    tlvPix('00', '01') +
    tlvPix('01', '11') +
    tlvPix('26', merchantAccountInfo) +
    tlvPix('52', '0000') +
    tlvPix('53', '986');

  if (opts.valor && Number(opts.valor) > 0) {
    payload += tlvPix('54', Number(opts.valor).toFixed(2));
  }

  payload += tlvPix('58', 'BR') + tlvPix('59', nome) + tlvPix('60', cidade);
  payload += tlvPix('62', tlvPix('05', txid));
  payload += '6304';

  return payload + crc16Pix(payload);
}

function abrirModalPix(nomeProduto, preco) {
  if (!PIX_CONFIG || !PIX_CONFIG.chave) return;

  document.getElementById('pix-modal-produto').textContent = nomeProduto;
  document.getElementById('pix-modal-valor').textContent = 'R$ ' + Number(preco).toFixed(2).replace('.', ',');

  const codigo = gerarPixCopiaCola({
    chave: PIX_CONFIG.chave,
    nome: PIX_CONFIG.nomeLoja,
    cidade: PIX_CONFIG.cidade,
    valor: preco,
    txid: '***'
  });

  document.getElementById('pix-codigo').value = codigo;
  document.getElementById('pix-copiar-msg').textContent = '';

  const qrEl = document.getElementById('pix-qrcode');
  qrEl.innerHTML = '';
  if (window.QRCode) {
    new QRCode(qrEl, { text: codigo, width: 200, height: 200 });
  }

  document.getElementById('pix-modal').style.display = 'flex';
}

function fecharModalPix() {
  document.getElementById('pix-modal').style.display = 'none';
}

function copiarCodigoPix() {
  const campo = document.getElementById('pix-codigo');
  campo.select();
  const msgEl = document.getElementById('pix-copiar-msg');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(campo.value).then(function() {
      msgEl.textContent = 'Código copiado! Cole no app do seu banco.';
    }).catch(function() {
      msgEl.textContent = 'Não copiou sozinho — o texto já está selecionado, copie manualmente.';
    });
  } else {
    document.execCommand('copy');
    msgEl.textContent = 'Código copiado! Cole no app do seu banco.';
  }
}

// ===================== Configurações da loja =====================

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

  if (config.pixKey) {
    PIX_CONFIG = {
      chave: config.pixKey,
      cidade: config.pixCidade || 'BRASIL',
      nomeLoja: NOME_LOJA
    };
  }

  if (config.linkAdminVisivel !== false) {
    document.getElementById('admin-link-wrap').style.display = 'block';
  }

  // Cores personalizadas (se o Juliano configurou). O resto da paleta
  // (fundo dos cartões, bordas, tons esmaecidos) é derivado automaticamente
  // dessas 3 cores, pra loja continuar com visual coerente em qualquer combinação.
  const raiz = document.documentElement.style;
  if (config.corFundo) {
    raiz.setProperty('--bg', config.corFundo);
    raiz.setProperty('--bg-elevated', ajustarCor(config.corFundo, 18));
    raiz.setProperty('--bg-elevated-2', ajustarCor(config.corFundo, 28));
    raiz.setProperty('--border', ajustarCor(config.corFundo, 45));
    raiz.setProperty('--danger-bg', ajustarCor(config.corFundo, 15));
    raiz.setProperty('--success-bg', ajustarCor(config.corFundo, 15));
  }
  if (config.corTexto) {
    raiz.setProperty('--text', config.corTexto);
    raiz.setProperty('--text-muted', ajustarCor(config.corTexto, -60));
  }
  if (config.corDestaque) {
    raiz.setProperty('--accent', config.corDestaque);
    raiz.setProperty('--accent-dim', ajustarCor(config.corDestaque, -50));
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

      const partesMsg = ['Olá! Tenho interesse no perfume: ' + (data.nome || '')];
      if (data.foto) partesMsg.push(data.foto);
      const mensagem = encodeURIComponent(partesMsg.join('\n'));
      const linkComprar = whatsapp
        ? `https://wa.me/${whatsapp}?text=${mensagem}`
        : '#';

      const imagemHtml = data.foto
        ? `<img src="${escapeHtml(data.foto)}" alt="${escapeHtml(data.nome || '')}" class="produto-img" loading="lazy" onerror="onFotoProdutoErro(this)">`
        : `<div class="produto-img-placeholder">${PLACEHOLDER_ICON}<span>Sem foto</span></div>`;

      const nomeEscapadoJs = (data.nome || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const btnPix = (PIX_CONFIG && PIX_CONFIG.chave)
        ? `<button type="button" class="produto-comprar produto-pix-btn" onclick="abrirModalPix('${nomeEscapadoJs}', ${Number(data.preco) || 0})">Pagar com Pix</button>`
        : '';

      const card = document.createElement('article');
      card.className = 'produto-card';
      card.innerHTML = `
        ${imagemHtml}
        <div class="produto-info">
          <h3>${escapeHtml(data.nome || '')}</h3>
          <p>${escapeHtml(data.descricao || '')}</p>
          <div class="produto-preco">${precoFormatado}</div>
          <div class="produto-acoes">
            <a href="${linkComprar}" class="produto-comprar">Comprar via WhatsApp</a>
            ${btnPix}
          </div>
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
