// ===== CONFIGURAÇÃO DO IMGBB (upload automático de fotos) =====
// Reaproveitando a mesma chave já usada no site institucional.
const IMGBB_API_KEY = '61956ffcfe2f0d78692db113027c5319';

function uploadImagemImgBB(arquivo) {
  return new Promise(function(resolve, reject) {
    if (!arquivo) { reject('Nenhum arquivo selecionado.'); return; }
    if (!IMGBB_API_KEY) {
      reject('Chave do ImgBB não configurada.');
      return;
    }
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
    erroEl.textContent = 'E-mail ou senha incorretos.';
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

// ----- PRODUTOS -----
function carregarProdutos() {
  db.collection('produtos').get().then(function(snapshot) {
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
      alert('Erro ao adicionar: ' + error.message);
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
