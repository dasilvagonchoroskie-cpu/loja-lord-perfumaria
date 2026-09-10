document.getElementById('ano').textContent = new Date().getFullYear();

// Valores padrão — usados até o Juliano configurar pelo painel administrativo
const WHATSAPP_PADRAO = '5564992221728';
const EMAIL_PADRAO = 'lordperfumaria1@gmail.com';
const NOME_LOJA = 'LORD PERFUMARIA';

// Temas prontos — mesma lista de admin.js, contraste já conferido
const TEMAS = {
  'escuro-dourado':   { bg: '#14100D', texto: '#EDE6D8', destaque: '#C9A24B' },
  'claro-elegante':   { bg: '#F5F0E6', texto: '#241C13', destaque: '#8A6F3A' },
  'azul-petroleo':    { bg: '#0D1B1E', texto: '#E8F1F0', destaque: '#4FA8A0' },
  'verde-esmeralda':  { bg: '#0F1B14', texto: '#E9F2EA', destaque: '#5FA87A' },
  'grafite':          { bg: '#17181A', texto: '#F0F0EF', destaque: '#C9A24B' },
  'dourado-intenso':  { bg: '#1C1206', texto: '#F5E6C8', destaque: '#E0B563' }
};
const TEMA_PADRAO = 'escuro-dourado';

let PIX_CONFIG = null; // definido em aplicarConfiguracoes() se houver chave Pix cadastrada
let WHATSAPP_ATUAL = WHATSAPP_PADRAO; // usado pelo checkout do carrinho
let CLIENTE_ATUAL = null; // definido pelo listener de login do cliente, lá embaixo

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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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

// ===================== CARRINHO (guardado no navegador, não precisa de login) =====================

const CARRINHO_CHAVE = 'lordperfumaria_carrinho';

function obterCarrinho() {
  try {
    return JSON.parse(localStorage.getItem(CARRINHO_CHAVE) || '[]');
  } catch (e) { return []; }
}

function salvarCarrinhoLocal(itens) {
  try { localStorage.setItem(CARRINHO_CHAVE, JSON.stringify(itens)); } catch (e) {}
  atualizarBadgeCarrinho();
}

function atualizarBadgeCarrinho() {
  const itens = obterCarrinho();
  const total = itens.reduce(function(soma, item) { return soma + item.quantidade; }, 0);
  const badge = document.getElementById('carrinho-contador');
  if (total > 0) {
    badge.textContent = total;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function adicionarAoCarrinho(id, nome, preco, foto) {
  const itens = obterCarrinho();
  const existente = itens.find(function(i) { return i.id === id; });
  if (existente) {
    existente.quantidade += 1;
  } else {
    itens.push({ id: id, nome: nome, preco: Number(preco) || 0, foto: foto || '', quantidade: 1 });
  }
  salvarCarrinhoLocal(itens);
}

function alterarQuantidadeCarrinho(id, delta) {
  let itens = obterCarrinho();
  const item = itens.find(function(i) { return i.id === id; });
  if (!item) return;
  item.quantidade += delta;
  if (item.quantidade <= 0) {
    itens = itens.filter(function(i) { return i.id !== id; });
  }
  salvarCarrinhoLocal(itens);
  renderizarCarrinho();
}

function removerDoCarrinho(id) {
  const itens = obterCarrinho().filter(function(i) { return i.id !== id; });
  salvarCarrinhoLocal(itens);
  renderizarCarrinho();
}

function calcularTotalCarrinho(itens) {
  return itens.reduce(function(soma, item) { return soma + (item.preco * item.quantidade); }, 0);
}

function renderizarCarrinho() {
  const itens = obterCarrinho();
  const container = document.getElementById('carrinho-itens');
  const totalEl = document.getElementById('carrinho-total');
  const btnPix = document.getElementById('carrinho-pix-btn');
  const btnWhats = document.getElementById('carrinho-whatsapp-btn');

  if (!itens.length) {
    container.innerHTML = '<p class="carrinho-vazio">Seu carrinho está vazio.</p>';
    totalEl.textContent = '';
    btnWhats.href = '#';
    btnPix.style.display = 'none';
    return;
  }

  btnPix.style.display = (PIX_CONFIG && PIX_CONFIG.chave) ? 'block' : 'none';

  container.innerHTML = itens.map(function(item) {
    const fotoHtml = item.foto
      ? `<img src="${escapeHtml(item.foto)}" alt="">`
      : `<div class="carrinho-item-sem-foto">Sem foto</div>`;
    return `
      <div class="carrinho-item">
        ${fotoHtml}
        <div class="carrinho-item-info">
          <strong>${escapeHtml(item.nome)}</strong>
          <div class="carrinho-item-qtd">
            <button type="button" onclick="alterarQuantidadeCarrinho('${item.id}', -1)" aria-label="Diminuir">−</button>
            <span>${item.quantidade}</span>
            <button type="button" onclick="alterarQuantidadeCarrinho('${item.id}', 1)" aria-label="Aumentar">+</button>
          </div>
        </div>
        <span class="carrinho-item-preco">R$ ${(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</span>
        <button type="button" class="carrinho-item-remover" onclick="removerDoCarrinho('${item.id}')" aria-label="Remover">×</button>
      </div>
    `;
  }).join('');

  const total = calcularTotalCarrinho(itens);
  totalEl.textContent = 'Total: R$ ' + total.toFixed(2).replace('.', ',');

  const linhasMsg = itens.map(function(item) {
    return item.quantidade + 'x ' + item.nome + ' (R$ ' + (item.preco * item.quantidade).toFixed(2).replace('.', ',') + ')';
  });
  let textoMsg = 'Olá! Quero fazer um pedido:\n' + linhasMsg.join('\n') + '\nTotal: R$ ' + total.toFixed(2).replace('.', ',');
  if (CLIENTE_ATUAL && CLIENTE_ATUAL.nome) {
    textoMsg = 'Meu nome: ' + CLIENTE_ATUAL.nome + '\n' + textoMsg;
  }
  btnWhats.href = WHATSAPP_ATUAL
    ? 'https://wa.me/' + WHATSAPP_ATUAL + '?text=' + encodeURIComponent(textoMsg)
    : '#';
}

function abrirCarrinho() {
  renderizarCarrinho();
  document.getElementById('carrinho-modal').style.display = 'flex';
}

function fecharCarrinho() {
  document.getElementById('carrinho-modal').style.display = 'none';
}

function finalizarCarrinhoComPix() {
  const itens = obterCarrinho();
  if (!itens.length) return;
  const total = calcularTotalCarrinho(itens);
  fecharCarrinho();
  abrirModalPix('Pedido (' + itens.length + ' ' + (itens.length === 1 ? 'item' : 'itens') + ')', total);
}

// ===================== CONTA DO CLIENTE (cadastro/login próprios, separados do admin) =====================

function mostrarAbaConta(nome) {
  document.getElementById('conta-aba-entrar').style.display = nome === 'entrar' ? 'block' : 'none';
  document.getElementById('conta-aba-cadastrar').style.display = nome === 'cadastrar' ? 'block' : 'none';
  document.querySelectorAll('.conta-tab').forEach(function(btn) {
    btn.classList.toggle('ativo', btn.dataset.abaConta === nome);
  });
  document.getElementById('conta-erro').textContent = '';
}

function abrirModalConta() {
  document.getElementById('conta-modal').style.display = 'flex';
}

function fecharModalConta() {
  document.getElementById('conta-modal').style.display = 'none';
}

function loginCliente() {
  const email = document.getElementById('conta-login-email').value.trim();
  const senha = document.getElementById('conta-login-senha').value;
  const erroEl = document.getElementById('conta-erro');
  erroEl.style.color = '';
  erroEl.textContent = '';
  auth.signInWithEmailAndPassword(email, senha).catch(function(error) {
    erroEl.textContent = 'Erro (' + error.code + '): ' + error.message;
  });
}

function recuperarSenhaCliente() {
  const erroEl = document.getElementById('conta-erro');
  let email = document.getElementById('conta-login-email').value.trim();
  if (!email) {
    email = prompt('Digite seu e-mail cadastrado:');
    if (!email) return;
  }
  erroEl.textContent = '';
  auth.sendPasswordResetEmail(email).then(function() {
    erroEl.style.color = 'var(--success)';
    erroEl.textContent = 'Enviamos um link pra ' + email + '. Confira seu e-mail.';
  }).catch(function(error) {
    erroEl.style.color = '';
    erroEl.textContent = 'Erro (' + error.code + '): ' + error.message;
  });
}

function cadastrarCliente() {
  const nome = document.getElementById('conta-cad-nome').value.trim();
  const email = document.getElementById('conta-cad-email').value.trim();
  const whatsapp = document.getElementById('conta-cad-whatsapp').value.trim().replace(/\D/g, '');
  const senha = document.getElementById('conta-cad-senha').value;
  const erroEl = document.getElementById('conta-erro');
  erroEl.style.color = '';
  erroEl.textContent = '';

  if (!nome || !email || !senha) { erroEl.textContent = 'Preencha nome, e-mail e senha.'; return; }

  auth.createUserWithEmailAndPassword(email, senha).then(function(cred) {
    return db.collection('clientes').doc(cred.user.uid).set({ nome: nome, email: email, whatsapp: whatsapp });
  }).catch(function(error) {
    erroEl.textContent = 'Erro (' + error.code + '): ' + error.message;
  });
}

function sairCliente() {
  auth.signOut();
}

function salvarPerfilCliente() {
  if (!auth.currentUser) return;
  const nome = document.getElementById('perfil-nome').value.trim();
  const whatsapp = document.getElementById('perfil-whatsapp').value.trim().replace(/\D/g, '');
  const msgEl = document.getElementById('perfil-msg');
  db.collection('clientes').doc(auth.currentUser.uid).set({ nome: nome, whatsapp: whatsapp }, { merge: true }).then(function() {
    CLIENTE_ATUAL = Object.assign({}, CLIENTE_ATUAL, { nome: nome, whatsapp: whatsapp });
    msgEl.textContent = 'Salvo!';
    setTimeout(function() { msgEl.textContent = ''; }, 2500);
  }).catch(function(error) {
    alert('Erro ao salvar: ' + error.message);
  });
}

auth.onAuthStateChanged(function(user) {
  const visitante = document.getElementById('conta-visitante');
  const logado = document.getElementById('conta-logado');
  if (user) {
    db.collection('clientes').doc(user.uid).get().then(function(doc) {
      const data = doc.exists ? doc.data() : {};
      CLIENTE_ATUAL = { uid: user.uid, nome: data.nome || '', whatsapp: data.whatsapp || '', email: user.email };
      document.getElementById('perfil-nome').value = CLIENTE_ATUAL.nome;
      document.getElementById('perfil-whatsapp').value = CLIENTE_ATUAL.whatsapp;
      visitante.style.display = 'none';
      logado.style.display = 'block';
    });
  } else {
    CLIENTE_ATUAL = null;
    visitante.style.display = 'block';
    logado.style.display = 'none';
    mostrarAbaConta('entrar');
  }
});

// ===================== Configurações da loja =====================

function aplicarConfiguracoes(config) {
  const whatsapp = (config.whatsapp || WHATSAPP_PADRAO).trim();
  const email = (config.email || EMAIL_PADRAO).trim();
  WHATSAPP_ATUAL = whatsapp;

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

  const raiz = document.documentElement.style;
  const tema = TEMAS[config.tema] || TEMAS[TEMA_PADRAO];
  raiz.setProperty('--bg', tema.bg);
  raiz.setProperty('--bg-elevated', ajustarCor(tema.bg, 18));
  raiz.setProperty('--bg-elevated-2', ajustarCor(tema.bg, 28));
  raiz.setProperty('--border', ajustarCor(tema.bg, 45));
  raiz.setProperty('--danger-bg', ajustarCor(tema.bg, 15));
  raiz.setProperty('--success-bg', ajustarCor(tema.bg, 15));
  raiz.setProperty('--text', tema.texto);
  raiz.setProperty('--text-muted', ajustarCor(tema.texto, -60));
  raiz.setProperty('--accent', tema.destaque);
  raiz.setProperty('--accent-dim', ajustarCor(tema.destaque, -50));
  raiz.setProperty('--escala-fonte', config.escalaFonte || '1');

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
      const fotoEscapadaJs = (data.foto || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      const btnPix = (PIX_CONFIG && PIX_CONFIG.chave)
        ? `<button type="button" class="produto-comprar produto-pix-btn" onclick="abrirModalPix('${nomeEscapadoJs}', ${Number(data.preco) || 0})">Pagar com Pix</button>`
        : '';

      const btnCarrinho = `<button type="button" class="produto-comprar produto-carrinho-btn" onclick="adicionarAoCarrinho('${doc.id}', '${nomeEscapadoJs}', ${Number(data.preco) || 0}, '${fotoEscapadaJs}')">+ Carrinho</button>`;

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
            ${btnCarrinho}
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

// Aplica IMEDIATAMENTE o que estiver salvo localmente (evita a
// "piscada" do visual padrão antes da configuração real do Firestore
// chegar), e atualiza o contador do carrinho assim que a página abre.
const CACHE_CONFIG_CHAVE = 'lordperfumaria_config_cache';
try {
  const configEmCache = localStorage.getItem(CACHE_CONFIG_CHAVE);
  if (configEmCache) aplicarConfiguracoes(JSON.parse(configEmCache));
} catch (e) { /* sem cache ou cache invalido — segue normal */ }
atualizarBadgeCarrinho();

// Carrega configurações da loja de verdade (com fallback seguro), depois os produtos
db.collection('config').doc('site').get().then(function(doc) {
  const config = doc.exists ? doc.data() : {};
  const whatsapp = aplicarConfiguracoes(config);
  try { localStorage.setItem(CACHE_CONFIG_CHAVE, JSON.stringify(config)); } catch (e) {}
  carregarProdutos(whatsapp);
}).catch(function() {
  const whatsapp = aplicarConfiguracoes({});
  carregarProdutos(whatsapp);
});
