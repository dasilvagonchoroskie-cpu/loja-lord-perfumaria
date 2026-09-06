// ===== CONFIGURAÇÃO DO IMGBB (upload automático de fotos) =====
const IMGBB_API_KEY = 'c5f5341bea7eb7169bd38071a172a59f';

function uploadImagemImgBB(arquivo) {
  return new Promise(function(resolve, reject) {
    if (!arquivo) { reject('Nenhum arquivo selecionado.'); return; }
    const formData = new FormData();
    formData.append('image', arquivo);
    fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_API_KEY, {
      method: 'POST',
      body: formData
    })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.success) {
          resolve({ url: data.data.url, deleteUrl: data.data.delete_url || '' });
        } else {
          reject((data && data.error && data.error.message) || 'Erro ao enviar imagem.');
        }
      })
      .catch(function(err) { reject(err.message || 'Erro de conexão ao enviar imagem.'); });
  });
}

function tentarApagarDoImgBB(deleteUrl) {
  if (!deleteUrl) return;
  fetch(deleteUrl, { mode: 'no-cors' }).catch(function() {});
}

// ----- LOGIN -----
auth.onAuthStateChanged(function(user) {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('painel').style.display = 'block';
    carregarProdutos();
    carregarConfiguracoes();
  } else {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('painel').style.display = 'none';
  }
});

function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';

  auth.signInWithEmailAndPassword(email, senha).catch(function(error) {
    erroEl.textContent = 'Erro (' + error.code + '): ' + error.message;
    console.error(error);
  });
}

function sair() {
  auth.signOut();
}

function trocarSenha() {
  const novaSenha = prompt('Digite sua nova senha (mínimo 6 caracteres):');
  if (!novaSenha) return;
  auth.currentUser.updatePassword(novaSenha).then(function() {
    document.getElementById('senha-msg').textContent = 'Senha alterada com sucesso!';
  }).catch(function(error) {
    alert('Erro ao trocar senha: ' + error.message + '\n\nPode ser necessário sair e entrar de novo antes de trocar a senha.');
  });
}

// ----- CONFIGURAÇÕES DA LOJA (e-mail, WhatsApp, textos da home, banner) -----
const CONFIG_DOC = db.collection('config').doc('site');

function carregarConfiguracoes() {
  CONFIG_DOC.get().then(function(doc) {
    const data = doc.exists ? doc.data() : {};
    document.getElementById('config-email').value = data.email || '';
    document.getElementById('config-whatsapp').value = data.whatsapp || '';
    document.getElementById('config-hero-titulo').value = data.heroTitulo || '';
    document.getElementById('config-hero-descricao').value = data.heroDescricao || '';
    mostrarPreviewBanner(data.bannerUrl || '');
  }).catch(function(error) {
    console.error('Erro ao carregar configurações:', error);
  });
}

function mostrarPreviewBanner(url) {
  const wrap = document.getElementById('banner-preview-wrap');
  wrap.innerHTML = url
    ? '<img src="' + url + '" style="max-width:100%;display:block;margin-bottom:10px;border:1px solid var(--border);">'
    : '<p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Nenhum banner definido ainda.</p>';
}

function salvarConfiguracoes() {
  const msgEl = document.getElementById('config-msg');
  const statusEl = document.getElementById('config-banner-status');
  const arquivoInput = document.getElementById('config-banner-foto');
  msgEl.textContent = '';

  const dadosBase = {
    email: document.getElementById('config-email').value.trim(),
    whatsapp: document.getElementById('config-whatsapp').value.trim().replace(/\D/g, ''),
    heroTitulo: document.getElementById('config-hero-titulo').value.trim(),
    heroDescricao: document.getElementById('config-hero-descricao').value.trim()
  };

  function salvar(dadosExtra) {
    CONFIG_DOC.set(Object.assign({}, dadosBase, dadosExtra || {}), { merge: true }).then(function() {
      msgEl.textContent = 'Configurações salvas!';
      carregarConfiguracoes();
    }).catch(function(error) {
      alert('Erro ao salvar configurações: [' + error.code + '] ' + error.message);
    });
  }

  const arquivo = arquivoInput.files[0];
  if (arquivo) {
    statusEl.textContent = 'Enviando banner...';
    uploadImagemImgBB(arquivo).then(function(resultado) {
      statusEl.textContent = 'Banner enviado!';
      arquivoInput.value = '';
      salvar({ bannerUrl: resultado.url, bannerDeleteUrl: resultado.deleteUrl });
    }).catch(function(erro) {
      statusEl.textContent = '';
      alert('Erro ao enviar o banner: ' + erro);
    });
  } else {
    salvar();
  }
}

function removerBanner() {
  if (!confirm('Remover o banner da página inicial?')) return;
  CONFIG_DOC.get().then(function(doc) {
    const data = doc.exists ? doc.data() : {};
    if (data.bannerDeleteUrl) tentarApagarDoImgBB(data.bannerDeleteUrl);
    return CONFIG_DOC.set({ bannerUrl: '', bannerDeleteUrl: '' }, { merge: true });
  }).then(function() {
    document.getElementById('config-msg').textContent = 'Banner removido.';
    carregarConfiguracoes();
  });
}

// ----- PRODUTOS -----
function mostrarAvisoTecnico(texto, tipo) {
  let aviso = document.getElementById('aviso-tecnico');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'aviso-tecnico';
    aviso.style.cssText = 'padding:10px 14px;margin-bottom:16px;white-space:pre-wrap;border:1px solid var(--border);';
    const lista = document.getElementById('lista-produtos');
    lista.parentNode.insertBefore(aviso, lista);
  }
  aviso.style.background = tipo === 'erro' ? 'var(--danger-bg)' : 'var(--success-bg)';
  aviso.style.color = tipo === 'erro' ? 'var(--danger)' : 'var(--success)';
  aviso.textContent = new Date().toLocaleTimeString('pt-BR') + ' — ' + texto;
}

function carregarProdutos() {
  db.collection('produtos').get().then(function(snapshot) {
    mostrarAvisoTecnico('Leitura OK. Documentos encontrados no banco: ' + snapshot.size, 'ok');
    const container = document.getElementById('lista-produtos');
    container.innerHTML = '';
    snapshot.forEach(function(doc) {
      const data = doc.data();
      const disponivel = data.disponivel !== false;
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div class="item-info">
          <strong>${escapeHtml(data.nome || '')} — R$ ${Number(data.preco || 0).toFixed(2).replace('.', ',')}</strong>
          <span>${escapeHtml(data.descricao || '')} ${disponivel ? '' : '(desativado)'}</span>
        </div>
        <div class="item-actions">
          <button class="admin-btn secondary" onclick="editarProduto('${doc.id}')">Editar</button>
          <button class="admin-btn secondary" onclick="alternarDisponibilidade('${doc.id}', ${disponivel})">${disponivel ? 'Desativar' : 'Ativar'}</button>
          <button class="admin-btn danger" onclick="apagarProduto('${doc.id}')">Apagar</button>
        </div>
      `;
      container.appendChild(row);
    });
  }).catch(function(error) {
    mostrarAvisoTecnico('ERRO AO LER: [' + error.code + '] ' + error.message, 'erro');
  });
}

function adicionarProduto() {
  const nome = document.getElementById('novo-produto-nome').value.trim();
  const descricao = document.getElementById('novo-produto-descricao').value.trim();
  const preco = parseFloat(document.getElementById('novo-produto-preco').value.replace(',', '.')) || 0;
  const arquivoInput = document.getElementById('novo-produto-foto');
  const statusEl = document.getElementById('novo-produto-foto-status');

  if (!nome) { alert('Preencha o nome do perfume.'); return; }

  function salvar(fotoUrl, deleteUrl) {
    db.collection('produtos').add({
      nome, descricao, preco,
      foto: fotoUrl || '',
      fotoDeleteUrl: deleteUrl || '',
      disponivel: true
    }).then(function() {
      document.getElementById('novo-produto-nome').value = '';
      document.getElementById('novo-produto-descricao').value = '';
      document.getElementById('novo-produto-preco').value = '';
      arquivoInput.value = '';
      statusEl.textContent = '';
      carregarProdutos();
    }).catch(function(error) {
      alert('Erro ao adicionar: [' + error.code + '] ' + error.message);
    });
  }

  const arquivo = arquivoInput.files[0];
  if (arquivo) {
    statusEl.textContent = 'Enviando foto...';
    uploadImagemImgBB(arquivo).then(function(resultado) {
      statusEl.textContent = 'Foto enviada!';
      salvar(resultado.url, resultado.deleteUrl);
    }).catch(function(erro) {
      statusEl.textContent = '';
      alert('Erro ao enviar a foto: ' + erro);
    });
  } else {
    salvar('', '');
  }
}

function editarProduto(id) {
  db.collection('produtos').doc(id).get().then(function(doc) {
    const data = doc.data();
    const novoNome = prompt('Nome:', data.nome);
    if (novoNome === null) return;
    const novaDescricao = prompt('Descrição:', data.descricao);
    if (novaDescricao === null) return;
    const novoPreco = prompt('Preço (ex: 189.90):', data.preco);
    if (novoPreco === null) return;

    db.collection('produtos').doc(id).update({
      nome: novoNome,
      descricao: novaDescricao,
      preco: parseFloat(String(novoPreco).replace(',', '.')) || 0
    }).then(carregarProdutos);
  });
}

function alternarDisponibilidade(id, disponivelAtual) {
  db.collection('produtos').doc(id).update({ disponivel: !disponivelAtual }).then(carregarProdutos);
}

function apagarProduto(id) {
  if (!confirm('Tem certeza que quer apagar este produto?')) return;
  db.collection('produtos').doc(id).get().then(function(doc) {
    const data = doc.data();
    if (data && data.fotoDeleteUrl) {
      tentarApagarDoImgBB(data.fotoDeleteUrl);
    }
    return db.collection('produtos').doc(id).delete();
  }).then(carregarProdutos);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
