/**
 * App Kiton Campo | Ponte entre a tela do app e a planilha "App Kiton Campo | Base de Dados".
 * Publicar como App da Web: Executar como "Eu", Acesso "Qualquer pessoa".
 * Fase 1: login, saída, retorno, conferência, fechamento do mês.
 */

const PIN_PADRAO = '123456';
const VALIDADE_SESSAO_DIAS = 90;
const TZ = 'America/Sao_Paulo';
const TOLERANCIA_MIN = 15; // lançamento feito mais de 15 min depois do horário informado = lançamento tardio

const ABA = {
  itens: 'Itens',
  colab: 'Colaboradores',
  clientes: 'Clientes',
  saidas: 'Saídas',
  itensSaida: 'Itens por saída',
  listas: 'Listas'
};

// ---------- entrada HTTP ----------

function doPost(e) {
  let resp;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    resp = rotear_(req);
  } catch (err) {
    resp = { ok: false, erro: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(resp)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'App Kiton Campo', versao: 1 }))
    .setMimeType(ContentService.MimeType.JSON);
}

function rotear_(req) {
  const a = req.acao;
  if (a === 'login') return login_(req);
  if (a === 'nomes') {
    return { ok: true, nomes: ler_(ABA.colab).linhas.filter(l => txt_(l.get('Ativo')) === 'Sim').map(l => txt_(l.get('Nome'))) };
  }
  const u = autenticar_(req.token);
  if (a === 'trocarPin') return trocarPin_(u, req);
  if (u.trocaPendente) throw new Error('TROCAR_PIN');
  switch (a) {
    case 'inicio': return inicio_(u);
    case 'registrarSaida': return comTrava_(() => registrarSaida_(u, req));
    case 'registrarRetorno': return comTrava_(() => registrarRetorno_(u, req));
    case 'emAberto': exigirAdmin_(u); return emAberto_();
    case 'conferir': exigirAdmin_(u); return comTrava_(() => conferir_(u, req));
    case 'fechamento': exigirAdmin_(u); return fechamento_(req);
    case 'resetarPin': exigirAdmin_(u); return comTrava_(() => resetarPin_(req));
  }
  throw new Error('Ação desconhecida: ' + a);
}

function comTrava_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function exigirAdmin_(u) {
  if (u.perfil !== 'Administrador') throw new Error('Acesso restrito à administração.');
}

// ---------- planilha: leitura por cabeçalho ----------

function aba_(nome) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh) throw new Error('Aba não encontrada: ' + nome);
  return sh;
}

/** Lê a aba inteira. Retorna {sh, cab (nome -> índice 0), linhas: [{_linha, valores, get(nome)}]} */
function ler_(nome) {
  const sh = aba_(nome);
  const dados = sh.getDataRange().getValues();
  const cab = {};
  (dados[0] || []).forEach((h, i) => { cab[String(h).trim()] = i; });
  const linhas = [];
  for (let r = 1; r < dados.length; r++) {
    const v = dados[r];
    if (v.every(x => x === '' || x === null)) continue;
    linhas.push({ _linha: r + 1, valores: v, get: n => (cab[n] === undefined ? '' : v[cab[n]]) });
  }
  return { sh, cab, linhas };
}

function col_(t, nome) {
  if (t.cab[nome] === undefined) throw new Error('Coluna não encontrada: ' + nome);
  return t.cab[nome] + 1;
}

function set_(t, linha, nome, valor) {
  t.sh.getRange(linha, col_(t, nome)).setValue(valor);
}

function anexar_(t, obj) {
  const n = Object.keys(t.cab).length;
  const row = new Array(n).fill('');
  Object.keys(obj).forEach(k => { if (t.cab[k] !== undefined) row[t.cab[k]] = obj[k]; });
  t.sh.appendRow(row);
  return t.sh.getLastRow();
}

function txt_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

function data_(v) {
  if (v instanceof Date) return v;
  const s = txt_(v);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmt_(v) {
  const d = data_(v);
  return d ? Utilities.formatDate(d, TZ, 'dd/MM/yyyy HH:mm') : '';
}

/** Horário informado pelo colaborador (yyyy-MM-ddTHH:mm). Vazio = agora. */
function horarioInformado_(valor, agora) {
  const t = txt_(valor);
  if (!t) return agora;
  const d = Utilities.parseDate(t.replace('T', ' ').slice(0, 16), TZ, 'yyyy-MM-dd HH:mm');
  if (isNaN(d)) throw new Error('Horário inválido.');
  if (d.getTime() > agora.getTime() + 5 * 60000) throw new Error('O horário não pode ser no futuro.');
  if (agora.getTime() - d.getTime() > 31 * 864e5) throw new Error('Horário com mais de 30 dias. Fale com a administração.');
  return d;
}

function tardio_(informado, lancado) {
  return lancado.getTime() - informado.getTime() > TOLERANCIA_MIN * 60000;
}

function mapa_(g) {
  return g && g.lat !== undefined ? 'https://maps.google.com/?q=' + g.lat + ',' + g.lng : 'sem localização';
}

// ---------- login e sessão ----------

function segredo_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SEGREDO');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SEGREDO', s); }
  return s;
}

function b64_(bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ''); }

function hashPin_(pin, sal) {
  return b64_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + ':' + pin, Utilities.Charset.UTF_8));
}

function assinar_(texto) {
  return b64_(Utilities.computeHmacSha256Signature(texto, segredo_()));
}

/** Versão do PIN entra no token: trocar ou redefinir o PIN derruba as sessões antigas. */
function versaoPin_(campoPin) { return txt_(campoPin).slice(-8) || 'padrao'; }

function gerarToken_(nome, campoPin) {
  const exp = Date.now() + VALIDADE_SESSAO_DIAS * 864e5;
  const corpo = b64_(Utilities.newBlob(JSON.stringify({ n: nome, e: exp, v: versaoPin_(campoPin) })).getBytes());
  return corpo + '.' + assinar_(corpo);
}

function colaborador_(nome) {
  const t = ler_(ABA.colab);
  const l = t.linhas.find(x => txt_(x.get('Nome')).toLowerCase() === txt_(nome).toLowerCase());
  return { t, l };
}

function login_(req) {
  const { l } = colaborador_(req.nome);
  if (!l || txt_(l.get('Ativo')) !== 'Sim') throw new Error('Nome ou PIN incorreto.');
  const campo = txt_(l.get('PIN (cifrado, preenchido pelo app)'));
  let certo;
  if (!campo) certo = txt_(req.pin) === PIN_PADRAO;
  else { const [sal, h] = campo.split('$'); certo = hashPin_(txt_(req.pin), sal) === h; }
  if (!certo) throw new Error('Nome ou PIN incorreto.');
  const nome = txt_(l.get('Nome'));
  return {
    ok: true,
    token: gerarToken_(nome, campo),
    usuario: { nome, perfil: txt_(l.get('Perfil')), trocaPendente: !campo || txt_(l.get('Troca de PIN pendente')) === 'Sim' }
  };
}

function autenticar_(token) {
  const partes = txt_(token).split('.');
  if (partes.length !== 2 || assinar_(partes[0]) !== partes[1]) throw new Error('SESSAO_INVALIDA');
  const dados = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString());
  if (Date.now() > dados.e) throw new Error('SESSAO_INVALIDA');
  const { l } = colaborador_(dados.n);
  if (!l || txt_(l.get('Ativo')) !== 'Sim') throw new Error('SESSAO_INVALIDA');
  const campo = txt_(l.get('PIN (cifrado, preenchido pelo app)'));
  if (versaoPin_(campo) !== dados.v) throw new Error('SESSAO_INVALIDA');
  return {
    nome: txt_(l.get('Nome')),
    perfil: txt_(l.get('Perfil')),
    trocaPendente: !campo || txt_(l.get('Troca de PIN pendente')) === 'Sim'
  };
}

function pinFraco_(p) {
  if (!/^\d{6}$/.test(p)) return 'O PIN precisa ter 6 números.';
  if (p === PIN_PADRAO || /^(\d)\1{5}$/.test(p) || p === '654321' || /^(\d{3})\1$/.test(p) || /^(\d{2})\1\1$/.test(p))
    return 'PIN muito simples. Escolha outro.';
  return '';
}

function trocarPin_(u, req) {
  const novo = txt_(req.novo);
  const erro = pinFraco_(novo);
  if (erro) throw new Error(erro);
  return comTrava_(() => {
    const { t, l } = colaborador_(u.nome);
    const sal = Utilities.getUuid().slice(0, 8);
    const campo = sal + '$' + hashPin_(novo, sal);
    set_(t, l._linha, 'PIN (cifrado, preenchido pelo app)', campo);
    set_(t, l._linha, 'Troca de PIN pendente', 'Não');
    return { ok: true, token: gerarToken_(u.nome, campo), usuario: { nome: u.nome, perfil: u.perfil, trocaPendente: false } };
  });
}

function resetarPin_(req) {
  const { t, l } = colaborador_(req.nome);
  if (!l) throw new Error('Colaborador não encontrado.');
  set_(t, l._linha, 'PIN (cifrado, preenchido pelo app)', '');
  set_(t, l._linha, 'Troca de PIN pendente', 'Sim');
  return { ok: true };
}

// ---------- tela inicial ----------

function lista_(coluna) {
  const sh = aba_(ABA.listas);
  const dados = sh.getDataRange().getValues();
  const i = dados[0].findIndex(h => txt_(h) === coluna);
  if (i < 0) return [];
  return dados.slice(1).map(r => txt_(r[i])).filter(Boolean);
}

function inicio_(u) {
  const colabs = ler_(ABA.colab).linhas.filter(l => txt_(l.get('Ativo')) === 'Sim').map(l => txt_(l.get('Nome')));
  const clientes = ler_(ABA.clientes).linhas.filter(l => txt_(l.get('Ativo')) !== 'Não').map(l => txt_(l.get('Cliente'))).filter(Boolean);
  const saidas = ler_(ABA.saidas);
  const isaida = ler_(ABA.itensSaida);

  // onde está cada item que está fora
  const ultimaSaidaDoItem = {};
  isaida.linhas.forEach(l => {
    if (txt_(l.get('Situação')) === 'Fora') ultimaSaidaDoItem[txt_(l.get('Patrimônio'))] = txt_(l.get('Nº da saída'));
  });
  const infoSaida = {};
  saidas.linhas.forEach(l => { infoSaida[txt_(l.get('Nº'))] = { quem: txt_(l.get('Colaborador')), quando: fmt_(l.get('Data e hora de saída')) }; });

  const itens = ler_(ABA.itens).linhas
    .filter(l => txt_(l.get('Patrimônio')) && txt_(l.get('Situação')) !== 'Baixado' && txt_(l.get('Uso')) !== 'Individual')
    .map(l => {
      const pat = txt_(l.get('Patrimônio'));
      const ns = ultimaSaidaDoItem[pat];
      return {
        pat,
        desc: txt_(l.get('Descrição')),
        grupo: txt_(l.get('Grupo')),
        ident: txt_(l.get('Nº identificação')),
        tipo: txt_(l.get('Tipo')),
        kit: txt_(l.get('Kit (patrimônio do kit)')),
        situacao: txt_(l.get('Situação')) || 'Disponível',
        comQuem: ns && infoSaida[ns] ? infoSaida[ns].quem : '',
        desde: ns && infoSaida[ns] ? infoSaida[ns].quando : ''
      };
    });

  const abertas = saidas.linhas
    .filter(l => !txt_(l.get('Data e hora de retorno')) && txt_(l.get('Colaborador')) === u.nome)
    .map(l => resumoSaida_(l, isaida));

  return {
    ok: true,
    usuario: u,
    colaboradores: colabs,
    clientes,
    motivos: lista_('Motivo'),
    veiculos: lista_('Veículo'),
    abastecimentos: lista_('Abastecimento'),
    itens,
    abertas
  };
}

function resumoSaida_(l, isaida) {
  const n = txt_(l.get('Nº'));
  return {
    n,
    saida: fmt_(l.get('Data e hora de saída')),
    colaborador: txt_(l.get('Colaborador')),
    equipe: txt_(l.get('Equipe')),
    motivo: txt_(l.get('Motivo')),
    destino: txt_(l.get('Destino')),
    veiculo: txt_(l.get('Veículo')),
    tardio: txt_(l.get('Lançamento tardio')),
    lancadoEm: fmt_(l.get('Saída lançada em')),
    itens: isaida.linhas.filter(x => txt_(x.get('Nº da saída')) === n)
      .map(x => ({ pat: txt_(x.get('Patrimônio')), desc: txt_(x.get('Descrição')), qtd: x.get('Quantidade'), situacao: txt_(x.get('Situação')) }))
  };
}

// ---------- saída ----------

function registrarSaida_(u, req) {
  if (!txt_(req.motivo) || !txt_(req.destino) || !txt_(req.veiculo)) throw new Error('Preencha motivo, destino e veículo.');
  const itensT = ler_(ABA.itens);
  const porPat = {};
  itensT.linhas.forEach(l => { porPat[txt_(l.get('Patrimônio'))] = l; });

  // valida e expande kits
  const pedidos = (req.itens || []).map(i => ({ pat: txt_(i.pat), qtd: Number(i.qtd) || 1 }));
  pedidos.forEach(p => {
    const l = porPat[p.pat];
    if (!l) throw new Error('Item não encontrado: ' + p.pat);
    const sit = txt_(l.get('Situação')) || 'Disponível';
    if (sit !== 'Disponível') throw new Error(p.pat + ' não está disponível (' + sit + ').');
  });
  const componentes = [];
  pedidos.forEach(p => {
    if (txt_(porPat[p.pat].get('Tipo')) === 'Kit') {
      itensT.linhas.filter(l => txt_(l.get('Kit (patrimônio do kit)')) === p.pat)
        .forEach(l => componentes.push(l));
    }
  });

  const saidas = ler_(ABA.saidas);
  const n = saidas.linhas.reduce((m, l) => Math.max(m, Number(l.get('Nº')) || 0), 0) + 1;
  const agora = new Date();
  const quando = horarioInformado_(req.horario, agora);
  const atrasado = tardio_(quando, agora);
  const g = req.geo || null;
  anexar_(saidas, {
    'Nº': n,
    'Data e hora de saída': quando,
    'Saída lançada em': agora,
    'Lançamento tardio': atrasado ? 'Saída' : '',
    'Colaborador': u.nome,
    'Equipe': (req.equipe || []).join(', '),
    'Motivo': txt_(req.motivo),
    'Destino': txt_(req.destino),
    'Veículo': txt_(req.veiculo),
    'Lat. saída': g ? g.lat : '',
    'Long. saída': g ? g.lng : '',
    'Precisão saída (m)': g ? Math.round(g.acc) : '',
    'Mapa saída': mapa_(g),
    'Observações': txt_(req.obs),
    'Registrado por': u.nome
  });

  const isaida = ler_(ABA.itensSaida);
  pedidos.forEach(p => {
    const l = porPat[p.pat];
    anexar_(isaida, { 'Nº da saída': n, 'Patrimônio': p.pat, 'Descrição': txt_(l.get('Descrição')), 'Quantidade': p.qtd, 'Situação': 'Fora' });
    set_(itensT, l._linha, 'Situação', 'Fora');
  });
  componentes.forEach(l => set_(itensT, l._linha, 'Situação', 'Fora'));

  return { ok: true, n, quando: fmt_(quando), tardio: atrasado, semLocalizacao: !g };
}

// ---------- retorno ----------

function registrarRetorno_(u, req) {
  const saidas = ler_(ABA.saidas);
  const l = saidas.linhas.find(x => txt_(x.get('Nº')) === txt_(req.n));
  if (!l) throw new Error('Saída não encontrada.');
  if (txt_(l.get('Data e hora de retorno'))) throw new Error('Esta saída já tem retorno registrado.');
  if (txt_(l.get('Colaborador')) !== u.nome && u.perfil !== 'Administrador') throw new Error('Só quem registrou a saída pode registrar o retorno.');
  const agora = new Date();
  const quando = horarioInformado_(req.horario, agora);
  const saiu = data_(l.get('Data e hora de saída'));
  if (saiu && quando.getTime() < saiu.getTime()) throw new Error('O retorno não pode ser antes da saída (' + fmt_(saiu) + ').');
  const atrasado = tardio_(quando, agora);
  const g = req.geo || null;
  set_(saidas, l._linha, 'Data e hora de retorno', quando);
  set_(saidas, l._linha, 'Retorno lançado em', agora);
  if (atrasado) set_(saidas, l._linha, 'Lançamento tardio', txt_(l.get('Lançamento tardio')) ? 'Saída e retorno' : 'Retorno');
  set_(saidas, l._linha, 'Lat. retorno', g ? g.lat : '');
  set_(saidas, l._linha, 'Long. retorno', g ? g.lng : '');
  set_(saidas, l._linha, 'Precisão retorno (m)', g ? Math.round(g.acc) : '');
  set_(saidas, l._linha, 'Mapa retorno', mapa_(g));
  set_(saidas, l._linha, 'Abastecimento', txt_(req.abastecimento) || 'Não abasteceu');
  if (req.valor) set_(saidas, l._linha, 'Valor abastecimento (R$)', Number(req.valor));
  if (txt_(req.obs)) set_(saidas, l._linha, 'Observações', [txt_(l.get('Observações')), 'Retorno: ' + txt_(req.obs)].filter(Boolean).join(' | '));

  const problemas = {};
  (req.problemas || []).forEach(p => { problemas[txt_(p.pat)] = p; });
  const isaida = ler_(ABA.itensSaida);
  const itensT = ler_(ABA.itens);
  const linhaItem = {};
  itensT.linhas.forEach(x => { linhaItem[txt_(x.get('Patrimônio'))] = x; });

  isaida.linhas.filter(x => txt_(x.get('Nº da saída')) === txt_(req.n) && txt_(x.get('Situação')) === 'Fora').forEach(x => {
    const pat = txt_(x.get('Patrimônio'));
    const p = problemas[pat];
    const sit = p ? (p.situacao === 'Extraviado' ? 'Extraviado' : 'Avariado') : 'Aguardando conferência';
    set_(isaida, x._linha, 'Situação', sit);
    if (p && txt_(p.obs)) set_(isaida, x._linha, 'Observação na devolução', txt_(p.obs));
    const li = linhaItem[pat];
    if (li) {
      set_(itensT, li._linha, 'Situação', sit);
      if (txt_(li.get('Tipo')) === 'Kit') {
        itensT.linhas.filter(c => txt_(c.get('Kit (patrimônio do kit)')) === pat).forEach(c => set_(itensT, c._linha, 'Situação', sit));
      }
    }
  });
  return { ok: true, quando: fmt_(quando), tardio: atrasado, semLocalizacao: !g };
}

// ---------- administração ----------

function emAberto_() {
  const saidas = ler_(ABA.saidas);
  const isaida = ler_(ABA.itensSaida);
  const hoje = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd');
  const semRetorno = saidas.linhas.filter(l => !txt_(l.get('Data e hora de retorno'))).map(l => {
    const r = resumoSaida_(l, isaida);
    const d = data_(l.get('Data e hora de saída'));
    r.atrasada = d ? Utilities.formatDate(d, TZ, 'yyyyMMdd') < hoje : false;
    return r;
  });
  const infoSaida = {};
  saidas.linhas.forEach(l => { infoSaida[txt_(l.get('Nº'))] = { quem: txt_(l.get('Colaborador')), destino: txt_(l.get('Destino')) }; });
  const pendentes = isaida.linhas
    .filter(l => ['Aguardando conferência', 'Avariado', 'Extraviado'].indexOf(txt_(l.get('Situação'))) >= 0 && !txt_(l.get('Conferido por')))
    .map(l => {
      const n = txt_(l.get('Nº da saída'));
      return {
        linha: l._linha, n,
        pat: txt_(l.get('Patrimônio')), desc: txt_(l.get('Descrição')),
        situacao: txt_(l.get('Situação')), obs: txt_(l.get('Observação na devolução')),
        quem: infoSaida[n] ? infoSaida[n].quem : '', destino: infoSaida[n] ? infoSaida[n].destino : ''
      };
    });
  const limite = Date.now() - 30 * 864e5;
  const tardios = saidas.linhas.filter(l => txt_(l.get('Lançamento tardio')) && (data_(l.get('Data e hora de saída')) || new Date(0)).getTime() > limite)
    .map(l => ({
      n: txt_(l.get('Nº')), colaborador: txt_(l.get('Colaborador')), destino: txt_(l.get('Destino')), qual: txt_(l.get('Lançamento tardio')),
      saida: fmt_(l.get('Data e hora de saída')), saidaLancada: fmt_(l.get('Saída lançada em')),
      retorno: fmt_(l.get('Data e hora de retorno')), retornoLancado: fmt_(l.get('Retorno lançado em'))
    })).reverse();
  const semLocal = saidas.linhas.filter(l => txt_(l.get('Mapa saída')) === 'sem localização' || txt_(l.get('Mapa retorno')) === 'sem localização').length;
  return { ok: true, semRetorno, pendentes, semLocal, tardios };
}

function conferir_(u, req) {
  const isaida = ler_(ABA.itensSaida);
  const l = isaida.linhas.find(x => x._linha === Number(req.linha));
  if (!l) throw new Error('Linha não encontrada.');
  const res = ['Conferido OK', 'Avariado', 'Extraviado'].indexOf(req.resultado) >= 0 ? req.resultado : null;
  if (!res) throw new Error('Resultado inválido.');
  set_(isaida, l._linha, 'Situação', res);
  set_(isaida, l._linha, 'Conferido por', u.nome);
  set_(isaida, l._linha, 'Data da conferência', new Date());
  const itensT = ler_(ABA.itens);
  const pat = txt_(l.get('Patrimônio'));
  const li = itensT.linhas.find(x => txt_(x.get('Patrimônio')) === pat);
  const sitItem = res === 'Conferido OK' ? 'Disponível' : res;
  if (li) {
    set_(itensT, li._linha, 'Situação', sitItem);
    if (txt_(li.get('Tipo')) === 'Kit') {
      itensT.linhas.filter(x => txt_(x.get('Kit (patrimônio do kit)')) === pat).forEach(x => set_(itensT, x._linha, 'Situação', sitItem));
    }
  }
  return { ok: true };
}

function fechamento_(req) {
  const mes = txt_(req.mes); // 'yyyy-MM'
  const saidas = ler_(ABA.saidas);
  const porPessoa = {};
  saidas.linhas.forEach(l => {
    const d = data_(l.get('Data e hora de saída'));
    if (!d || Utilities.formatDate(d, TZ, 'yyyy-MM') !== mes) return;
    const quem = txt_(l.get('Colaborador'));
    const p = porPessoa[quem] || (porPessoa[quem] = { nome: quem, saidas: 0, particular: 0, abastKiton: 0, abastColab: 0, valorColab: 0, semRetorno: 0, tardios: 0 });
    p.saidas++;
    if (txt_(l.get('Veículo')) === 'Particular') p.particular++;
    const ab = txt_(l.get('Abastecimento'));
    if (ab === 'Pago pela Kiton') p.abastKiton++;
    if (ab.indexOf('Pago pelo colaborador') === 0) { p.abastColab++; p.valorColab += Number(l.get('Valor abastecimento (R$)')) || 0; }
    if (!txt_(l.get('Data e hora de retorno'))) p.semRetorno++;
    if (txt_(l.get('Lançamento tardio'))) p.tardios++;
  });
  return { ok: true, mes, pessoas: Object.keys(porPessoa).sort().map(k => porPessoa[k]) };
}

/** Rode uma vez pelo editor para autorizar o script e conferir a leitura da planilha. */
function testarConfiguracao() {
  [ABA.itens, ABA.colab, ABA.clientes, ABA.saidas, ABA.itensSaida, ABA.listas].forEach(n => {
    Logger.log(n + ': ' + ler_(n).linhas.length + ' linhas');
  });
  segredo_();
  Logger.log('Tudo certo.');
}
