//<!-- ====== INICIO DO BANCO DE DADOS =====--!>
class Database {
  constructor() { this.db = null; }

  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('BibliotecaVirtualDB', 1);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('monitores')) {
          const m = db.createObjectStore('monitores', { keyPath: 'id', autoIncrement: true });
          m.createIndex('email', 'email', { unique: true });
        }
        if (!db.objectStoreNames.contains('alunos')) {
          const a = db.createObjectStore('alunos', { keyPath: 'id', autoIncrement: true });
          a.createIndex('matricula', 'matricula', { unique: true });
          a.createIndex('nome', 'nome', { unique: false });
        }
        if (!db.objectStoreNames.contains('editoras')) {
          const ed = db.createObjectStore('editoras', { keyPath: 'id', autoIncrement: true });
          ed.createIndex('cnpj', 'cnpj', { unique: true });
        }
        if (!db.objectStoreNames.contains('livros')) {
          const l = db.createObjectStore('livros', { keyPath: 'id', autoIncrement: true });
          l.createIndex('genero', 'genero', { unique: false });
        }
        if (!db.objectStoreNames.contains('reservas')) {
          const r = db.createObjectStore('reservas', { keyPath: 'id', autoIncrement: true });
          r.createIndex('alunoId', 'alunoId', { unique: false });
          r.createIndex('livroId', 'livroId', { unique: false });
        }
      };

      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  _tx(store, mode = 'readonly') {
    return this.db.transaction(store, mode).objectStore(store);
  }

  add(store, data) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readwrite').add(data);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
  put(store, data) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readwrite').put(data);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
  get(store, id) {
    return new Promise((res, rej) => {
      const r = this._tx(store).get(id);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
  getAll(store) {
    return new Promise((res, rej) => {
      const r = this._tx(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
  delete(store, id) {
    return new Promise((res, rej) => {
      const r = this._tx(store, 'readwrite').delete(id);
      r.onsuccess = () => res();
      r.onerror   = () => rej(r.error);
    });
  }
  getByIndex(store, idx, val) {
    return new Promise((res, rej) => {
      const r = this._tx(store).index(idx).getAll(val);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
  getOneByIndex(store, idx, val) {
    return new Promise((res, rej) => {
      const r = this._tx(store).index(idx).get(val);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
}

// ──────────────────────────────────────────────────────────────
// 2. NAVEGAÇÃO (substitui o sistema de âncoras que travava)
// ──────────────────────────────────────────────────────────────
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = 'none';
  });
  const target = document.getElementById(pageId);
  if (target) {
    target.style.display = 'block';
    window.scrollTo(0, 0);
  }
  // Fecha sidebar
  document.getElementById('menu').style.left = '-280px';
  document.querySelector('.sidebar-overlay').style.display = 'none';

  // Dispara render da página
  PAGE_RENDERERS[pageId]?.();
}

// Páginas que exigem login — qualquer página que não seja login/cadastro de conta
const PAGINAS_PUBLICAS = new Set(['login', 'cadastro', 'cadastro-aluno', 'cadastro-monitor']);

function requireAuth(pageId) {
  if (PAGINAS_PUBLICAS.has(pageId)) return true; // pública, ok
  if (auth.isLoggedIn()) return true;             // logado, ok
  showToast('Faça login para continuar.', 'error');
  navigate('login');
  return false;
}

// Intercepta TODOS os links de âncora do HTML original
function hijackLinks() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const target = a.getAttribute('href').replace('#', '');
    if (!target || target === 'menu') return; // sidebar tratado separado

    if (!requireAuth(target)) return;
    navigate(target);
  });

  // Bloqueia acesso direto pelo hash da URL (ex: digitar #dashboard na barra)
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace('#', '');
    if (hash && !requireAuth(hash)) {
      history.replaceState(null, '', ' '); // limpa o hash da URL
    }
  });
}

// Sidebar toggle via âncora #menu
function wireSidebar() {
  document.querySelectorAll('a[href="#menu"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      // Se não estiver logado, verifica se já existe algum monitor cadastrado
      if (!auth.isLoggedIn()) {
        const monitores = await DB.getAll('monitores');
        if (!monitores.length) {
          // Nenhuma conta criada ainda → vai para cadastro
          showToast('Crie uma conta primeiro.', 'warning');
          navigate('cadastro');
        } else {
          // Já existe conta mas não está logado → vai para login
          showToast('Faça login para acessar o menu.', 'error');
          navigate('login');
        }
        return; // não abre o sidebar
      }

      // Logado → abre normalmente
      document.getElementById('menu').style.left = '0';
      document.querySelector('.sidebar-overlay').style.display = 'block';
    });
  });
  document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('menu').style.left = '-280px';
    document.querySelector('.sidebar-overlay').style.display = 'none';
  });
  document.querySelector('.close-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('menu').style.left = '-280px';
    document.querySelector('.sidebar-overlay').style.display = 'none';
  });
}

// ──────────────────────────────────────────────────────────────
// 3. UI HELPERS
// ──────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  document.querySelector('.bv-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'bv-toast';
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
    padding:13px 28px;border-radius:30px;font-size:14px;font-weight:600;
    z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.2);color:white;
    background:${type==='error'?'#8b0000':type==='warning'?'#7a5a00':'#2d5a2d'};
    animation:bvFadeUp .3s ease;white-space:nowrap;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// Injeta keyframe uma vez
const style = document.createElement('style');
style.textContent = `
  @keyframes bvFadeUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  .bv-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;}
  .bv-modal{background:#d4e4d4;border-radius:20px;padding:30px;max-width:560px;width:100%;position:relative;max-height:90vh;overflow-y:auto;}
  .bv-modal h2{color:#2d5a2d;font-family:Georgia,serif;margin-bottom:20px;}
  .bv-modal p{margin-bottom:8px;color:#333;}
  .bv-modal-close{position:absolute;top:14px;right:18px;background:none;border:none;font-size:26px;cursor:pointer;color:#2d5a2d;line-height:1;}
  .bv-field{margin-bottom:14px;}
  .bv-field label{display:block;font-weight:600;color:#2d5a2d;margin-bottom:6px;font-size:13px;text-transform:lowercase;}
  .bv-field input,.bv-field select,.bv-field textarea{width:100%;padding:10px 14px;border:none;border-radius:8px;background:#2d5a2d;color:white;font-size:14px;}
  .bv-field textarea{resize:vertical;}
  .bv-field select option{background:#2d5a2d;color:white;}
  .bv-actions{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;}
  .bv-stat{display:inline-block;padding:8px 18px;background:#2d5a2d;color:white;border-radius:20px;font-size:13px;font-weight:600;margin:4px;}
`;
document.head.appendChild(style);

function openModal(html) {
  document.querySelector('.bv-modal-overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'bv-modal-overlay';
  ov.innerHTML = `<div class="bv-modal"><button class="bv-modal-close">&times;</button>${html}</div>`;
  document.body.appendChild(ov);
  ov.querySelector('.bv-modal-close').onclick = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  return ov;
}

async function confirmDialog(msg) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'bv-modal-overlay';
    ov.innerHTML = `
      <div class="bv-modal" style="max-width:340px;text-align:center;">
        <p style="font-size:15px;font-weight:600;color:#2d5a2d;margin-bottom:24px;">${msg}</p>
        <div class="bv-actions" style="justify-content:center;">
          <button id="bv-yes" class="btn btn-danger">Confirmar</button>
          <button id="bv-no"  class="btn btn-success">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#bv-yes').onclick = () => { ov.remove(); resolve(true); };
    ov.querySelector('#bv-no').onclick  = () => { ov.remove(); resolve(false); };
  });
}

function fmtDate(s) {
  if (!s) return '—';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}
function fmtCNPJ(c='') {
  const d = c.replace(/\D/g,'');
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5') || c;
}

// Lê campo pelo seletor
function v(sel) { return (document.querySelector(sel)?.value || '').trim(); }

// ──────────────────────────────────────────────────────────────
// 4. AUTH
// ──────────────────────────────────────────────────────────────
const auth = {
  user: JSON.parse(sessionStorage.getItem('bv_user') || 'null'),

  async login(email, senha) {
    if (!email || !senha) throw new Error('Preencha e-mail e senha.');
    const mon = await DB.getOneByIndex('monitores', 'email', email.toLowerCase().trim());
    if (!mon) throw new Error('E-mail não cadastrado.');
    if (mon.senha !== btoa(senha)) throw new Error('Senha incorreta.');
    this.user = { id: mon.id, nome: mon.nome, email: mon.email };
    sessionStorage.setItem('bv_user', JSON.stringify(this.user));
  },

  logout() {
    this.user = null;
    sessionStorage.removeItem('bv_user');
    navigate('login');
  },

  isLoggedIn() { return !!this.user; }
};

// ──────────────────────────────────────────────────────────────
// 5. SERVICES
// ──────────────────────────────────────────────────────────────

const MonitorSvc = {
  async cadastrar({ email, nome, senha, matricula }) {
    if (!email||!nome||!senha||!matricula) throw new Error('Preencha todos os campos.');
    const existe = await DB.getOneByIndex('monitores','email',email.toLowerCase().trim());
    if (existe) throw new Error('E-mail já cadastrado.');
    return DB.add('monitores', { email:email.toLowerCase().trim(), nome, senha:btoa(senha), matricula });
  }
};

const AlunoSvc = {
  async cadastrar({ nome, turma, telefone, ano, matricula, endereco, curso }) {
    if (!nome||!matricula) throw new Error('Nome e matrícula são obrigatórios.');
    const existe = await DB.getOneByIndex('alunos','matricula',matricula.trim());
    if (existe) throw new Error('Matrícula já cadastrada.');
    return DB.add('alunos', { nome, turma, telefone, ano, matricula:matricula.trim(), endereco, curso });
  },
  listar()       { return DB.getAll('alunos'); },
  obter(id)      { return DB.get('alunos', id); },
  editar(a)      { return DB.put('alunos', a); },
  excluir(id)    { return DB.delete('alunos', id); },
  async buscar(t){ const all=await DB.getAll('alunos'); const q=t.toLowerCase(); return all.filter(a=>a.nome.toLowerCase().includes(q)||a.matricula.includes(q)); }
};

const EditoraSvc = {
  async cadastrar({ nome, nomeFantasia, cnpj, email }) {
    if (!nome||!cnpj) throw new Error('Nome e CNPJ são obrigatórios.');
    const raw = cnpj.replace(/\D/g,'');
    const existe = await DB.getOneByIndex('editoras','cnpj',raw);
    if (existe) throw new Error('CNPJ já cadastrado.');
    return DB.add('editoras', { nome, nomeFantasia, cnpj:raw, email });
  },
  listar()       { return DB.getAll('editoras'); },
  obter(id)      { return DB.get('editoras', id); },
  editar(e)      { return DB.put('editoras', e); },
  excluir(id)    { return DB.delete('editoras', id); },
  async buscar(t){ const all=await DB.getAll('editoras'); const q=t.toLowerCase(); return all.filter(e=>e.nome.toLowerCase().includes(q)||(e.nomeFantasia||'').toLowerCase().includes(q)); }
};

const LivroSvc = {
  async cadastrar({ nome, autor, ano, genero, edicao, editora, sinopse }) {
    if (!nome||!autor) throw new Error('Nome e autor são obrigatórios.');
    return DB.add('livros', { nome, autor, ano, genero:genero||'Geral', edicao, editora, sinopse, disponivel:true });
  },
  listar()            { return DB.getAll('livros'); },
  obter(id)           { return DB.get('livros', id); },
  editar(l)           { return DB.put('livros', l); },
  excluir(id)         { return DB.delete('livros', id); },
  listarPorGenero(g)  { return DB.getByIndex('livros','genero',g); },
  async buscar(t)     { const all=await DB.getAll('livros'); const q=t.toLowerCase(); return all.filter(l=>l.nome.toLowerCase().includes(q)||l.autor.toLowerCase().includes(q)); },
  async setDisponivel(id,val){ const l=await DB.get('livros',id); if(l){ l.disponivel=val; await DB.put('livros',l); } }
};

const ReservaSvc = {
  async cadastrar({ alunoId, livroId, dataReserva, dataDevolucao }) {
    if (!alunoId||!livroId||!dataReserva||!dataDevolucao) throw new Error('Preencha todos os campos.');
    const livro = await LivroSvc.obter(Number(livroId));
    if (!livro) throw new Error('Livro não encontrado.');
    if (!livro.disponivel) throw new Error('Livro indisponível para reserva.');
    await LivroSvc.setDisponivel(Number(livroId), false);
    return DB.add('reservas', { alunoId:Number(alunoId), livroId:Number(livroId), dataReserva, dataDevolucao, situacao:'Pendente', criadoEm:new Date().toISOString() });
  },
  listar()    { return DB.getAll('reservas'); },
  obter(id)   { return DB.get('reservas', id); },
  excluir: async function(id) {
    const r = await DB.get('reservas', id);
    if (r && r.situacao==='Pendente') await LivroSvc.setDisponivel(r.livroId, true);
    return DB.delete('reservas', id);
  },
  atualizarSituacao: async function(id, situacao) {
    const r = await DB.get('reservas', id);
    if (!r) throw new Error('Reserva não encontrada.');
    if (situacao==='Devolvido') await LivroSvc.setDisponivel(r.livroId, true);
    r.situacao = situacao;
    return DB.put('reservas', r);
  },
  async listarEnriquecido() {
    const [reservas, alunos, livros] = await Promise.all([DB.getAll('reservas'), DB.getAll('alunos'), DB.getAll('livros')]);
    return reservas.map(r => ({ ...r, aluno:alunos.find(a=>a.id===r.alunoId)||{}, livro:livros.find(l=>l.id===r.livroId)||{} }));
  },
  async buscar(t) {
    const lista = await this.listarEnriquecido();
    const q = t.toLowerCase();
    return lista.filter(r=>(r.aluno?.nome||'').toLowerCase().includes(q)||(r.livro?.nome||'').toLowerCase().includes(q));
  }
};

// ──────────────────────────────────────────────────────────────
// 6. RENDERS DE PÁGINA
// ──────────────────────────────────────────────────────────────

async function renderDashboard() {
  // Atualiza nome do usuário nos painéis
  document.querySelectorAll('.user-name').forEach(el => el.textContent = auth.user?.nome || '');

  const [alunos, livros, reservas] = await Promise.all([AlunoSvc.listar(), LivroSvc.listar(), ReservaSvc.listar()]);
  const pendentes   = reservas.filter(r=>r.situacao==='Pendente').length;
  const disponiveis = livros.filter(l=>l.disponivel).length;

  // Injeta estatísticas na search-box do dashboard
  const box = document.querySelector('#dashboard .search-box');
  if (box) {
    let statsEl = document.getElementById('bv-dash-stats');
    if (!statsEl) {
      statsEl = document.createElement('div');
      statsEl.id = 'bv-dash-stats';
      statsEl.style.marginTop = '12px';
      box.appendChild(statsEl);
    }
    statsEl.innerHTML = `
      <span class="bv-stat">📚 ${livros.length} livros</span>
      <span class="bv-stat">✅ ${disponiveis} disponíveis</span>
      <span class="bv-stat">⏳ ${pendentes} pendentes</span>
      <span class="bv-stat">👤 ${alunos.length} alunos</span>
    `;
  }
}

async function renderAlunos() {
  const searchEl = document.querySelector('#usuarios .search-bar input');
  const termo    = searchEl?.value || '';
  const lista    = termo ? await AlunoSvc.buscar(termo) : await AlunoSvc.listar();
  const container = document.querySelector('#usuarios .card-list');
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = '<p style="color:#666;padding:20px 0;">Nenhum aluno encontrado.</p>';
    return;
  }
  container.innerHTML = lista.map(a => `
    <div class="card">
      <div class="card-avatar"></div>
      <div class="card-content">
        <p class="card-name"><strong>Nome:</strong> ${a.nome}</p>
        <p class="card-info"><strong>Turma:</strong> ${a.turma||'—'} &nbsp;|&nbsp; <strong>Curso:</strong> ${a.curso||'—'}</p>
        <p class="card-info"><strong>Matrícula:</strong> ${a.matricula}</p>
      </div>
      <div class="card-actions">
        <button class="card-btn card-btn-primary" onclick="BV.verAluno(${a.id})">Ver mais</button>
      </div>
    </div>`).join('');
}

window.BV = {};

BV.verAluno = async function(id) {
  const a = await AlunoSvc.obter(id);
  if (!a) return;
  openModal(`
    <h2>Detalhes do Aluno</h2>
    <p><strong>Nome:</strong> ${a.nome}</p>
    <p><strong>Turma:</strong> ${a.turma||'—'}</p>
    <p><strong>Curso:</strong> ${a.curso||'—'}</p>
    <p><strong>Ano:</strong> ${a.ano||'—'}</p>
    <p><strong>Matrícula:</strong> ${a.matricula}</p>
    <p><strong>Telefone:</strong> ${a.telefone||'—'}</p>
    <p><strong>Endereço:</strong> ${a.endereco||'—'}</p>
    <div class="bv-actions">
      <button onclick="BV.editarAluno(${a.id})" class="btn btn-success">Editar</button>
      <button onclick="BV.excluirAluno(${a.id},'${a.nome.replace(/'/g,"\\'")}')" class="btn btn-danger">Excluir</button>
    </div>`);
};

BV.excluirAluno = async function(id, nome) {
  const ok = await confirmDialog(`Excluir o aluno "<strong>${nome}</strong>"?`);
  if (!ok) return;
  await AlunoSvc.excluir(id);
  document.querySelector('.bv-modal-overlay')?.remove();
  showToast('Aluno excluído.');
  renderAlunos();
};

BV.editarAluno = async function(id) {
  const a = await AlunoSvc.obter(id);
  document.querySelector('.bv-modal-overlay')?.remove();
  openModal(`
    <h2>Editar Aluno</h2>
    <div class="bv-field"><label>nome</label><input id="ea-nome" value="${a.nome||''}"></div>
    <div class="bv-field"><label>turma</label><input id="ea-turma" value="${a.turma||''}"></div>
    <div class="bv-field"><label>telefone</label><input id="ea-tel" value="${a.telefone||''}"></div>
    <div class="bv-field"><label>ano</label><input id="ea-ano" value="${a.ano||''}"></div>
    <div class="bv-field"><label>matrícula</label><input id="ea-mat" value="${a.matricula||''}"></div>
    <div class="bv-field"><label>endereço</label><input id="ea-end" value="${a.endereco||''}"></div>
    <div class="bv-field"><label>curso</label><input id="ea-curso" value="${a.curso||''}"></div>
    <div class="bv-actions">
      <button onclick="BV.salvarAluno(${id})" class="btn btn-success">Salvar</button>
    </div>`);
};

BV.salvarAluno = async function(id) {
  try {
    await AlunoSvc.editar({ id,
      nome: document.getElementById('ea-nome').value,
      turma: document.getElementById('ea-turma').value,
      telefone: document.getElementById('ea-tel').value,
      ano: document.getElementById('ea-ano').value,
      matricula: document.getElementById('ea-mat').value,
      endereco: document.getElementById('ea-end').value,
      curso: document.getElementById('ea-curso').value
    });
    document.querySelector('.bv-modal-overlay')?.remove();
    showToast('Aluno atualizado!');
    renderAlunos();
  } catch(e) { showToast(e.message,'error'); }
};

// ── LIVROS ──
async function renderLivros() {
  const searchEl = document.querySelector('#livros-romance .search-bar input');
  const termo    = searchEl?.value || '';
  const lista    = termo ? await LivroSvc.buscar(termo) : await LivroSvc.listar();

  // Render na página livros-romance (lista de livros)
  const container = document.querySelector('#livros-romance .page-content');
  if (!container) return;

  // Remove lista anterior dinâmica
  container.querySelectorAll('.bv-book-card').forEach(el => el.remove());

  lista.forEach(l => {
    const div = document.createElement('div');
    div.className = 'book-card bv-book-card';
    div.innerHTML = `
      <div style="width:90px;height:130px;background:linear-gradient(135deg,#1a3a1a,#2d5a2d);border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.7);font-size:11px;text-align:center;padding:8px;">${l.nome}</div>
      <div class="book-info">
        <p class="book-title"><strong>Nome:</strong> ${l.nome}</p>
        <p class="book-author"><strong>Autor:</strong> ${l.autor}</p>
        <p class="book-author"><strong>Gênero:</strong> ${l.genero||'—'}</p>
        <p class="book-status"><strong>Situação:</strong>
          <span style="color:${l.disponivel?'#2d5a2d':'#8b0000'};font-weight:700;">
            ${l.disponivel?'disponível':'reservado'}
          </span>
        </p>
        <div class="book-actions" style="flex-direction:row;flex-wrap:wrap;">
          <button class="card-btn card-btn-secondary">Reservar</button>
          <button class="card-btn card-btn-primary" onclick="BV.verLivro(${l.id})">Ver mais</button>
        </div>
      </div>`;

    // Botão reservar abre navegação
    div.querySelector('.card-btn-secondary').onclick = () => {
      populateReservaSelects(l.id);
      navigate('cadastrar-reserva');
    };
    container.appendChild(div);
  });

  // Esconde o card de exemplo estático original se houver dados reais
  const staticCard = container.querySelector('.book-card:not(.bv-book-card)');
  if (staticCard) staticCard.style.display = lista.length ? 'none' : 'flex';
}

BV.verLivro = async function(id) {
  const l = await LivroSvc.obter(id);
  if (!l) return;
  openModal(`
    <h2>Detalhes do Livro</h2>
    <p><strong>Nome:</strong> ${l.nome}</p>
    <p><strong>Autor:</strong> ${l.autor}</p>
    <p><strong>Ano:</strong> ${l.ano||'—'}</p>
    <p><strong>Edição:</strong> ${l.edicao||'—'}</p>
    <p><strong>Gênero:</strong> ${l.genero||'—'}</p>
    <p><strong>Editora:</strong> ${l.editora||'—'}</p>
    <p><strong>Situação:</strong> <span style="color:${l.disponivel?'#2d5a2d':'#8b0000'};font-weight:700;">${l.disponivel?'Disponível':'Reservado'}</span></p>
    <p><strong>Sinopse:</strong> ${l.sinopse||'—'}</p>
    <div class="bv-actions">
      <button onclick="BV.editarLivro(${l.id})" class="btn btn-success">Editar</button>
      <button onclick="BV.excluirLivro(${l.id},'${l.nome.replace(/'/g,"\\'")}')" class="btn btn-danger">Excluir</button>
    </div>`);
};

BV.excluirLivro = async function(id, nome) {
  const ok = await confirmDialog(`Excluir o livro "<strong>${nome}</strong>"?`);
  if (!ok) return;
  await LivroSvc.excluir(id);
  document.querySelector('.bv-modal-overlay')?.remove();
  showToast('Livro excluído.');
  renderLivros();
};

BV.editarLivro = async function(id) {
  const l = await LivroSvc.obter(id);
  document.querySelector('.bv-modal-overlay')?.remove();
  openModal(`
    <h2>Editar Livro</h2>
    <div class="bv-field"><label>nome</label><input id="el-nome" value="${l.nome||''}"></div>
    <div class="bv-field"><label>autor</label><input id="el-autor" value="${l.autor||''}"></div>
    <div class="bv-field"><label>ano</label><input id="el-ano" value="${l.ano||''}"></div>
    <div class="bv-field"><label>gênero</label><input id="el-genero" value="${l.genero||''}"></div>
    <div class="bv-field"><label>edição</label><input id="el-edicao" value="${l.edicao||''}"></div>
    <div class="bv-field"><label>editora</label><input id="el-editora" value="${l.editora||''}"></div>
    <div class="bv-field"><label>sinopse</label><textarea id="el-sinopse" rows="3">${l.sinopse||''}</textarea></div>
    <div class="bv-actions">
      <button onclick="BV.salvarLivro(${id})" class="btn btn-success">Salvar</button>
    </div>`);
};

BV.salvarLivro = async function(id) {
  try {
    const l = await LivroSvc.obter(id);
    await LivroSvc.editar({ ...l, id,
      nome:    document.getElementById('el-nome').value,
      autor:   document.getElementById('el-autor').value,
      ano:     document.getElementById('el-ano').value,
      genero:  document.getElementById('el-genero').value,
      edicao:  document.getElementById('el-edicao').value,
      editora: document.getElementById('el-editora').value,
      sinopse: document.getElementById('el-sinopse').value
    });
    document.querySelector('.bv-modal-overlay')?.remove();
    showToast('Livro atualizado!');
    renderLivros();
  } catch(e) { showToast(e.message,'error'); }
};

// ── EDITORAS ──
async function renderEditoras() {
  const searchEl = document.querySelector('#editoras .search-bar input');
  const termo    = searchEl?.value || '';
  const lista    = termo ? await EditoraSvc.buscar(termo) : await EditoraSvc.listar();
  const container = document.querySelector('#editoras .card-list');
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = '<p style="color:#666;padding:20px 0;">Nenhuma editora encontrada.</p>';
    return;
  }
  container.innerHTML = lista.map(e => `
    <div class="card">
      <div class="card-avatar" style="background:linear-gradient(135deg,#1a3a1a,#4a7a4a);display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:bold;">${e.nome.charAt(0)}</div>
      <div class="card-content">
        <p class="card-name">${e.nome}</p>
        <p class="card-info"><strong>Nome Fantasia:</strong> ${e.nomeFantasia||'—'}</p>
        <p class="card-info"><strong>CNPJ:</strong> ${fmtCNPJ(e.cnpj)}</p>
      </div>
      <div class="card-actions">
        <button class="card-btn card-btn-primary" onclick="BV.verEditora(${e.id})">Ver mais</button>
      </div>
    </div>`).join('');
}

BV.verEditora = async function(id) {
  const e = await EditoraSvc.obter(id);
  if (!e) return;
  openModal(`
    <h2>Detalhes da Editora</h2>
    <p><strong>Nome:</strong> ${e.nome}</p>
    <p><strong>Nome Fantasia:</strong> ${e.nomeFantasia||'—'}</p>
    <p><strong>CNPJ:</strong> ${fmtCNPJ(e.cnpj)}</p>
    <p><strong>E-mail:</strong> ${e.email||'—'}</p>
    <div class="bv-actions">
      <button onclick="BV.excluirEditora(${e.id},'${e.nome.replace(/'/g,"\\'")}')" class="btn btn-danger">Excluir</button>
    </div>`);
};

BV.excluirEditora = async function(id, nome) {
  const ok = await confirmDialog(`Excluir a editora "<strong>${nome}</strong>"?`);
  if (!ok) return;
  await EditoraSvc.excluir(id);
  document.querySelector('.bv-modal-overlay')?.remove();
  showToast('Editora excluída.');
  renderEditoras();
};

// ── RESERVAS ──
async function renderReservas() {
  const searchEl = document.querySelector('#reservas .search-bar input');
  const termo    = searchEl?.value || '';
  const lista    = termo ? await ReservaSvc.buscar(termo) : await ReservaSvc.listarEnriquecido();
  const container = document.querySelector('#reservas .card-list');
  if (!container) return;

  if (!lista.length) {
    container.innerHTML = '<p style="color:#666;padding:20px 0;">Nenhuma reserva encontrada.</p>';
    return;
  }
  container.innerHTML = lista.map(r => `
    <div class="card">
      <div class="card-avatar"></div>
      <div class="card-content">
        <p class="card-name"><strong>Nome:</strong> ${r.aluno?.nome||'—'}</p>
        <p class="card-info"><strong>Turma:</strong> ${r.aluno?.turma||'—'}</p>
        <p class="card-info"><strong>livro:</strong> ${r.livro?.nome||'—'}</p>
        <p class="card-info"><strong>data de reserva:</strong> ${fmtDate(r.dataReserva)}</p>
      </div>
      <div class="card-actions">
        <span style="font-size:14px;color:#666;">Situação</span>
        <span class="status-badge ${r.situacao==='Pendente'?'status-pending':'status-approved'}">${r.situacao}</span>
        <button class="card-btn card-btn-primary" onclick="BV.gerenciarReserva(${r.id})">Gerenciar</button>
      </div>
    </div>`).join('');
}

BV.gerenciarReserva = async function(id) {
  const lista = await ReservaSvc.listarEnriquecido();
  const r = lista.find(x=>x.id===id);
  if (!r) return;
  openModal(`
    <h2>Gerenciar Reserva</h2>
    <p><strong>Aluno:</strong> ${r.aluno?.nome||'—'}</p>
    <p><strong>Livro:</strong> ${r.livro?.nome||'—'}</p>
    <p><strong>Reserva:</strong> ${fmtDate(r.dataReserva)}</p>
    <p><strong>Devolução:</strong> ${fmtDate(r.dataDevolucao)}</p>
    <p><strong>Situação:</strong> <span style="font-weight:700;">${r.situacao}</span></p>
    <div class="bv-actions">
      ${r.situacao!=='Aprovado'   ? `<button onclick="BV.mudaSituacao(${id},'Aprovado')"  class="btn btn-success">Aprovar</button>`:''}
      ${r.situacao!=='Devolvido'  ? `<button onclick="BV.mudaSituacao(${id},'Devolvido')" class="btn btn-light">Devolvido</button>`:''}
      <button onclick="BV.excluirReserva(${id})" class="btn btn-danger">Excluir</button>
    </div>`);
};

BV.mudaSituacao = async function(id, situacao) {
  await ReservaSvc.atualizarSituacao(id, situacao);
  document.querySelector('.bv-modal-overlay')?.remove();
  showToast(`Situação: ${situacao}`);
  renderReservas();
};

BV.excluirReserva = async function(id) {
  const ok = await confirmDialog('Excluir esta reserva?');
  if (!ok) return;
  await ReservaSvc.excluir(id);
  document.querySelector('.bv-modal-overlay')?.remove();
  showToast('Reserva excluída.');
  renderReservas();
};

// ── POPULATE SELECTS de reserva ──
async function populateReservaSelects(preSelectLivroId = null) {
  const [alunos, livros] = await Promise.all([AlunoSvc.listar(), LivroSvc.listar()]);

  // Selects existentes no HTML (cadastrar-reserva)
  const selects = document.querySelectorAll('#cadastrar-reserva select');
  const [selAluno, selLivro] = selects;

  if (selAluno) {
    selAluno.innerHTML = '<option value="">Selecione um aluno</option>' +
      alunos.map(a=>`<option value="${a.id}">${a.nome} (${a.matricula})</option>`).join('');
  }
  if (selLivro) {
    selLivro.innerHTML = '<option value="">Selecione um livro</option>' +
      livros.map(l=>`<option value="${l.id}" ${!l.disponivel?'disabled':''} ${l.id===preSelectLivroId?'selected':''}>${l.nome} — ${l.autor}${l.disponivel?'':' (indisponível)'}</option>`).join('');
  }
}

// ──────────────────────────────────────────────────────────────
// 7. MAPA DE RENDERS POR PÁGINA
// ──────────────────────────────────────────────────────────────
const PAGE_RENDERERS = {
  dashboard:         () => renderDashboard(),
  usuarios:          () => renderAlunos(),
  'livros-romance':  () => renderLivros(),
  editoras:          () => renderEditoras(),
  reservas:          () => renderReservas(),
  'cadastrar-reserva': () => populateReservaSelects(),
};

// ──────────────────────────────────────────────────────────────
// 8. WIRING DOS FORMULÁRIOS (usa os inputs existentes no HTML)
// ──────────────────────────────────────────────────────────────
function wireLoginForm() {
  // O formulário de login está em #login
  const page = document.getElementById('login');
  const btn  = page.querySelector('.btn-dark'); // botão "Acessar"
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const inputs = page.querySelectorAll('input');
    const email  = inputs[0].value.trim();
    const senha  = inputs[1].value;
    try {
      await auth.login(email, senha);
      showToast(`Bem-vindo(a), ${auth.user.nome}!`);
      navigate('dashboard');
    } catch(err) { showToast(err.message, 'error'); }
  });

  // Enter nos inputs
  page.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', e => { if(e.key==='Enter') btn.click(); });
  });
}

function wireCadastroMonitor() {
  const page = document.getElementById('cadastro-monitor');
  const btn  = page.querySelector('.btn-success');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const inputs = page.querySelectorAll('input');
    try {
      await MonitorSvc.cadastrar({
        email:     inputs[0].value,
        nome:      inputs[1].value,
        senha:     inputs[2].value,
        matricula: inputs[3].value
      });
      // Limpa
      inputs.forEach(i=>i.value='');
      showToast('Monitor cadastrado! Faça login.');
      navigate('login');
    } catch(err) { showToast(err.message,'error'); }
  });
}

function wireCadastroAluno() {
  const page = document.getElementById('cadastro-aluno');
  const btn  = page.querySelector('.btn-success');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const inputs = page.querySelectorAll('input');
    try {
      await AlunoSvc.cadastrar({
        nome:      inputs[0].value,
        turma:     inputs[1].value,
        telefone:  inputs[2].value,
        ano:       inputs[3].value,
        matricula: inputs[4].value,
        endereco:  inputs[5].value,
        curso:     inputs[6].value
      });
      inputs.forEach(i=>i.value='');
      showToast('Aluno cadastrado!');
      navigate('usuarios');
    } catch(err) { showToast(err.message,'error'); }
  });
}

function wireCadastroLivro() {
  const page = document.getElementById('cadastrar-livro');
  const btn  = page.querySelector('.btn-success');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const inputs   = page.querySelectorAll('input');
    const textarea = page.querySelector('textarea');
    try {
      await LivroSvc.cadastrar({
        nome:    inputs[0].value,
        autor:   inputs[1].value,
        ano:     inputs[2].value,
        genero:  inputs[3].value,
        edicao:  inputs[4].value,
        editora: inputs[5].value,
        sinopse: textarea?.value || ''
      });
      inputs.forEach(i=>i.value='');
      if (textarea) textarea.value='';
      showToast('Livro cadastrado!');
      navigate('livros-romance');
    } catch(err) { showToast(err.message,'error'); }
  });
}

function wireCadastroEditora() {
  const page = document.getElementById('cadastrar-editora');
  const btn  = page.querySelector('.btn-success');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const inputs = page.querySelectorAll('input');
    try {
      await EditoraSvc.cadastrar({
        nome:         inputs[0].value,
        nomeFantasia: inputs[1].value,
        cnpj:         inputs[2].value,
        email:        inputs[3].value
      });
      inputs.forEach(i=>i.value='');
      showToast('Editora cadastrada!');
      navigate('editoras');
    } catch(err) { showToast(err.message,'error'); }
  });
}

function wireCadastroReserva() {
  const page = document.getElementById('cadastrar-reserva');
  const btn  = page.querySelector('.btn-success');
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const selects = page.querySelectorAll('select');
    const dates   = page.querySelectorAll('input[type="date"]');
    try {
      await ReservaSvc.cadastrar({
        alunoId:       selects[0]?.value,
        livroId:       selects[1]?.value,
        dataReserva:   dates[0]?.value,
        dataDevolucao: dates[1]?.value
      });
      selects.forEach(s=>s.selectedIndex=0);
      dates.forEach(d=>d.value='');
      showToast('Reserva cadastrada!');
      navigate('reservas');
    } catch(err) { showToast(err.message,'error'); }
  });
}

function wireLogout() {
  document.querySelectorAll('.logout-link').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); auth.logout(); });
  });
}

function wireSearch() {
  document.querySelector('#usuarios .search-bar input')?.addEventListener('input', renderAlunos);
  document.querySelector('#livros-romance .search-bar input')?.addEventListener('input', renderLivros);
  document.querySelector('#editoras .search-bar input')?.addEventListener('input', renderEditoras);
  document.querySelector('#reservas .search-bar input')?.addEventListener('input', renderReservas);
}

function wireMinhaConta() {
  // Preenche dados da conta logada na página minha-conta
  const page = document.getElementById('minha-conta');
  if (!page) return;
  const observer = new MutationObserver(() => {
    if (page.style.display === 'block' && auth.user) {
      const ps = page.querySelectorAll('.detail-info p');
      if (ps[0]) ps[0].innerHTML = `<strong>Nome:</strong> ${auth.user.nome}`;
      if (ps[1]) ps[1].innerHTML = `<strong>E-mail:</strong> ${auth.user.email}`;
    }
  });
  observer.observe(page, { attributes: true, attributeFilter: ['style'] });
}

// ──────────────────────────────────────────────────────────────
// 9. SEED DATA
// ──────────────────────────────────────────────────────────────
async function seedIfEmpty() {
  const monitores = await DB.getAll('monitores');
  if (!monitores.length) {
    await MonitorSvc.cadastrar({ email:'admin@biblioteca.com', nome:'Juliana Satiro', senha:'1234', matricula:'001' });
    console.log('%c[SEED] Login padrão: admin@biblioteca.com / 1234','color:#2d5a2d;font-weight:bold');
  }
  const livros = await LivroSvc.listar();
  if (!livros.length) {
    await LivroSvc.cadastrar({ nome:'Melhor do que nos filmes', autor:'Lynn Painter', ano:'2021', genero:'Romance', edicao:'1ª', editora:'Intrínseca', sinopse:'Uma história de amor entre vizinhos improvável e divertida.' });
    await LivroSvc.cadastrar({ nome:'É assim que acaba', autor:'Colleen Hoover', ano:'2022', genero:'Romance', edicao:'1ª', editora:'Galera', sinopse:'Uma história sobre relacionamentos e cura.' });
    await LivroSvc.cadastrar({ nome:'A Hora da Estrela', autor:'Clarice Lispector', ano:'1977', genero:'Literários', edicao:'3ª', editora:'Rocco', sinopse:'A tragédia de Macabéa, nordestina no Rio de Janeiro.' });
    await LivroSvc.cadastrar({ nome:'Sherlock Holmes', autor:'Arthur Conan Doyle', ano:'1887', genero:'Mistério', edicao:'5ª', editora:'Zahar', sinopse:'As aventuras do mais famoso detetive da literatura.' });
    console.log('%c[SEED] Livros de exemplo inseridos.','color:#2d5a2d');
  }
}

// ──────────────────────────────────────────────────────────────
// 10. BOOT
// ──────────────────────────────────────────────────────────────
let DB;

async function boot() {
  DB = new Database();
  await DB.open();

  await seedIfEmpty();

  // Fix CSS: garante que o sistema de páginas funciona via JS e não via :target
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');

  // Wiring
  hijackLinks();
  wireSidebar();
  wireLoginForm();
  wireCadastroMonitor();
  wireCadastroAluno();
  wireCadastroLivro();
  wireCadastroEditora();
  wireCadastroReserva();
  wireLogout();
  wireSearch();
  wireMinhaConta();

  // Valida sessão contra o banco (evita sessionStorage adulterado)
  if (auth.isLoggedIn()) {
    const userNoDb = await DB.get('monitores', auth.user.id);
    if (!userNoDb) {
      auth.user = null;
      sessionStorage.removeItem('bv_user');
      navigate('login');
    } else {
      navigate('dashboard');
    }
  } else {
    navigate('login');
  }

  console.log('%c[BIBLIOTECA VIRTUAL] Backend iniciado ✓','color:#2d5a2d;font-weight:bold;font-size:14px');
}

document.addEventListener('DOMContentLoaded', boot);