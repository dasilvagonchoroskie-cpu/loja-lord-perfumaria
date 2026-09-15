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
  // A versao leve da foto e gerada pelo ImgBB depois do envio, e nos
  // primeiros minutos ela pode nao existir ainda. Antes de desistir e
  // mostrar "Sem foto", tenta a foto original.
  const reserva = imgEl.getAttribute('data-reserva');
  if (reserva) {
    imgEl.removeAttribute('data-reserva');
    imgEl.src = reserva;
    return;
  }
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

  // Cada item leva a foto logo embaixo. O link do WhatsApp so carrega
  // texto — nao da pra anexar imagem —, entao vai o endereco da foto,
  // que o Juliano toca e ve qual perfume e.
  const linhasMsg = itens.map(function(item) {
    const linha = item.quantidade + 'x ' + item.nome + ' (R$ ' + (item.preco * item.quantidade).toFixed(2).replace('.', ',') + ')';
    return item.foto ? linha + '\n' + item.foto : linha;
  });
  let textoMsg = 'Olá! Quero fazer um pedido:\n' + linhasMsg.join('\n') + '\nTotal: R$ ' + total.toFixed(2).replace('.', ',');
  if (CLIENTE_ATUAL && CLIENTE_ATUAL.nome) {
    textoMsg = 'Meu nome: ' + CLIENTE_ATUAL.nome + '\n' + textoMsg;
  }
  // O endereco de entrega vai junto: sem isso o Juliano teria que pedir
  // por mensagem toda vez, e e ai que o pedido esfria.
  const enderecoTexto = enderecoEmTexto(CLIENTE_ATUAL);
  if (enderecoTexto) {
    textoMsg += '\n\nEntregar em:\n' + enderecoTexto;
  }
  // Pedido muito grande estoura o tamanho que o link do WhatsApp
  // aguenta. Passando do limite, as fotos saem e o pedido vai sem elas
  // — melhor perder a foto do que perder o pedido.
  if (textoMsg.length > 1500) {
    const semFotos = itens.map(function(item) {
      return item.quantidade + 'x ' + item.nome + ' (R$ ' + (item.preco * item.quantidade).toFixed(2).replace('.', ',') + ')';
    });
    textoMsg = 'Olá! Quero fazer um pedido:\n' + semFotos.join('\n') +
               '\nTotal: R$ ' + total.toFixed(2).replace('.', ',');
    if (CLIENTE_ATUAL && CLIENTE_ATUAL.nome) {
      textoMsg = 'Meu nome: ' + CLIENTE_ATUAL.nome + '\n' + textoMsg;
    }
    if (enderecoTexto) textoMsg += '\n\nEntregar em:\n' + enderecoTexto;
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

// Campos do endereco de entrega, num lugar so, pra nao escrever a
// lista tres vezes (salvar, carregar e montar o pedido).
const CAMPOS_ENDERECO = ['rua', 'numero', 'complemento', 'bairro', 'cidade', 'cep', 'referencia', 'telefone'];

function lerCamposDoPerfil() {
  const dados = {};
  CAMPOS_ENDERECO.forEach(function(campo) {
    const el = document.getElementById('perfil-' + campo);
    dados[campo] = el ? el.value.trim() : '';
  });
  return dados;
}

// Monta o endereco em linhas, do jeito que se escreve num papel.
// Campo vazio simplesmente nao aparece.
function enderecoEmTexto(cliente) {
  if (!cliente) return '';
  const linhas = [];
  const rua = [cliente.rua, cliente.numero].filter(Boolean).join(', ');
  if (rua) linhas.push(rua + (cliente.complemento ? ' — ' + cliente.complemento : ''));
  const bairroCidade = [cliente.bairro, cliente.cidade].filter(Boolean).join(' — ');
  if (bairroCidade) linhas.push(bairroCidade);
  if (cliente.cep) linhas.push('CEP ' + cliente.cep);
  if (cliente.referencia) linhas.push('Referência: ' + cliente.referencia);
  const fone = cliente.telefone || cliente.whatsapp;
  if (fone) linhas.push('Telefone: ' + fone);
  return linhas.join('\n');
}

// Manda o link de troca de senha pro proprio e-mail da conta. E o jeito
// seguro: nao precisa digitar a senha antiga e nao trava se o login for
// antigo.
function trocarSenhaCliente() {
  if (!auth || !auth.currentUser) return;
  const email = auth.currentUser.email;
  const msgEl = document.getElementById('perfil-msg');
  auth.sendPasswordResetEmail(email).then(function() {
    msgEl.textContent = 'Link enviado para ' + email + '. Olhe também o lixo eletrônico.';
  }).catch(function(error) {
    alert('Não deu para enviar: ' + error.message);
  });
}

// Apaga os dados do cliente e o acesso dele. Pergunta duas vezes porque
// nao tem volta.
function excluirContaCliente() {
  if (!auth || !auth.currentUser) return;
  if (!confirm('Excluir sua conta?\n\nSeu nome, endereço e acesso serão apagados. Não dá para desfazer.')) return;
  if (!confirm('Tem certeza mesmo?\n\nDepois disso você precisará se cadastrar de novo do zero.')) return;

  const usuario = auth.currentUser;
  const uid = usuario.uid;
  const msgEl = document.getElementById('perfil-msg');
  msgEl.textContent = 'Apagando...';

  db.collection('clientes').doc(uid).delete().then(function() {
    return usuario.delete();
  }).then(function() {
    CLIENTE_ATUAL = null;
    fecharModalConta();
    alert('Conta excluída. Você pode se cadastrar de novo quando quiser.');
  }).catch(function(error) {
    msgEl.textContent = '';
    if (error.code === 'auth/requires-recent-login') {
      alert('Por segurança, o Firebase pede um login recente pra apagar a conta.\n\nSaia, entre de novo e repita.');
    } else {
      alert('Erro ao excluir: ' + error.message);
    }
  });
}

function salvarPerfilCliente() {
  if (!auth.currentUser) return;
  const nome = document.getElementById('perfil-nome').value.trim();
  const whatsapp = document.getElementById('perfil-whatsapp').value.trim().replace(/\D/g, '');
  const endereco = lerCamposDoPerfil();
  const msgEl = document.getElementById('perfil-msg');
  const paraGravar = Object.assign({ nome: nome, whatsapp: whatsapp }, endereco);
  db.collection('clientes').doc(auth.currentUser.uid).set(paraGravar, { merge: true }).then(function() {
    CLIENTE_ATUAL = Object.assign({}, CLIENTE_ATUAL, paraGravar);
    msgEl.textContent = 'Salvo!';
    // Fecha sozinho depois de mostrar o aviso: ele ja viu que deu certo
    // e nao precisa procurar o X pra sair.
    setTimeout(function() {
      msgEl.textContent = '';
      fecharModalConta();
    }, 900);
  }).catch(function(error) {
    alert('Erro ao salvar: ' + error.message);
  });
}

if (!auth) {
  // Sem modulo de autenticacao: esconde a area de conta de cliente e
  // segue a vida. A loja funciona do mesmo jeito.
  const botaoConta = document.getElementById('btn-minha-conta');
  if (botaoConta) botaoConta.style.display = 'none';
} else {
auth.onAuthStateChanged(function(user) {
  const visitante = document.getElementById('conta-visitante');
  const logado = document.getElementById('conta-logado');
  if (user) {
    db.collection('clientes').doc(user.uid).get().then(function(doc) {
      const data = doc.exists ? doc.data() : {};
      CLIENTE_ATUAL = Object.assign(
        { uid: user.uid, nome: data.nome || '', whatsapp: data.whatsapp || '', email: user.email },
        data
      );
      CLIENTE_ATUAL.uid = user.uid;
      CLIENTE_ATUAL.email = user.email;
      const campoEmail = document.getElementById('perfil-email');
      if (campoEmail) campoEmail.textContent = user.email || '—';
      document.getElementById('perfil-nome').value = CLIENTE_ATUAL.nome || '';
      document.getElementById('perfil-whatsapp').value = CLIENTE_ATUAL.whatsapp || '';
      CAMPOS_ENDERECO.forEach(function(campo) {
        const el = document.getElementById('perfil-' + campo);
        if (el) el.value = data[campo] || '';
      });
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
}

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
  const buscaProdutos = db.collection('produtos').get();
  const tempoLimite = new Promise(function(resolve, reject) {
    setTimeout(function() { reject({ code: 'tempo-esgotado', message: 'A busca no banco de dados não respondeu em 15 segundos.' }); }, 15000);
  });

  Promise.race([buscaProdutos, tempoLimite]).then(function(snapshot) {
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

      // A vitrine usa a versao leve da foto. A original pode ter varios
      // MB e deixa o quadrado preto por segundos no celular do cliente.
      // No pedido do WhatsApp vai a original, que e a que o Juliano quer
      // ver de perto.
      const fotoNaVitrine = data.fotoThumb || data.foto;
      const fotoReserva = (data.fotoThumb && data.foto && data.foto !== data.fotoThumb) ? data.foto : '';
      const imagemHtml = fotoNaVitrine
        ? `<img src="${escapeHtml(fotoNaVitrine)}" data-reserva="${escapeHtml(fotoReserva)}" alt="${escapeHtml(data.nome || '')}" class="produto-img" loading="lazy" decoding="async" onload="this.classList.add('carregada')" onerror="onFotoProdutoErro(this)">`
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

      // Se a foto ja estava no cache, o aviso de "carregou" pode nao
      // disparar — e sem ele a imagem ficaria invisivel. Confere na mao.
      const imgEl = card.querySelector('.produto-img');
      if (imgEl && imgEl.complete) imgEl.classList.add('carregada');
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

try {
  atualizarBadgeCarrinho();
} catch (e) {
  document.getElementById('produtos-lista').innerHTML = '<p class="loading-msg">Erro técnico (carrinho): ' + e.message + '</p>';
}

// Carrega configurações da loja de verdade (com fallback seguro), depois os produtos
db.collection('config').doc('site').get().then(function(doc) {
  const config = doc.exists ? doc.data() : {};
  let whatsapp;
  try {
    whatsapp = aplicarConfiguracoes(config);
  } catch (e) {
    document.getElementById('produtos-lista').innerHTML = '<p class="loading-msg">Erro técnico (configurações): ' + e.message + '</p>';
    return;
  }
  try { localStorage.setItem(CACHE_CONFIG_CHAVE, JSON.stringify(config)); } catch (e) {}
  carregarProdutos(whatsapp);
}).catch(function(erroFirestore) {
  document.getElementById('produtos-lista').innerHTML = '<p class="loading-msg">Erro ao buscar configurações: [' + (erroFirestore.code || '?') + '] ' + erroFirestore.message + '</p>';
});
