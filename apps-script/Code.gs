/**
 * Kiton Hub | Ponte entre a tela do app e a planilha "Kiton Hub | Base de Dados".
 * Publicar como App da Web: Executar como "Eu", Acesso "Qualquer pessoa".
 * Módulos: login, saídas e retornos, check-in em obra, ordem de serviço, despesas,
 * conferência e fechamento do mês, calibração, cadastro de itens.
 */

const PIN_PADRAO = '123456';
const VALIDADE_SESSAO_DIAS = 90;
const TZ = 'America/Sao_Paulo';
const TOLERANCIA_MIN = 15; // lançamento feito mais de 15 min depois do horário informado = lançamento tardio
const RAIO_PADRAO_M = 300;  // check-in a mais de 300 m do cliente fica sinalizado (não bloqueia)
const EMAIL_KITON = 'contato@kitonengenharia.com.br';
const EMPRESA = {
  nome: 'Kiton Engenharia Integrada Ltda',
  cnpj: '29.234.872/0001-04',
  endereco: 'Av. Dr. Mário Clapier Urbinatti, 1434, Jardim Canadá, Maringá-PR',
  fone: '(44) 4141-0714',
  email: EMAIL_KITON
};

const ABA = {
  itens: 'Itens',
  colab: 'Colaboradores',
  clientes: 'Clientes',
  saidas: 'Saídas',
  itensSaida: 'Itens por saída',
  listas: 'Listas',
  histCal: 'Histórico de calibração',
  checkins: 'Check-ins',
  os: 'Ordens de serviço',
  apont: 'Apontamentos de OS',
  despesas: 'Despesas'
};

/** Abas criadas pelo próprio script na primeira vez que forem usadas. */
const CAB = {
  'Check-ins': ['Nº', 'Colaborador', 'Cliente', 'Chegada', 'Chegada lançada em', 'Lat. chegada', 'Long. chegada', 'Precisão chegada (m)',
    'Distância chegada (m)', 'Situação chegada', 'Mapa chegada', 'Saída do cliente', 'Saída lançada em', 'Lat. saída', 'Long. saída',
    'Distância saída (m)', 'Situação saída', 'Mapa saída', 'Horas no cliente', 'Lançamento tardio', 'Observações', 'OS vinculada', 'Destino após saída'],
  'Ordens de serviço': ['Nº OS', 'Status', 'Cliente', 'Local / setor', 'Solicitante', 'Tipo de serviço', 'Solicitação / problema',
    'Início previsto', 'Término previsto', 'Técnicos designados', 'Programada por', 'Programada em', 'Evento na agenda', 'Iniciada em',
    'Início x programado', 'Último apontamento', 'Finalizada em', 'Prazo', 'Horas trabalhadas', 'Apontamentos', 'Pendências / recomendações',
    'E-mails do cliente', 'Envio', 'PDF final', 'Motivo do cancelamento', 'Observações'],
  'Apontamentos de OS': ['Nº', 'Nº OS', 'Início', 'Fim', 'Horas', 'Tipo', 'Equipe', 'Serviço executado', 'Materiais utilizados', 'Fotos',
    'Assinatura', 'Assinado por', 'Cargo / setor de quem assinou', 'Cliente ausente (motivo)', 'PDF do apontamento', 'Check-in',
    'Lat. início', 'Long. início', 'Lat. fim', 'Long. fim', 'Registrado por', 'Iniciado lançado em', 'Fim lançado em', 'Lançamento tardio'],
  'Despesas': ['Nº', 'Data', 'Colaborador', 'Categoria', 'Valor (R$)', 'Pagamento', 'Cliente / obra', 'Descrição', 'Comprovante',
    'Saída vinculada', 'Lançado em', 'Situação', 'Conferido por', 'Data da conferência', 'Motivo da recusa', 'Reembolsado em']
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
    case 'calibraveis': exigirAdmin_(u); return calibraveis_();
    case 'registrarCalibracao': exigirAdmin_(u); return comTrava_(() => registrarCalibracao_(u, req));
    // check-in em obra
    case 'checkin': return comTrava_(() => checkin_(u, req));
    case 'checkout': return comTrava_(() => checkout_(u, req));
    case 'presenca': exigirAdmin_(u); return presenca_(req);
    case 'definirLocalCliente': exigirAdmin_(u); return comTrava_(() => definirLocalCliente_(req));
    case 'clientesNovos': exigirAdmin_(u); return clientesNovos_();
    case 'aceitarCliente': exigirAdmin_(u); return comTrava_(() => aceitarCliente_(u, req));
    case 'juntarCliente': exigirAdmin_(u); return comTrava_(() => juntarCliente_(u, req));
    // ordem de serviço
    case 'minhasOS': return minhasOS_(u);
    case 'detalheOS': return detalheOS_(u, req);
    case 'programarOS': return comTrava_(() => programarOS_(u, req));
    case 'iniciarOS': return comTrava_(() => iniciarOS_(u, req));
    case 'apontarOS': return comTrava_(() => apontarOS_(u, req));
    case 'encerrarAtendimento': return comTrava_(() => encerrarAtendimento_(u, req));
    case 'editarOS': exigirAdmin_(u); return comTrava_(() => editarOS_(u, req));
    case 'cancelarOS': exigirAdmin_(u); return comTrava_(() => cancelarOS_(u, req));
    case 'painelOS': exigirAdmin_(u); return painelOS_(req);
    case 'reenviarOS': exigirAdmin_(u); return reenviarOS_(u, req);
    // despesas
    case 'salvarDespesa': return comTrava_(() => salvarDespesa_(u, req));
    case 'minhasDespesas': return minhasDespesas_(u);
    case 'despesasPendentes': exigirAdmin_(u); return despesasPendentes_();
    case 'conferirDespesa': exigirAdmin_(u); return comTrava_(() => conferirDespesa_(u, req));
    case 'marcarReembolso': exigirAdmin_(u); return comTrava_(() => marcarReembolso_(req));
    // cadastro de itens
    case 'cadastroInfo': exigirAdmin_(u); return cadastroInfo_(req);
    case 'novoItem': exigirAdmin_(u); return comTrava_(() => novoItem_(u, req));
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh && CAB[nome]) {
    sh = ss.insertSheet(nome);
    sh.appendRow(CAB[nome]);
    sh.getRange(1, 1, 1, CAB[nome].length).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
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

function dia_(v) {
  const d = data_(v);
  return d ? Utilities.formatDate(d, TZ, 'dd/MM/yyyy') : '';
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
  const colabT = ler_(ABA.colab).linhas.filter(l => txt_(l.get('Ativo')) === 'Sim');
  const colabs = colabT.map(l => txt_(l.get('Nome')));
  // quem trabalha em campo (aparece em "quem vai junto" e nos técnicos da OS); função Administrativo fica de fora
  const equipeCampo = colabT.filter(l => txt_(l.get('Função')) !== 'Administrativo').map(l => txt_(l.get('Nome')));
  const clientesInfo = clientes_();
  const clientes = clientesInfo.map(c => c.nome);
  const saidas = ler_(ABA.saidas);
  const isaida = ler_(ABA.itensSaida);

  // onde está cada item que está fora
  const ultimaSaidaDoItem = {};
  isaida.linhas.forEach(l => {
    if (txt_(l.get('Situação')) === 'Fora') ultimaSaidaDoItem[txt_(l.get('Patrimônio'))] = txt_(l.get('Nº da saída'));
  });
  const infoSaida = {};
  saidas.linhas.forEach(l => { infoSaida[txt_(l.get('Nº'))] = { quem: txt_(l.get('Colaborador')), quando: fmt_(l.get('Data e hora de saída')) }; });

  const todos = ler_(ABA.itens).linhas;
  // itens de uso individual entregues a esta pessoa: só consulta, nunca entram na retirada
  const meus = todos
    .filter(l => txt_(l.get('Patrimônio')) && txt_(l.get('Situação')) !== 'Baixado' && txt_(l.get('Uso')) === 'Individual' &&
      txt_(l.get('Responsável (uso individual)')).toLowerCase() === u.nome.toLowerCase())
    .map(l => ({
      pat: txt_(l.get('Patrimônio')), desc: txt_(l.get('Descrição')), grupo: txt_(l.get('Grupo')),
      ident: txt_(l.get('Nº pintado / gravado')) || txt_(l.get('Nº identificação')), tipo: txt_(l.get('Tipo')),
      marca: txt_(l.get('Marca / modelo')), serie: txt_(l.get('Nº de série')), estado: txt_(l.get('Estado')),
      valor: Number(l.get('Valor de reposição (R$)')) || 0,
      calData: dia_(l.get('Data da calibração')), calStatus: txt_(l.get('Status da calibração')),
      calDias: l.get('Dias para vencer') === '' ? null : Number(l.get('Dias para vencer'))
    }));

  const itens = todos
    .filter(l => txt_(l.get('Patrimônio')) && txt_(l.get('Situação')) !== 'Baixado' && (txt_(l.get('Uso')) || 'Coletivo') === 'Coletivo')
    .map(l => {
      const pat = txt_(l.get('Patrimônio'));
      const ns = ultimaSaidaDoItem[pat];
      return {
        pat,
        desc: txt_(l.get('Descrição')),
        grupo: txt_(l.get('Grupo')),
        ident: txt_(l.get('Nº pintado / gravado')) || txt_(l.get('Nº identificação')),
        tipo: txt_(l.get('Tipo')),
        kit: txt_(l.get('Kit (patrimônio do kit)')),
        situacao: txt_(l.get('Situação')) || 'Disponível',
        comQuem: ns && infoSaida[ns] ? infoSaida[ns].quem : '',
        desde: ns && infoSaida[ns] ? infoSaida[ns].quando : '',
        calData: dia_(l.get('Data da calibração')),
        calStatus: txt_(l.get('Status da calibração')),
        calDias: l.get('Dias para vencer') === '' ? null : Number(l.get('Dias para vencer'))
      };
    });

  const abertas = saidas.linhas
    .filter(l => !txt_(l.get('Data e hora de retorno')) && txt_(l.get('Colaborador')) === u.nome)
    .map(l => resumoSaida_(l, isaida));

  return {
    ok: true,
    usuario: u,
    colaboradores: colabs,
    equipeCampo,
    clientes,
    motivos: lista_('Motivo'),
    veiculos: lista_('Veículo'),
    abastecimentos: lista_('Abastecimento'),
    itens,
    abertas,
    meus,
    clientesInfo,
    checkin: checkinAberto_(u),
    os: (() => { const m = minhasOS_(u); const hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
      return { sessao: m.sessao, total: m.abertas.length, hoje: m.abertas.filter(o => o.inicioPrevIso.slice(0, 10) === hoje).length,
        atrasadas: m.abertas.filter(o => o.atrasada).length }; })(),
    ultimosCheckins: ultimosCheckins_(u, 5),
    pendencias: u.perfil === 'Administrador' ? pendenciasAdmin_() : null,
    tiposOS: lista_('Tipo de OS'),
    categoriasDespesa: lista_('Categoria de despesa'),
    pagamentosDespesa: lista_('Pagamento de despesa')
  };
}

function pendenciasAdmin_() {
  return {
    itens: ler_(ABA.itensSaida).linhas.filter(l => ['Aguardando conferência', 'Avariado', 'Extraviado'].indexOf(txt_(l.get('Situação'))) >= 0 && !txt_(l.get('Conferido por'))).length,
    despesas: ler_(ABA.despesas).linhas.filter(l => txt_(l.get('Situação')) === 'Aguardando conferência').length,
    clientes: pendentesCliente_().length,
    os: (() => { const b = baseOS_(); return b.os.linhas.map(l => resumoOS_(l, b.porOS[txt_(l.get('Nº OS'))])).filter(o => o.atrasada || o.parada).length; })()
  };
}

function clientes_() {
  return ler_(ABA.clientes).linhas.filter(l => txt_(l.get('Ativo')) !== 'Não' && txt_(l.get('Cliente'))).map(l => {
    const lat = Number(l.get('Latitude')), lng = Number(l.get('Longitude'));
    const temLocal = txt_(l.get('Latitude')) !== '' && txt_(l.get('Longitude')) !== '' && !isNaN(lat) && !isNaN(lng);
    return {
      nome: txt_(l.get('Cliente')), cidade: txt_(l.get('Cidade')), endereco: txt_(l.get('Endereço')),
      lat: temLocal ? lat : null, lng: temLocal ? lng : null,
      raio: Number(l.get('Raio do check-in (m)')) || RAIO_PADRAO_M,
      emails: ['E-mail OS 1', 'E-mail OS 2', 'E-mail OS 3'].map(k => txt_(l.get(k))).filter(Boolean)
    };
  });
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
  // abastecimento pago pelo colaborador vira despesa para reembolso (com o comprovante, se enviado)
  let despesa = null;
  if (/colaborador/i.test(txt_(req.abastecimento)) && Number(req.valor) > 0) {
    despesa = criarDespesa_(u, {
      data: Utilities.formatDate(quando, TZ, 'yyyy-MM-dd'), categoria: 'Combustível', valor: Number(req.valor),
      pagamento: 'Paguei do meu bolso (reembolso)', cliente: txt_(l.get('Destino')),
      descricao: 'Abastecimento na saída nº ' + txt_(req.n) + ' (' + txt_(l.get('Veículo')) + ')', foto: req.foto, saida: txt_(req.n)
    });
    if (despesa.link) set_(saidas, l._linha, 'Comprovante', despesa.link);
  }
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
  return { ok: true, quando: fmt_(quando), tardio: atrasado, semLocalizacao: !g, despesa: despesa ? despesa.n : null };
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
  const pessoa = quem => porPessoa[quem] || (porPessoa[quem] = { nome: quem, saidas: 0, particular: 0, abastKiton: 0, abastColab: 0, valorColab: 0, semRetorno: 0, tardios: 0 });
  // presença em obra
  ler_(ABA.checkins).linhas.forEach(l => {
    const d = data_(l.get('Chegada'));
    if (!d || Utilities.formatDate(d, TZ, 'yyyy-MM') !== mes) return;
    const p = pessoa(txt_(l.get('Colaborador')));
    p.dias = p.dias || {};
    p.dias[Utilities.formatDate(d, TZ, 'dd')] = 1;
    p.horasObra = (p.horasObra || 0) + (Number(l.get('Horas no cliente')) || 0);
    if (/Fora do raio/.test(txt_(l.get('Situação chegada')))) p.foraRaio = (p.foraRaio || 0) + 1;
    if (!txt_(l.get('Saída do cliente'))) p.semSaidaCliente = (p.semSaidaCliente || 0) + 1;
  });
  // despesas
  ler_(ABA.despesas).linhas.forEach(l => {
    const d = data_(l.get('Data'));
    if (!d || Utilities.formatDate(d, TZ, 'yyyy-MM') !== mes) return;
    if (!/reembolso/i.test(txt_(l.get('Pagamento')))) return;
    const p = pessoa(txt_(l.get('Colaborador')));
    const v = Number(l.get('Valor (R$)')) || 0, sit = txt_(l.get('Situação'));
    if (sit === 'Aprovada') p.reembolsar = (p.reembolsar || 0) + v;
    else if (sit === 'Aguardando conferência') p.despPendente = (p.despPendente || 0) + v;
    else if (sit === 'Reembolsada') p.reembolsado = (p.reembolsado || 0) + v;
  });
  const lista = Object.keys(porPessoa).sort().map(k => {
    const p = porPessoa[k];
    p.diasObra = p.dias ? Object.keys(p.dias).length : 0; delete p.dias;
    p.horasObra = Math.round((p.horasObra || 0) * 10) / 10;
    ['foraRaio', 'semSaidaCliente', 'reembolsar', 'despPendente', 'reembolsado'].forEach(c => p[c] = p[c] || 0);
    return p;
  });
  return { ok: true, mes, pessoas: lista };
}

// ---------- calibração ----------

function calibraveis_() {
  const t = ler_(ABA.itens);
  const lista = t.linhas
    .filter(l => txt_(l.get('Patrimônio')) && txt_(l.get('Situação')) !== 'Baixado' && (txt_(l.get('Tipo')) === 'Instrumento' || txt_(l.get('Periodicidade'))))
    .map(l => ({
      pat: txt_(l.get('Patrimônio')), desc: txt_(l.get('Descrição')), grupo: txt_(l.get('Grupo')),
      ident: txt_(l.get('Nº pintado / gravado') || l.get('Nº identificação')), marca: txt_(l.get('Marca / modelo')), serie: txt_(l.get('Nº de série')),
      data: dia_(l.get('Data da calibração')), cert: txt_(l.get('Nº certificado')), per: txt_(l.get('Periodicidade')),
      validade: dia_(l.get('Validade da calibração')), status: txt_(l.get('Status da calibração')) || 'Sem calibração',
      dias: l.get('Dias para vencer') === '' ? null : Number(l.get('Dias para vencer')),
      fornecedor: txt_(l.get('Fornecedor da calibração')), custo: l.get('Custo última calibração (R$)'),
      responsavel: txt_(l.get('Responsável (uso individual)')), local: txt_(l.get('Local de guarda'))
    }));
  const ordem = { 'Vencido': 0, 'Vencendo': 1, 'Sem calibração': 2, 'Válido': 3 };
  lista.sort((a, b) => (ordem[a.status] ?? 4) - (ordem[b.status] ?? 4) || (a.dias ?? 1e9) - (b.dias ?? 1e9) || a.pat.localeCompare(b.pat));
  return { ok: true, itens: lista, periodicidades: lista_('Periodicidade') };
}

function abaHistorico_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA.histCal);
  if (!sh) {
    sh = ss.insertSheet(ABA.histCal);
    sh.appendRow(['Data do registro', 'Patrimônio', 'Descrição', 'Data da calibração', 'Nº certificado', 'Periodicidade', 'Fornecedor', 'Custo (R$)', 'Calibração anterior', 'Registrado por', 'Observações']);
    sh.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function registrarCalibracao_(u, req) {
  const t = ler_(ABA.itens);
  const l = t.linhas.find(x => txt_(x.get('Patrimônio')) === txt_(req.pat));
  if (!l) throw new Error('Item não encontrado.');
  const d = Utilities.parseDate(txt_(req.data), TZ, 'yyyy-MM-dd');
  if (isNaN(d)) throw new Error('Data da calibração inválida.');
  if (d.getTime() > Date.now() + 864e5) throw new Error('A data da calibração não pode ser no futuro.');
  const per = txt_(req.periodicidade);
  if (lista_('Periodicidade').indexOf(per) < 0) throw new Error('Escolha a periodicidade.');
  const anterior = dia_(l.get('Data da calibração'));
  abaHistorico_().appendRow([new Date(), txt_(req.pat), txt_(l.get('Descrição')), d, txt_(req.cert), per, txt_(req.fornecedor),
    req.custo ? Number(req.custo) : '', anterior, u.nome, txt_(req.obs)]);
  set_(t, l._linha, 'Data da calibração', d);
  set_(t, l._linha, 'Nº certificado', txt_(req.cert));
  set_(t, l._linha, 'Periodicidade', per);
  set_(t, l._linha, 'Fornecedor da calibração', txt_(req.fornecedor));
  if (req.custo) set_(t, l._linha, 'Custo última calibração (R$)', Number(req.custo));
  SpreadsheetApp.flush();
  return { ok: true };
}

// ---------- utilidades de arquivos ----------

/** Pasta no Drive da Kiton (cria na primeira vez). O ID fica guardado: pode mover ou renomear a pasta depois. */
function pasta_(caminho) {
  const p = PropertiesService.getScriptProperties();
  const k = 'PASTA_' + caminho.join('/');
  const id = p.getProperty(k);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* pasta apagada: recria */ } }
  let f = DriveApp.getRootFolder();
  caminho.forEach(n => { const it = f.getFoldersByName(n); f = it.hasNext() ? it.next() : f.createFolder(n); });
  p.setProperty(k, f.getId());
  return f;
}

/** dataURL ou base64 puro -> blob */
function blobDe_(dado, mime, nome) {
  const s = txt_(dado);
  if (!s) return null;
  const m = s.match(/^data:([^;]+);base64,(.*)$/);
  const bytes = Utilities.base64Decode(m ? m[2] : s);
  return Utilities.newBlob(bytes, m ? m[1] : mime, nome);
}

function distanciaM_(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function proximoNumero_(t, coluna) {
  return t.linhas.reduce((m, l) => Math.max(m, Number(l.get(coluna)) || 0), 0) + 1;
}

function emailValido_(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(txt_(e)); }

// ---------- check-in em obra ----------

function situacaoLocal_(cliente, g) {
  if (!g) return { situacao: 'Sem GPS', dist: '' };
  if (!cliente || cliente.lat === null) return { situacao: 'Cliente sem localização', dist: '' };
  const dist = distanciaM_(g, cliente);
  // a precisão do GPS entra a favor do colaborador (até 100 m)
  const folga = Math.min(Number(g.acc) || 0, 100);
  return { situacao: dist <= cliente.raio + folga ? 'No local' : 'Fora do raio', dist };
}

function checkinAberto_(u) {
  const l = ler_(ABA.checkins).linhas.filter(x => txt_(x.get('Colaborador')) === u.nome && !txt_(x.get('Saída do cliente'))).pop();
  return l ? resumoCheckin_(l) : null;
}

function ultimosCheckins_(u, n) {
  return ler_(ABA.checkins).linhas.filter(x => txt_(x.get('Colaborador')) === u.nome && txt_(x.get('Saída do cliente')))
    .slice(-n).reverse().map(resumoCheckin_);
}

function resumoCheckin_(l) {
  return {
    n: txt_(l.get('Nº')), colaborador: txt_(l.get('Colaborador')), cliente: txt_(l.get('Cliente')),
    chegada: fmt_(l.get('Chegada')), saida: fmt_(l.get('Saída do cliente')),
    situacao: txt_(l.get('Situação chegada')), situacaoSaida: txt_(l.get('Situação saída')),
    dist: l.get('Distância chegada (m)'), horas: l.get('Horas no cliente'), tardio: txt_(l.get('Lançamento tardio')),
    mapa: txt_(l.get('Mapa chegada')), lat: l.get('Lat. chegada'), lng: l.get('Long. chegada'), obs: txt_(l.get('Observações'))
  };
}

/** Chave para comparar nomes de cliente: sem acento, maiúscula, pontuação nem sufixo societário. */
function chaveCliente_(n) {
  return txt_(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\b(ltda|me|epp|eireli|s ?a|cia|industria e comercio|ind e com)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Nome no padrão do cadastro: espaços simples, iniciais maiúsculas, conectivos minúsculos, sem sufixo societário. */
function padronizarCliente_(n) {
  const minus = ['de', 'da', 'do', 'das', 'dos', 'e'];
  let s = txt_(n).replace(/\s+/g, ' ').replace(/[\s,.-]+(ltda|me|epp|eireli|s\.?\/?a)\.?$/i, '').trim();
  return s.split(' ').map((w, i) => {
    if (/^[A-Z0-9]{2,4}$/.test(w)) return w;            // sigla já em maiúscula: EP, CBA
    const l = w.toLowerCase();
    if (i > 0 && minus.indexOf(l) >= 0) return l;
    return l.charAt(0).toUpperCase() + l.slice(1);
  }).join(' ');
}

/** Cadastra um cliente digitado em campo, se não existir nada parecido. */
function cadastrarClienteCampo_(u, nome, cidade, g) {
  const padrao = padronizarCliente_(nome);
  if (padrao.length < 3) throw new Error('Nome do cliente muito curto.');
  if (!txt_(cidade)) throw new Error('Informe a cidade do cliente novo.');
  if (padrao !== txt_(nome)) throw new Error('PADRAO:' + padrao);
  const k = chaveCliente_(padrao);
  const igual = clientes_().find(c => chaveCliente_(c.nome) === k);
  if (igual) throw new Error('Esse cliente já existe como "' + igual.nome + '". Escolha ele na lista.');
  const t = ler_(ABA.clientes);
  anexar_(t, {
    'Cliente': padrao, 'Cidade': padronizarCliente_(cidade).replace(/[\s\/-]+([a-z]{2})$/i, (_, uf) => '-' + uf.toUpperCase()), 'Latitude': g ? g.lat : '', 'Longitude': g ? g.lng : '', 'Ativo': 'Sim',
    'Cadastrado por': 'App: ' + u.nome + ' em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') + ' (conferir)'
  });
  return { nome: padrao, cidade: cidade, lat: g ? g.lat : null, lng: g ? g.lng : null, raio: RAIO_PADRAO_M, emails: [] };
}

// ---------- conferência de clientes cadastrados em campo ----------

const REF_CLIENTE = [['Check-ins', 'Cliente'], ['Ordens de serviço', 'Cliente'], ['Despesas', 'Cliente / obra'], ['Saídas', 'Destino']];

function usosCliente_(nome) {
  const r = {};
  REF_CLIENTE.forEach(([aba, col]) => { r[aba] = ler_(aba).linhas.filter(l => txt_(l.get(col)) === nome).length; });
  return r;
}

function renomearReferencias_(de, para) {
  let n = 0;
  REF_CLIENTE.forEach(([aba, col]) => {
    const t = ler_(aba);
    t.linhas.filter(l => txt_(l.get(col)) === de).forEach(l => { set_(t, l._linha, col, para); n++; });
  });
  return n;
}

/** Recalcula a situação dos check-ins de um cliente com a localização atual dele. */
function recalcularCheckins_(nome) {
  const cli = clientes_().find(c => c.nome === nome);
  if (!cli || cli.lat === null) return;
  const t = ler_(ABA.checkins);
  t.linhas.filter(x => txt_(x.get('Cliente')) === nome && txt_(x.get('Lat. chegada')) !== '').forEach(x => {
    const loc = situacaoLocal_(cli, { lat: Number(x.get('Lat. chegada')), lng: Number(x.get('Long. chegada')), acc: Number(x.get('Precisão chegada (m)')) });
    set_(t, x._linha, 'Distância chegada (m)', loc.dist);
    set_(t, x._linha, 'Situação chegada', loc.situacao);
  });
}

function pendentesCliente_() {
  return ler_(ABA.clientes).linhas.filter(l => /\(conferir\)/.test(txt_(l.get('Cadastrado por'))));
}

function clientesNovos_() {
  const novos = pendentesCliente_().map(l => ({
    nome: txt_(l.get('Cliente')), cidade: txt_(l.get('Cidade')), endereco: txt_(l.get('Endereço')),
    lat: txt_(l.get('Latitude')), lng: txt_(l.get('Longitude')), raio: Number(l.get('Raio do check-in (m)')) || RAIO_PADRAO_M,
    emails: ['E-mail OS 1', 'E-mail OS 2', 'E-mail OS 3'].map(k => txt_(l.get(k))), por: txt_(l.get('Cadastrado por')).replace(' (conferir)', ''),
    usos: usosCliente_(txt_(l.get('Cliente')))
  }));
  const nomes = novos.map(n => n.nome);
  const outros = clientes_().filter(c => nomes.indexOf(c.nome) < 0).map(c => ({ nome: c.nome, cidade: c.cidade }));
  return { ok: true, novos, outros };
}

function aceitarCliente_(u, req) {
  const t = ler_(ABA.clientes);
  const l = t.linhas.find(x => txt_(x.get('Cliente')) === txt_(req.nome));
  if (!l) throw new Error('Cliente não encontrado.');
  const novoNome = txt_(req.novoNome).replace(/\s+/g, ' ');
  if (novoNome.length < 2) throw new Error('Informe o nome do cliente.');
  const outro = t.linhas.find(x => x._linha !== l._linha && chaveCliente_(x.get('Cliente')) === chaveCliente_(novoNome));
  if (outro) throw new Error('Já existe "' + txt_(outro.get('Cliente')) + '". Use "É o mesmo que" para juntar.');
  const emails = (req.emails || []).map(txt_);
  const inv = emails.find(e => e && !emailValido_(e));
  if (inv) throw new Error('E-mail inválido: ' + inv);
  set_(t, l._linha, 'Cliente', novoNome);
  set_(t, l._linha, 'Cidade', txt_(req.cidade));
  set_(t, l._linha, 'Endereço', txt_(req.endereco));
  ['E-mail OS 1', 'E-mail OS 2', 'E-mail OS 3'].forEach((k, i) => set_(t, l._linha, k, emails[i] || ''));
  set_(t, l._linha, 'Raio do check-in (m)', Number(req.raio) || RAIO_PADRAO_M);
  set_(t, l._linha, 'Cadastrado por', txt_(l.get('Cadastrado por')).replace('(conferir)', '(aceito por ' + u.nome + ' em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy') + ')'));
  const alterados = novoNome !== txt_(req.nome) ? renomearReferencias_(txt_(req.nome), novoNome) : 0;
  recalcularCheckins_(novoNome);
  return { ok: true, nome: novoNome, alterados };
}

function juntarCliente_(u, req) {
  const t = ler_(ABA.clientes);
  const l = t.linhas.find(x => txt_(x.get('Cliente')) === txt_(req.nome));
  const d = t.linhas.find(x => txt_(x.get('Cliente')) === txt_(req.destino));
  if (!l || !d) throw new Error('Cliente não encontrado.');
  if (l._linha === d._linha) throw new Error('Escolha outro cliente.');
  // o cliente certo herda a localização se ainda não tiver
  if (txt_(d.get('Latitude')) === '' && txt_(l.get('Latitude')) !== '') {
    set_(t, d._linha, 'Latitude', Number(l.get('Latitude')));
    set_(t, d._linha, 'Longitude', Number(l.get('Longitude')));
  }
  const alterados = renomearReferencias_(txt_(req.nome), txt_(req.destino));
  t.sh.deleteRow(l._linha);
  recalcularCheckins_(txt_(req.destino));
  return { ok: true, destino: txt_(req.destino), alterados };
}

function checkin_(u, req) {
  let nome = txt_(req.cliente);
  if (!nome) throw new Error('Escolha o cliente.');
  if (checkinAberto_(u)) throw new Error('Você já está com um check-in aberto. Registre a saída do cliente antes.');
  let cliente = clientes_().find(c => c.nome === nome) || null;
  const agora = new Date();
  const quando = horarioInformado_(req.horario, agora);
  const g = req.geo || null;
  let novo = false;
  if (!cliente) {
    if (!req.novo) throw new Error('Cliente não encontrado. Escolha na lista ou cadastre como cliente novo.');
    cliente = cadastrarClienteCampo_(u, nome, req.cidade, g);
    nome = cliente.nome; novo = true;
  }
  const loc = novo ? { situacao: g ? 'Cliente novo' : 'Cliente sem localização', dist: '' } : situacaoLocal_(cliente, g);
  const t = ler_(ABA.checkins);
  const n = proximoNumero_(t, 'Nº');
  anexar_(t, {
    'Nº': n, 'Colaborador': u.nome, 'Cliente': nome, 'Chegada': quando, 'Chegada lançada em': agora,
    'Lat. chegada': g ? g.lat : '', 'Long. chegada': g ? g.lng : '', 'Precisão chegada (m)': g ? Math.round(g.acc) : '',
    'Distância chegada (m)': loc.dist, 'Situação chegada': loc.situacao, 'Mapa chegada': mapa_(g),
    'Lançamento tardio': tardio_(quando, agora) ? 'Chegada' : '', 'Observações': txt_(req.obs)
  });
  return { ok: true, n, cliente: nome, novo, quando: fmt_(quando), situacao: loc.situacao, dist: loc.dist, tardio: tardio_(quando, agora), semLocalizacao: !g };
}

function checkout_(u, req) {
  const t = ler_(ABA.checkins);
  const l = t.linhas.find(x => txt_(x.get('Nº')) === txt_(req.n));
  if (!l) throw new Error('Check-in não encontrado.');
  if (txt_(l.get('Saída do cliente'))) throw new Error('A saída deste cliente já foi registrada.');
  if (txt_(l.get('Colaborador')) !== u.nome && u.perfil !== 'Administrador') throw new Error('Só quem fez o check-in pode registrar a saída.');
  const agora = new Date();
  const quando = horarioInformado_(req.horario, agora);
  const chegou = data_(l.get('Chegada'));
  if (chegou && quando.getTime() < chegou.getTime()) throw new Error('A saída não pode ser antes da chegada (' + fmt_(chegou) + ').');
  const g = req.geo || null;
  const cliente = clientes_().find(c => c.nome === txt_(l.get('Cliente'))) || null;
  const loc = situacaoLocal_(cliente, g);
  const horas = chegou ? horasDe_(chegou, quando) : '';
  set_(t, l._linha, 'Saída do cliente', quando);
  set_(t, l._linha, 'Saída lançada em', agora);
  set_(t, l._linha, 'Lat. saída', g ? g.lat : '');
  set_(t, l._linha, 'Long. saída', g ? g.lng : '');
  set_(t, l._linha, 'Distância saída (m)', loc.dist);
  set_(t, l._linha, 'Situação saída', loc.situacao);
  set_(t, l._linha, 'Mapa saída', mapa_(g));
  set_(t, l._linha, 'Horas no cliente', horas);
  if (tardio_(quando, agora)) set_(t, l._linha, 'Lançamento tardio', txt_(l.get('Lançamento tardio')) ? 'Chegada e saída' : 'Saída');
  if (txt_(req.obs)) set_(t, l._linha, 'Observações', [txt_(l.get('Observações')), txt_(req.obs)].filter(Boolean).join(' | '));
  return { ok: true, quando: fmt_(quando), horas, situacao: loc.situacao, tardio: tardio_(quando, agora), semLocalizacao: !g };
}

function presenca_(req) {
  const mes = txt_(req.mes);
  const visitas = ler_(ABA.checkins).linhas.filter(l => {
    const d = data_(l.get('Chegada'));
    return d && Utilities.formatDate(d, TZ, 'yyyy-MM') === mes;
  }).map(resumoCheckin_).reverse();
  const semLocal = clientes_().filter(c => c.lat === null).map(c => c.nome);
  return { ok: true, mes, visitas, semLocal };
}

/** Usa a posição de um check-in como localização do cliente (para os próximos check-ins). */
function definirLocalCliente_(req) {
  const ck = ler_(ABA.checkins).linhas.find(x => txt_(x.get('Nº')) === txt_(req.n));
  if (!ck || txt_(ck.get('Lat. chegada')) === '') throw new Error('Este check-in não tem localização.');
  const t = ler_(ABA.clientes);
  const l = t.linhas.find(x => txt_(x.get('Cliente')) === txt_(ck.get('Cliente')));
  if (!l) throw new Error('Cliente não está cadastrado na aba Clientes.');
  set_(t, l._linha, 'Latitude', Number(ck.get('Lat. chegada')));
  set_(t, l._linha, 'Longitude', Number(ck.get('Long. chegada')));
  // recalcula a situação dos check-ins deste cliente que ainda não tinham referência
  const cli = { lat: Number(ck.get('Lat. chegada')), lng: Number(ck.get('Long. chegada')), raio: Number(l.get('Raio do check-in (m)')) || RAIO_PADRAO_M };
  const cks = ler_(ABA.checkins);
  cks.linhas.filter(x => txt_(x.get('Cliente')) === txt_(ck.get('Cliente')) && txt_(x.get('Situação chegada')) === 'Cliente sem localização' && txt_(x.get('Lat. chegada')) !== '')
    .forEach(x => {
      const loc = situacaoLocal_(cli, { lat: Number(x.get('Lat. chegada')), lng: Number(x.get('Long. chegada')), acc: Number(x.get('Precisão chegada (m)')) });
      set_(cks, x._linha, 'Distância chegada (m)', loc.dist);
      set_(cks, x._linha, 'Situação chegada', loc.situacao);
    });
  return { ok: true, cliente: txt_(ck.get('Cliente')) };
}

// ---------- ordem de serviço: programação, apontamentos e painel ----------
// Uma OS (aba "Ordens de serviço") tem um ou mais apontamentos (aba "Apontamentos de OS").
// Iniciar a OS faz o check-in no cliente; cada apontamento é parcial ou final, sempre com
// assinatura do cliente ou justificativa de ausência.

const AGENDA_GERAL = 'family09001548568622898097@group.calendar.google.com';
const DIAS_PARADA = 2; // OS em andamento sem apontamento há mais de 2 dias = parada

function iso_(d) { return d ? Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm") : ''; }
function dataIso_(s) {
  const t = txt_(s);
  if (!t) return null;
  const d = Utilities.parseDate(t.replace('T', ' ').slice(0, 16), TZ, 'yyyy-MM-dd HH:mm');
  if (isNaN(d)) throw new Error('Data e hora inválidas.');
  return d;
}
function lista2_(v) { return txt_(v).split(',').map(txt_).filter(Boolean); }

function proximaOS_() {
  const ano = Utilities.formatDate(new Date(), TZ, 'yyyy');
  let max = 0;
  [ABA.os, 'Ordens de serviço (versão anterior)'].forEach(n => {
    if (n !== ABA.os && !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n)) return;
    ler_(n).linhas.forEach(l => { const x = txt_(l.get('Nº OS')); if (x.indexOf(ano + '-') === 0) max = Math.max(max, Number(x.split('-')[1]) || 0); });
  });
  return ano + '-' + ('000' + (max + 1)).slice(-4);
}

/** Lê OS e apontamentos de uma vez. */
function baseOS_() {
  const os = ler_(ABA.os), ap = ler_(ABA.apont);
  const porOS = {};
  ap.linhas.forEach(l => { const n = txt_(l.get('Nº OS')); (porOS[n] = porOS[n] || []).push(l); });
  return { os, ap, porOS };
}

function resumoAp_(l) {
  return {
    n: txt_(l.get('Nº')), numero: txt_(l.get('Nº OS')), inicio: fmt_(l.get('Início')), fim: fmt_(l.get('Fim')),
    horas: l.get('Horas') === '' ? null : Number(l.get('Horas')), equipe: lista2_(l.get('Equipe')), tipo: txt_(l.get('Tipo')),
    executado: txt_(l.get('Serviço executado')), materiais: txt_(l.get('Materiais utilizados')),
    fotos: lista2_(l.get('Fotos')).length, assinante: txt_(l.get('Assinado por')), cargo: txt_(l.get('Cargo / setor de quem assinou')),
    ausente: txt_(l.get('Cliente ausente (motivo)')), pdf: txt_(l.get('PDF do apontamento')), checkin: txt_(l.get('Check-in')),
    registradoPor: txt_(l.get('Registrado por'))
  };
}

function resumoOS_(l, aps) {
  aps = aps || [];
  const agora = new Date();
  const ini = data_(l.get('Início previsto')), fim = data_(l.get('Término previsto'));
  const status = txt_(l.get('Status'));
  const ultimo = aps.reduce((m, a) => { const d = data_(a.get('Fim')) || data_(a.get('Início')); return d && (!m || d > m) ? d : m; }, null);
  const emExecucao = aps.some(a => !txt_(a.get('Fim')));
  const envolvidos = {};
  lista2_(l.get('Técnicos designados')).forEach(n => envolvidos[n] = 1);
  aps.forEach(a => lista2_(a.get('Equipe')).forEach(n => envolvidos[n] = 1));
  return {
    numero: txt_(l.get('Nº OS')), status, cliente: txt_(l.get('Cliente')), local: txt_(l.get('Local / setor')),
    solicitante: txt_(l.get('Solicitante')), tipo: txt_(l.get('Tipo de serviço')), solicitacao: txt_(l.get('Solicitação / problema')),
    inicioPrev: fmt_(ini), fimPrev: fmt_(fim), inicioPrevIso: iso_(ini), fimPrevIso: iso_(fim),
    tecnicos: lista2_(l.get('Técnicos designados')), envolvidos: Object.keys(envolvidos),
    programadaPor: txt_(l.get('Programada por')), iniciadaEm: fmt_(l.get('Iniciada em')), finalizadaEm: fmt_(l.get('Finalizada em')),
    horas: Number(l.get('Horas trabalhadas')) || 0, apontamentos: aps.length, emExecucao,
    atrasada: status === 'Programada' && !!ini && ini.getTime() < agora.getTime(),
    parada: status === 'Em andamento' && !emExecucao && !!ultimo && agora.getTime() - ultimo.getTime() > DIAS_PARADA * 864e5,
    inicioVsPrevisto: txt_(l.get('Início x programado')), prazo: txt_(l.get('Prazo')),
    pdf: txt_(l.get('PDF final')), envio: txt_(l.get('Envio')), emails: txt_(l.get('E-mails do cliente')),
    pendencias: txt_(l.get('Pendências / recomendações')), motivoCancel: txt_(l.get('Motivo do cancelamento'))
  };
}

function sessaoAberta_(u, b) {
  b = b || baseOS_();
  const l = b.ap.linhas.filter(x => !txt_(x.get('Fim')) && lista2_(x.get('Equipe'))[0] === u.nome).pop()
    || b.ap.linhas.filter(x => !txt_(x.get('Fim')) && txt_(x.get('Registrado por')) === u.nome).pop();
  if (!l) return null;
  const o = b.os.linhas.find(x => txt_(x.get('Nº OS')) === txt_(l.get('Nº OS')));
  return Object.assign(resumoAp_(l), { cliente: o ? txt_(o.get('Cliente')) : '', os: o ? resumoOS_(o, b.porOS[txt_(o.get('Nº OS'))]) : null });
}

/** OS em que a pessoa está envolvida e que ainda não terminaram, na ordem da programação. */
function minhasOS_(u) {
  const b = baseOS_();
  const abertas = b.os.linhas.filter(l => ['Programada', 'Em andamento'].indexOf(txt_(l.get('Status'))) >= 0)
    .map(l => resumoOS_(l, b.porOS[txt_(l.get('Nº OS'))]))
    .filter(o => o.envolvidos.indexOf(u.nome) >= 0)
    .sort((a, c) => (a.inicioPrevIso || '9') < (c.inicioPrevIso || '9') ? -1 : (a.inicioPrevIso || '9') > (c.inicioPrevIso || '9') ? 1 : a.numero.localeCompare(c.numero));
  const finalizadas = b.os.linhas.filter(l => txt_(l.get('Status')) === 'Finalizada').map(l => resumoOS_(l, b.porOS[txt_(l.get('Nº OS'))]))
    .filter(o => o.envolvidos.indexOf(u.nome) >= 0).slice(-10).reverse();
  return { ok: true, abertas, finalizadas, sessao: sessaoAberta_(u, b) };
}

function detalheOS_(u, req) {
  const b = baseOS_();
  const l = b.os.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  const aps = b.porOS[txt_(req.numero)] || [];
  return { ok: true, os: resumoOS_(l, aps), apontamentos: aps.map(resumoAp_) };
}

// ----- agenda -----
function textoAgenda_(o) {
  return 'OS ' + o.numero + ' | ' + o.cliente + (o.local ? ' | ' + o.local : '');
}
function descAgenda_(o) {
  return ['Tipo: ' + (o.tipo || '-'), 'Técnicos: ' + (o.tecnicos.join(', ') || '-'), o.solicitante ? 'Solicitante: ' + o.solicitante : '',
    o.solicitacao ? 'Solicitação: ' + o.solicitacao : '', 'Programada pelo Kiton Hub'].filter(Boolean).join('\n');
}
function agendaCriar_(o, ini, fim) {
  try {
    const cal = CalendarApp.getCalendarById(AGENDA_GERAL);
    const ev = cal.createEvent(textoAgenda_(o), ini, fim || new Date(ini.getTime() + 36e5), { description: descAgenda_(o) });
    return ev.getId();
  } catch (e) { return 'erro: ' + (e && e.message ? e.message : e); }
}
function agendaAtualizar_(id, o, ini, fim) {
  if (!id || id.indexOf('erro') === 0) return agendaCriar_(o, ini, fim);
  try {
    const ev = CalendarApp.getCalendarById(AGENDA_GERAL).getEventById(id);
    if (!ev) return agendaCriar_(o, ini, fim);
    ev.setTime(ini, fim || new Date(ini.getTime() + 36e5)); ev.setTitle(textoAgenda_(o)); ev.setDescription(descAgenda_(o));
    return id;
  } catch (e) { return 'erro: ' + (e && e.message ? e.message : e); }
}
function agendaApagar_(id) {
  if (!id || id.indexOf('erro') === 0) return;
  try { const ev = CalendarApp.getCalendarById(AGENDA_GERAL).getEventById(id); if (ev) ev.deleteEvent(); } catch (e) { /* segue */ }
}

// ----- programar, editar, cancelar -----
function programarOS_(u, req) {
  const cliente = clientes_().find(c => c.nome === txt_(req.cliente));
  if (!cliente) throw new Error('Escolha o cliente da lista. Cliente novo: cadastre na planilha ou pelo check-in.');
  if (!txt_(req.tipo)) throw new Error('Escolha o tipo de serviço.');
  const ini = dataIso_(req.inicioPrev), fim = dataIso_(req.fimPrev);
  if (!ini) throw new Error('Informe o início previsto.');
  if (fim && fim.getTime() < ini.getTime()) throw new Error('O término previsto está antes do início.');
  const tecnicos = (req.tecnicos || []).map(txt_).filter(Boolean);
  if (!tecnicos.length) throw new Error('Escolha pelo menos um técnico.');
  const t = ler_(ABA.os);
  const numero = proximaOS_();
  const o = { numero, cliente: cliente.nome, local: txt_(req.local), tipo: txt_(req.tipo), tecnicos, solicitante: txt_(req.solicitante), solicitacao: txt_(req.solicitacao) };
  const ev = agendaCriar_(o, ini, fim);
  anexar_(t, {
    'Nº OS': numero, 'Status': 'Programada', 'Cliente': cliente.nome, 'Local / setor': o.local, 'Solicitante': o.solicitante,
    'Tipo de serviço': o.tipo, 'Solicitação / problema': o.solicitacao, 'Início previsto': ini, 'Término previsto': fim || '',
    'Técnicos designados': tecnicos.join(', '), 'Programada por': u.nome, 'Programada em': new Date(), 'Evento na agenda': ev
  });
  return { ok: true, numero, agenda: ev.indexOf('erro') !== 0 };
}

function editarOS_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  const st = txt_(l.get('Status'));
  if (['Finalizada', 'Cancelada'].indexOf(st) >= 0) throw new Error('OS ' + st.toLowerCase() + ' não pode ser alterada.');
  const tecnicos = (req.tecnicos || []).map(txt_).filter(Boolean);
  if (!tecnicos.length) throw new Error('Escolha pelo menos um técnico.');
  set_(t, l._linha, 'Técnicos designados', tecnicos.join(', '));
  if (txt_(req.local) !== '' || req.local === '') set_(t, l._linha, 'Local / setor', txt_(req.local));
  if (req.solicitacao !== undefined) set_(t, l._linha, 'Solicitação / problema', txt_(req.solicitacao));
  let ini = data_(l.get('Início previsto')), fim = data_(l.get('Término previsto'));
  if (req.inicioPrev) {
    ini = dataIso_(req.inicioPrev); fim = dataIso_(req.fimPrev);
    if (fim && fim.getTime() < ini.getTime()) throw new Error('O término previsto está antes do início.');
    set_(t, l._linha, 'Início previsto', ini); set_(t, l._linha, 'Término previsto', fim || '');
  }
  const o = { numero: txt_(req.numero), cliente: txt_(l.get('Cliente')), local: txt_(req.local), tipo: txt_(l.get('Tipo de serviço')), tecnicos,
    solicitante: txt_(l.get('Solicitante')), solicitacao: req.solicitacao !== undefined ? txt_(req.solicitacao) : txt_(l.get('Solicitação / problema')) };
  if (ini) set_(t, l._linha, 'Evento na agenda', agendaAtualizar_(txt_(l.get('Evento na agenda')), o, ini, fim));
  set_(t, l._linha, 'Observações', [txt_(l.get('Observações')), 'Alterada por ' + u.nome + ' em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm')].filter(Boolean).join(' | '));
  return { ok: true };
}

function cancelarOS_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  if (['Finalizada', 'Cancelada'].indexOf(txt_(l.get('Status'))) >= 0) throw new Error('Esta OS já está ' + txt_(l.get('Status')).toLowerCase() + '.');
  if (!txt_(req.motivo)) throw new Error('Informe o motivo do cancelamento.');
  const ap = ler_(ABA.apont);
  if (ap.linhas.some(x => txt_(x.get('Nº OS')) === txt_(req.numero) && !txt_(x.get('Fim')))) throw new Error('Há um apontamento em execução. Peça para o técnico apontar antes.');
  set_(t, l._linha, 'Status', 'Cancelada');
  set_(t, l._linha, 'Motivo do cancelamento', txt_(req.motivo) + ' (' + u.nome + ', ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy') + ')');
  agendaApagar_(txt_(l.get('Evento na agenda')));
  return { ok: true };
}

// ----- iniciar -----
function iniciarOS_(u, req) {
  const b = baseOS_();
  if (sessaoAberta_(u, b)) throw new Error('Você já tem uma OS em execução. Aponte o fim dela antes de iniciar outra.');
  let numero = txt_(req.numero), l = null, cliente;
  const equipe = [u.nome].concat((req.equipe || []).map(txt_).filter(n => n && n !== u.nome));
  if (numero) {
    l = b.os.linhas.find(x => txt_(x.get('Nº OS')) === numero);
    if (!l) throw new Error('OS não encontrada.');
    if (['Finalizada', 'Cancelada'].indexOf(txt_(l.get('Status'))) >= 0) throw new Error('Esta OS já está ' + txt_(l.get('Status')).toLowerCase() + '.');
    if (b.ap.linhas.some(x => txt_(x.get('Nº OS')) === numero && !txt_(x.get('Fim')))) throw new Error('Esta OS já está em execução por outra pessoa.');
    cliente = txt_(l.get('Cliente'));
  } else {
    cliente = txt_(req.cliente);
    if (!cliente) throw new Error('Escolha o cliente.');
    if (!txt_(req.tipo)) throw new Error('Escolha o tipo de serviço.');
  }

  // check-in: reaproveita o aberto no mesmo cliente; abre um novo se não houver
  const agora = new Date();
  const quando = horarioInformado_(req.horario, agora);
  let ck = checkinAberto_(u);
  if (ck && ck.cliente !== cliente) throw new Error('Você está com check-in aberto em ' + ck.cliente + '. Registre a saída de lá antes.');
  let ckInfo = null;
  if (!ck) {
    ckInfo = checkin_(u, { cliente, novo: !numero && req.novo, cidade: req.cidade, horario: req.horario, geo: req.geo, obs: numero ? 'OS ' + numero : 'OS aberta em campo' });
    cliente = ckInfo.cliente;
    ck = checkinAberto_(u);
  }

  const t = b.os;
  if (!numero) {
    numero = proximaOS_();
    anexar_(t, {
      'Nº OS': numero, 'Status': 'Em andamento', 'Cliente': cliente, 'Local / setor': txt_(req.local), 'Solicitante': txt_(req.solicitante),
      'Tipo de serviço': txt_(req.tipo), 'Solicitação / problema': txt_(req.solicitacao), 'Técnicos designados': equipe.join(', '),
      'Programada por': u.nome + ' (aberta em campo)', 'Programada em': agora, 'Iniciada em': quando
    });
  } else {
    if (!txt_(l.get('Iniciada em'))) {
      set_(t, l._linha, 'Iniciada em', quando);
      const prev = data_(l.get('Início previsto'));
      if (prev) {
        const a = Utilities.formatDate(quando, TZ, 'yyyyMMdd'), p = Utilities.formatDate(prev, TZ, 'yyyyMMdd');
        set_(t, l._linha, 'Início x programado', a < p ? 'Antes do programado' : a === p ? 'No dia programado' : 'Depois do programado');
      }
    }
    set_(t, l._linha, 'Status', 'Em andamento');
  }
  const ap = ler_(ABA.apont);
  const n = proximoNumero_(ap, 'Nº');
  const g = req.geo || null;
  anexar_(ap, {
    'Nº': n, 'Nº OS': numero, 'Início': quando, 'Equipe': equipe.join(', '), 'Check-in': ck ? ck.n : '',
    'Lat. início': g ? g.lat : '', 'Long. início': g ? g.lng : '', 'Registrado por': u.nome, 'Iniciado lançado em': agora
  });
  if (ck) {
    const cks = ler_(ABA.checkins);
    const lc = cks.linhas.find(x => txt_(x.get('Nº')) === txt_(ck.n));
    if (lc && lista2_(lc.get('OS vinculada')).indexOf(numero) < 0) set_(cks, lc._linha, 'OS vinculada', lista2_(lc.get('OS vinculada')).concat([numero]).join(', '));
  }
  return { ok: true, numero, apontamento: n, cliente, quando: fmt_(quando), checkinNovo: !!ckInfo, situacao: ckInfo ? ckInfo.situacao : '', dist: ckInfo ? ckInfo.dist : '' };
}

// ----- apontar (parcial ou final) -----
function salvarImagem_(pasta, dado, mime, nome) {
  const bl = blobDe_(dado, mime, nome);
  return bl ? pasta.createFile(bl).getId() : '';
}

function apontarOS_(u, req) {
  const b = baseOS_();
  const la = b.ap.linhas.find(x => txt_(x.get('Nº')) === txt_(req.n));
  if (!la) throw new Error('Apontamento não encontrado.');
  if (txt_(la.get('Fim'))) throw new Error('Este apontamento já foi encerrado.');
  if (lista2_(la.get('Equipe')).indexOf(u.nome) < 0 && u.perfil !== 'Administrador') throw new Error('Só quem está na equipe pode apontar.');
  const tipo = req.tipo === 'Final' ? 'Final' : 'Parcial';
  if (!txt_(req.executado)) throw new Error('Descreva o que foi executado.');
  const ausente = txt_(req.ausente);
  if (!ausente && !txt_(req.assinatura)) throw new Error('Falta a assinatura do cliente (ou marque cliente ausente com o motivo).');
  if (!ausente && !txt_(req.assinante)) throw new Error('Informe o nome de quem assinou.');
  const emails = (req.emails || []).map(txt_).filter(Boolean);
  const inv = emails.find(e => !emailValido_(e));
  if (inv) throw new Error('E-mail inválido: ' + inv);
  if (emails.length > 3) throw new Error('No máximo 3 e-mails do cliente.');

  const numero = txt_(la.get('Nº OS'));
  const lo = b.os.linhas.find(x => txt_(x.get('Nº OS')) === numero);
  const agora = new Date();
  const fim = horarioInformado_(req.horario, agora);
  const ini = data_(la.get('Início'));
  if (ini && fim.getTime() < ini.getTime()) throw new Error('O fim não pode ser antes do início (' + fmt_(ini) + ').');
  const horas = ini ? horasDe_(ini, fim) : '';
  const ano = numero.split('-')[0];
  const pasta = pasta_(['Kiton Hub', 'Ordens de serviço', ano, 'OS ' + numero]);
  const fotos = (req.fotos || []).filter(Boolean).slice(0, 6).map((f, i) => salvarImagem_(pasta, f, 'image/jpeg', 'Apontamento ' + req.n + ' - foto ' + (i + 1) + '.jpg'));
  const ass = ausente ? '' : salvarImagem_(pasta, req.assinatura, 'image/png', 'Apontamento ' + req.n + ' - assinatura.png');
  const g = req.geo || null;
  const mats = (req.materiais || []).filter(m => txt_(m.desc)).map(m => (txt_(m.qtd) ? txt_(m.qtd) + ' x ' : '') + txt_(m.desc)).join('; ');
  const campos = {
    'Fim': fim, 'Horas': horas, 'Tipo': tipo, 'Serviço executado': txt_(req.executado), 'Materiais utilizados': mats,
    'Fotos': fotos.join(','), 'Assinatura': ass, 'Assinado por': ausente ? '' : txt_(req.assinante), 'Cargo / setor de quem assinou': ausente ? '' : txt_(req.cargo),
    'Cliente ausente (motivo)': ausente, 'Lat. fim': g ? g.lat : '', 'Long. fim': g ? g.lng : '', 'Fim lançado em': agora,
    'Lançamento tardio': tardio_(fim, agora) ? 'Fim' : ''
  };
  Object.keys(campos).forEach(k => set_(b.ap, la._linha, k, campos[k]));

  // totais na OS
  const todos = ler_(ABA.apont).linhas.filter(x => txt_(x.get('Nº OS')) === numero);
  const total = Math.round(todos.reduce((s, x) => s + (Number(x.get('Horas')) || 0), 0) * 10000) / 10000;
  set_(b.os, lo._linha, 'Horas trabalhadas', total);
  set_(b.os, lo._linha, 'Apontamentos', todos.length);
  set_(b.os, lo._linha, 'Último apontamento', fim);

  let pdf, envio, link;
  const osInfo = resumoOS_(ler_(ABA.os).linhas.find(x => txt_(x.get('Nº OS')) === numero), todos);
  if (tipo === 'Final') {
    set_(b.os, lo._linha, 'Status', 'Finalizada');
    set_(b.os, lo._linha, 'Finalizada em', fim);
    set_(b.os, lo._linha, 'Pendências / recomendações', txt_(req.pendencias));
    set_(b.os, lo._linha, 'E-mails do cliente', emails.join(', '));
    const prevFim = data_(lo.get('Término previsto'));
    if (prevFim) set_(b.os, lo._linha, 'Prazo', fim.getTime() <= prevFim.getTime() ? 'Dentro do previsto' : 'Após o previsto');
    agendaFinal_(lo);
    osInfo.pendencias = txt_(req.pendencias); osInfo.status = 'Finalizada'; osInfo.finalizadaEm = fmt_(fim);
    pdf = pdfOS2_(osInfo, todos, 'final');
    link = pasta.createFile(pdf).getUrl();
    set_(b.os, lo._linha, 'PDF final', link);
    try { enviarOS2_(osInfo, pdf, emails, 'final', todos); envio = 'Enviada em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'); }
    catch (e) { envio = 'Erro no envio: ' + (e && e.message ? e.message : e); }
    set_(b.os, lo._linha, 'Envio', envio);
  } else {
    pdf = pdfOS2_(osInfo, todos.filter(x => txt_(x.get('Nº')) === txt_(req.n)), 'parcial');
    link = pasta.createFile(pdf).getUrl();
    try { enviarOS2_(osInfo, pdf, [], 'parcial', todos.filter(x => txt_(x.get('Nº')) === txt_(req.n))); envio = 'Enviado para a Kiton'; }
    catch (e) { envio = 'Erro no envio: ' + (e && e.message ? e.message : e); }
  }
  set_(b.ap, la._linha, 'PDF do apontamento', link);
  return { ok: true, numero, tipo, cliente: osInfo.cliente, horas, link, envio, enviada: !/^Erro/.test(envio), emails };
}

/** Ajusta o evento da agenda para o período real quando a OS termina. */
function agendaFinal_(lo) {
  const id = txt_(lo.get('Evento na agenda'));
  if (!id || id.indexOf('erro') === 0) return;
  try {
    const ev = CalendarApp.getCalendarById(AGENDA_GERAL).getEventById(id);
    if (ev) ev.setTitle('✓ ' + ev.getTitle().replace(/^✓ /, ''));
  } catch (e) { /* segue */ }
}

/** Encerra o atendimento no cliente: saída do check-in com o destino. */
function encerrarAtendimento_(u, req) {
  const ck = checkinAberto_(u);
  if (!ck) return { ok: true, semCheckin: true };
  if (sessaoAberta_(u)) throw new Error('Há uma OS em execução. Aponte o fim dela antes de sair do cliente.');
  const destino = ['Retorno à base', 'Ida para casa', 'Outro cliente'].indexOf(txt_(req.destino)) >= 0 ? txt_(req.destino) : '';
  if (!destino) throw new Error('Informe para onde vai.');
  const r = checkout_(u, { n: ck.n, horario: req.horario, geo: req.geo, obs: req.obs });
  const t = ler_(ABA.checkins);
  const l = t.linhas.find(x => txt_(x.get('Nº')) === txt_(ck.n));
  if (l && t.cab['Destino após saída'] !== undefined) set_(t, l._linha, 'Destino após saída', destino);
  return Object.assign(r, { cliente: ck.cliente, destino });
}

// ----- painel gerencial -----
function painelOS_(req) {
  const mes = txt_(req.mes);
  const b = baseOS_();
  const lista = b.os.linhas.map(l => resumoOS_(l, b.porOS[txt_(l.get('Nº OS'))]))
    .filter(o => {
      const ref = o.inicioPrevIso || '';
      const ab = data_(b.os.linhas.find(x => txt_(x.get('Nº OS')) === o.numero).get('Programada em'));
      return ['Programada', 'Em andamento'].indexOf(o.status) >= 0 || (ref ? ref.slice(0, 7) === mes : ab && Utilities.formatDate(ab, TZ, 'yyyy-MM') === mes);
    });
  // horas por técnico no mês (apontamentos do mês)
  const tecnicos = {};
  b.ap.linhas.forEach(a => {
    const d = data_(a.get('Início'));
    if (!d || Utilities.formatDate(d, TZ, 'yyyy-MM') !== mes) return;
    const os = b.os.linhas.find(x => txt_(x.get('Nº OS')) === txt_(a.get('Nº OS')));
    lista2_(a.get('Equipe')).forEach(n => {
      const p = tecnicos[n] || (tecnicos[n] = { nome: n, horas: 0, apontamentos: 0, os: {}, finalizadas: {}, noPrazo: 0, aposPrazo: 0, ausente: 0 });
      p.horas += Number(a.get('Horas')) || 0; p.apontamentos++; p.os[txt_(a.get('Nº OS'))] = 1;
      if (txt_(a.get('Cliente ausente (motivo)'))) p.ausente++;
      if (txt_(a.get('Tipo')) === 'Final' && os) {
        p.finalizadas[txt_(a.get('Nº OS'))] = 1;
        if (txt_(os.get('Prazo')) === 'Dentro do previsto') p.noPrazo++;
        if (txt_(os.get('Prazo')) === 'Após o previsto') p.aposPrazo++;
      }
    });
  });
  const porTecnico = Object.keys(tecnicos).sort().map(k => {
    const p = tecnicos[k];
    return { nome: p.nome, horas: Math.round(p.horas * 10) / 10, apontamentos: p.apontamentos, os: Object.keys(p.os).length,
      finalizadas: Object.keys(p.finalizadas).length, noPrazo: p.noPrazo, aposPrazo: p.aposPrazo, ausente: p.ausente };
  });
  return { ok: true, mes, lista: lista.reverse(), porTecnico };
}

// ----- PDF e e-mail -----
function esc_(s) { return txt_(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function quebra_(s) { return esc_(s).replace(/\n/g, '<br>'); }
function imgDrive_(id) {
  try { const bl = DriveApp.getFileById(id).getBlob(); return 'data:' + bl.getContentType() + ';base64,' + Utilities.base64Encode(bl.getBytes()); }
  catch (e) { return ''; }
}

/** Horas com resolução de minuto (ex.: 1,05 = 1 h 03 min). */
function horasDe_(a, b) { return Math.round(Math.round((b.getTime() - a.getTime()) / 60000) / 60 * 10000) / 10000; }
/** "7 min", "1 h 03 min", "12 h". */
function dur_(horas) {
  const m = Math.round((Number(horas) || 0) * 60);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), r = m % 60;
  return h + ' h' + (r ? ' ' + ('0' + r).slice(-2) + ' min' : '');
}

const LINK_MAPS = 'https://maps.app.goo.gl/xktin9wYpJhGkDfY8';
const SITE = 'www.kitonengenharia.com.br';
const WHATS_KITON = '554441410714', WHATS_RT = '5544997311914';

/** Resumo de execução da OS a partir dos apontamentos encerrados. */
function resumoExecucao_(aps) {
  const ord = aps.filter(a => txt_(a.get('Fim'))).sort((a, c) => (data_(a.get('Início')) || 0) - (data_(c.get('Início')) || 0));
  const equipe = {};
  ord.forEach(a => lista2_(a.get('Equipe')).forEach(n => equipe[n] = 1));
  const ini = ord.length ? data_(ord[0].get('Início')) : null, fim = ord.length ? data_(ord[ord.length - 1].get('Fim')) : null;
  return {
    ini, fim, total: ord.length, parciais: ord.filter(a => txt_(a.get('Tipo')) !== 'Final').length,
    horas: ord.reduce((s, a) => s + (Number(a.get('Horas')) || 0), 0), equipe: Object.keys(equipe), ord
  };
}
function dataHora_(d) { return d ? Utilities.formatDate(d, TZ, 'dd/MM/yyyy') + ' às ' + Utilities.formatDate(d, TZ, 'HH:mm') : '-'; }
function txtApont_(r) {
  return r.total + (r.total === 1 ? ' (finalização)' : ' (' + r.parciais + ' parcia' + (r.parciais === 1 ? 'l' : 'is') + ' e 1 de finalização)');
}

function pdfOS2_(o, aps, modo) {
  const linha = (rot, val) => val ? '<tr><td class="r">' + rot + '</td><td>' + quebra_(val) + '</td></tr>' : '';
  const bloco = (tit, val) => val ? '<div class="b"><div class="bt">' + tit + '</div><div class="bc">' + quebra_(val) + '</div></div>' : '';
  const r = resumoExecucao_(aps);
  const ordenados = modo === 'final' ? r.ord : aps;
  const varios = modo === 'final' && ordenados.length > 1;

  const paginaAp = (a, i) => {
    const mats = lista2_(txt_(a.get('Materiais utilizados')).replace(/;/g, ','));
    const fotos = lista2_(a.get('Fotos')).map(imgDrive_).filter(Boolean).slice(0, 6);
    const celulas = [0, 1, 2, 3, 4, 5].map(k => '<td>' + (fotos[k] ? '<img src="' + fotos[k] + '">' : '') + '</td>');
    const ass = txt_(a.get('Assinatura')) ? imgDrive_(txt_(a.get('Assinatura'))) : '';
    const ini = data_(a.get('Início')), fim = data_(a.get('Fim'));
    return '<div class="ap' + (varios ? ' quebra' : '') + '">' +
      '<div class="apt">' + (varios ? 'Apontamento ' + (i + 1) + ' de ' + ordenados.length + ' · ' : modo === 'parcial' ? 'Apontamento parcial · ' : '') +
      (ini ? Utilities.formatDate(ini, TZ, 'dd/MM/yyyy') : '') + ' · ' + (ini ? Utilities.formatDate(ini, TZ, 'HH:mm') : '') + ' às ' + (fim ? Utilities.formatDate(fim, TZ, 'HH:mm') : '') +
      ' · ' + dur_(a.get('Horas')) + (txt_(a.get('Tipo')) === 'Final' ? ' · Finalização' : ' · Parcial') + '</div>' +
      '<table class="d">' + linha('Equipe', lista2_(a.get('Equipe')).join(', ')) + '</table>' +
      bloco('Serviço executado', txt_(a.get('Serviço executado'))) +
      '<div class="b"><div class="bt">Materiais utilizados</div><div class="bc">' + (mats.length ? mats.map(esc_).join('<br>') : 'Nenhum material informado.') + '</div></div>' +
      '<div class="b"><div class="bt">Registro fotográfico</div><table class="f"><tr>' + celulas.slice(0, 3).join('') + '</tr><tr>' + celulas.slice(3).join('') + '</tr></table></div>' +
      '<div class="ass">' + (ass ? '<img src="' + ass + '"><div class="n">' + esc_(a.get('Assinado por')) + (txt_(a.get('Cargo / setor de quem assinou')) ? ' · ' + esc_(a.get('Cargo / setor de quem assinou')) : '') + '</div>' +
        '<div class="s">Assinado na tela do aparelho do técnico em ' + fmt_(a.get('Fim lançado em')) + (txt_(a.get('Lat. fim')) ? ' · localização ' + txt_(a.get('Lat. fim')) + ', ' + txt_(a.get('Long. fim')) : '') + '</div>'
        : '<div class="aus">Cliente ausente no momento do apontamento.</div><div class="s">Justificativa: ' + esc_(a.get('Cliente ausente (motivo)')) + '</div>') + '</div></div>';
  };

  const resumo = modo === 'final' ? '<div class="b"><div class="bt">Resumo da execução</div><table class="d">' +
    linha('Início', dataHora_(r.ini)) + linha('Finalização', dataHora_(r.fim)) + linha('Apontamentos', txtApont_(r)) +
    linha('Tempo total de execução', dur_(r.horas)) + linha('Técnicos envolvidos', r.equipe.join(', ')) + '</table></div>' +
    (varios ? '<table class="m"><tr><th>Nº</th><th>Data</th><th>Horário</th><th>Duração</th><th>Equipe</th><th>Assinatura</th></tr>' +
      ordenados.map((a, i) => { const x = data_(a.get('Início')), y = data_(a.get('Fim'));
        return '<tr><td>' + (i + 1) + (txt_(a.get('Tipo')) === 'Final' ? ' (final)' : '') + '</td><td>' + (x ? Utilities.formatDate(x, TZ, 'dd/MM/yyyy') : '') + '</td><td>' +
          (x ? Utilities.formatDate(x, TZ, 'HH:mm') : '') + ' às ' + (y ? Utilities.formatDate(y, TZ, 'HH:mm') : '') + '</td><td>' + dur_(a.get('Horas')) + '</td><td>' +
          esc_(lista2_(a.get('Equipe')).join(', ')) + '</td><td>' + (txt_(a.get('Cliente ausente (motivo)')) ? 'Cliente ausente' : esc_(a.get('Assinado por'))) + '</td></tr>'; }).join('') + '</table>' : '') +
    bloco('Pendências e recomendações', o.pendencias) : '';

  const titulo = modo === 'final' ? 'ORDEM DE SERVIÇO' : 'APONTAMENTO PARCIAL DA OS';
  const html = '<html><head><meta charset="utf-8"><style>' +
    '@page{size:A4;margin:12mm 13mm 14mm}body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#1c1f23}' +
    '.cab{width:100%;border-collapse:collapse;border-bottom:3px solid #CD0000;margin-bottom:8px}.cab td{vertical-align:middle;padding:0 0 6px}' +
    '.emp{font-size:8pt;color:#5d6670}.num{text-align:right}.num b{display:block;font-size:15pt}.num span{font-size:8.5pt;color:#5d6670}' +
    'table.d{width:100%;border-collapse:collapse;margin:2px 0 6px}table.d td{padding:3px 6px;border-bottom:1px solid #e6e9ed;vertical-align:top}' +
    'td.r{width:150px;color:#5d6670;font-size:8.5pt}' +
    '.b{margin:8px 0 6px;page-break-inside:avoid}.bt{font-weight:bold;font-size:10pt;color:#000000;border-bottom:2px solid #CD0000;padding:0 0 2px 0;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px}' +
    '.bc{border:1px solid #9aa3ad;padding:6px 8px;line-height:1.4}' +
    '.quebra{page-break-before:always}.apt{font-weight:bold;font-size:11pt;border-top:2px solid #1c1f23;padding-top:5px;margin:6px 0 4px}' +
    'table.f{width:100%;border-collapse:collapse;table-layout:fixed}table.f td{width:33.3%;height:150px;padding:3px;border:1px solid #9aa3ad;text-align:center;vertical-align:middle}' +
    'table.f img{max-width:100%;max-height:144px}' +
    'table.m{width:100%;border-collapse:collapse;margin:6px 0}table.m th,table.m td{border:1px solid #9aa3ad;padding:3px 5px;text-align:left;font-size:8.5pt}table.m th{font-weight:bold;border-bottom:2px solid #1c1f23}' +
    '.ass{margin-top:8px;border:1px solid #9aa3ad;padding:6px 8px;page-break-inside:avoid}.ass img{height:60px}.ass .n{border-top:1px solid #1c1f23;margin-top:2px;padding-top:3px;font-weight:bold}' +
    '.ass .s{font-size:8pt;color:#5d6670}.aus{color:#8A3B00;font-weight:bold;padding:14px 0 4px}' +
    '.rod{margin-top:10px;font-size:7.5pt;color:#5d6670;text-align:center;border-top:1px solid #e6e9ed;padding-top:5px}' +
    '</style></head><body>' +
    '<table class="cab"><tr><td><img src="data:image/png;base64,' + LOGO_B64 + '" style="width:170px;height:auto">' +
    '<div class="emp">' + esc_(EMPRESA.endereco) + '<br>' + esc_(EMPRESA.fone) + ' · ' + esc_(EMPRESA.email) + '</div></td>' +
    '<td class="num"><span>' + titulo + '</span><b>Nº ' + esc_(o.numero) + '</b><span>' + esc_(modo === 'final' ? 'Finalizada em ' + o.finalizadaEm : 'Situação: em andamento') + '</span></td></tr></table>' +
    '<table class="d">' + linha('Cliente', o.cliente) + linha('Local / setor', o.local) + linha('Solicitante', o.solicitante) + linha('Tipo de serviço', o.tipo) +
    linha('Programação', o.inicioPrev ? o.inicioPrev + (o.fimPrev ? ' a ' + o.fimPrev : '') : 'Aberta em campo') + '</table>' +
    bloco('Solicitação / problema relatado', o.solicitacao) + resumo + ordenados.map(paginaAp).join('') +
    '<div class="rod">' + esc_(EMPRESA.nome) + ' · CNPJ ' + esc_(EMPRESA.cnpj) + ' · Documento gerado pelo Kiton Hub</div></body></html>';
  const cli = o.cliente.replace(/[\\/:*?"<>|]/g, '');
  return Utilities.newBlob(html, 'text/html', 'OS.html').getAs('application/pdf')
    .setName(modo === 'final' ? 'OS ' + o.numero + ' - ' + cli + '.pdf' : 'OS ' + o.numero + ' - parcial ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HHmm') + ' - ' + cli + '.pdf');
}

/** E-mails dos colaboradores que participaram de algum apontamento (vão em cópia oculta). */
function emailsEquipe_(aps) {
  const nomes = {};
  aps.forEach(a => lista2_(a.get('Equipe')).forEach(n => nomes[n] = 1));
  return ler_(ABA.colab).linhas.filter(l => nomes[txt_(l.get('Nome'))] && emailValido_(l.get('E-mail'))).map(l => txt_(l.get('E-mail')));
}

function assinaturaEmail_() {
  const a = (url, t) => '<a href="' + url + '" style="color:#1c1f23;text-decoration:none">' + t + '</a>';
  return '<p style="margin:16px 0 0">Atenciosamente,</p>' +
    '<p style="margin:14px 0 0;line-height:1.5"><b>KITON ENGENHARIA INTEGRADA</b><br>CNPJ: 29.234.872/0001-04 | CREA-PR: 76327<br>' +
    a(LINK_MAPS, 'Av. Dr. Mário Clapier Urbinatti, 1434, Jardim Canadá, Maringá/PR, CEP 87.080-120') + '<br>' +
    'Tel./WhatsApp: ' + a('https://wa.me/' + WHATS_KITON, '(44) 4141-0714') + ' | ' + a('https://' + SITE, SITE) + '</p>' +
    '<p style="margin:14px 0 0;line-height:1.5"><b>Responsável técnico</b><br><b>Joaquim Bernardes Alves Neto</b><br>' +
    'Engenheiro Eletricista | Especialista em Automação Industrial e Eficiência Energética<br>CREA-PR: 153435/D<br>' +
    'Celular/WhatsApp: ' + a('https://wa.me/' + WHATS_RT, '(44) 99731-1914') + '<br>' + a('mailto:joaquim.neto@kitonengenharia.com.br', 'joaquim.neto@kitonengenharia.com.br') + '</p>';
}

function enviarOS2_(o, pdf, emails, modo, aps) {
  aps = aps || [];
  const r = resumoExecucao_(aps);
  const lin = (k, v) => v ? '<tr><td style="padding:3px 12px 3px 0;color:#5d6670;vertical-align:top">' + k + '</td><td style="padding:3px 0">' + quebra_(v) + '</td></tr>' : '';
  const tabela = '<table style="border-collapse:collapse;font-size:14px;margin:6px 0 4px">' +
    lin('Cliente', o.cliente) + lin('Local / setor', o.local) + lin('Tipo de serviço', o.tipo) +
    lin('Início', dataHora_(r.ini)) + (modo === 'final' ? lin('Finalização', dataHora_(r.fim)) : '') +
    lin('Apontamentos', modo === 'final' ? txtApont_(r) : r.total + ' até agora') + lin('Tempo total de execução', dur_(r.horas)) +
    lin('Técnicos envolvidos', r.equipe.join(', ')) + (modo === 'final' ? lin('Pendências e recomendações', o.pendencias) : '') + '</table>';
  const estilo = 'font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1c1f23;line-height:1.45';
  let assunto, corpo;
  if (modo === 'final') {
    assunto = 'Ordem de serviço nº ' + o.numero + ' finalizada | Kiton Engenharia Integrada | ' + o.cliente;
    corpo = '<div style="' + estilo + '"><p>Olá!</p><p>Eu sou o KAI, o assistente inteligente da Kiton Engenharia Integrada.</p>' +
      '<p>Esta é uma mensagem automática para informar que foi finalizada uma ordem de serviço referente à sua empresa. Em anexo, segue a cópia da ordem de serviço, ' +
      'com o registro de cada etapa, as fotos e as assinaturas. Abaixo, o resumo da execução.</p>' +
      '<p style="margin:16px 0 0"><b>Resumo da ordem de serviço nº ' + esc_(o.numero) + '</b></p>' + tabela +
      '<p>Agradecemos a confiança no trabalho da nossa equipe. Se tiver qualquer dúvida sobre o serviço realizado, basta responder este e-mail que retornaremos o mais breve possível.</p>' +
      '<p>Para conhecer as nossas soluções e saber como podemos ajudar a sua empresa a performar ainda melhor, acesse <a href="https://' + SITE + '">' + SITE + '</a> ' +
      'ou fale com a gente pelo WhatsApp <a href="https://wa.me/' + WHATS_KITON + '">(44) 4141-0714</a>.</p>' + assinaturaEmail_() + '</div>';
  } else {
    assunto = 'Apontamento parcial da OS nº ' + o.numero + ' | Kiton Hub | ' + o.cliente;
    corpo = '<div style="' + estilo + '"><p>Apontamento parcial registrado no Kiton Hub. Documento interno: não foi enviado ao cliente.</p>' +
      '<p style="margin:12px 0 0"><b>OS nº ' + esc_(o.numero) + '</b></p>' + tabela + '</div>';
  }
  const opc = { htmlBody: corpo, attachments: [pdf], name: 'Kiton Engenharia Integrada', replyTo: EMAIL_KITON };
  if (modo === 'final') {
    const bcc = emailsEquipe_(aps).filter(e => emails.indexOf(e) < 0);
    if (bcc.length) opc.bcc = bcc.join(',');
    if (emails.length) { opc.cc = EMAIL_KITON; MailApp.sendEmail(emails.join(','), assunto, assunto, opc); }
    else MailApp.sendEmail(EMAIL_KITON, assunto, assunto, opc);
  } else MailApp.sendEmail(EMAIL_KITON, assunto, assunto, opc);
}

function reenviarOS_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  const id = (txt_(l.get('PDF final')).match(/[-\w]{25,}/) || [])[0];
  if (!id) throw new Error('PDF final da OS não encontrado.');
  const aps = ler_(ABA.apont).linhas.filter(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  const o = resumoOS_(l, aps);
  enviarOS2_(o, DriveApp.getFileById(id).getBlob(), lista2_(l.get('E-mails do cliente')), 'final', aps);
  set_(t, l._linha, 'Envio', 'Reenviada em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') + ' por ' + u.nome);
  return { ok: true };
}

// ---------- despesas ----------

function criarDespesa_(u, d) {
  const valor = Number(d.valor);
  if (!(valor > 0)) throw new Error('Informe o valor da despesa.');
  if (!txt_(d.categoria)) throw new Error('Escolha a categoria.');
  const data = txt_(d.data) ? Utilities.parseDate(txt_(d.data), TZ, 'yyyy-MM-dd') : new Date();
  if (isNaN(data)) throw new Error('Data inválida.');
  if (data.getTime() > Date.now() + 864e5) throw new Error('A data não pode ser no futuro.');
  const t = ler_(ABA.despesas);
  const n = proximoNumero_(t, 'Nº');
  let link = '';
  const foto = blobDe_(d.foto, 'image/jpeg', 'Despesa ' + n + ' - ' + u.nome + '.jpg');
  if (foto) link = pasta_(['Kiton Hub', 'Comprovantes de despesas', Utilities.formatDate(data, TZ, 'yyyy-MM')]).createFile(foto).getUrl();
  anexar_(t, {
    'Nº': n, 'Data': data, 'Colaborador': u.nome, 'Categoria': txt_(d.categoria), 'Valor (R$)': valor,
    'Pagamento': txt_(d.pagamento) || 'Paguei do meu bolso (reembolso)', 'Cliente / obra': txt_(d.cliente), 'Descrição': txt_(d.descricao),
    'Comprovante': link || 'sem comprovante', 'Saída vinculada': txt_(d.saida), 'Lançado em': new Date(), 'Situação': 'Aguardando conferência'
  });
  return { n, link };
}

function salvarDespesa_(u, req) {
  if (!txt_(req.foto) && !txt_(req.semFotoMotivo)) throw new Error('Tire a foto do comprovante ou diga por que não tem.');
  const r = criarDespesa_(u, {
    data: req.data, categoria: req.categoria, valor: req.valor, pagamento: req.pagamento, cliente: req.cliente,
    descricao: [txt_(req.descricao), txt_(req.semFotoMotivo) ? 'Sem comprovante: ' + txt_(req.semFotoMotivo) : ''].filter(Boolean).join(' | '),
    foto: req.foto
  });
  return { ok: true, n: r.n };
}

function resumoDespesa_(l) {
  return {
    n: txt_(l.get('Nº')), data: dia_(l.get('Data')), colaborador: txt_(l.get('Colaborador')), categoria: txt_(l.get('Categoria')),
    valor: Number(l.get('Valor (R$)')) || 0, pagamento: txt_(l.get('Pagamento')), cliente: txt_(l.get('Cliente / obra')),
    descricao: txt_(l.get('Descrição')), comprovante: txt_(l.get('Comprovante')), situacao: txt_(l.get('Situação')),
    motivo: txt_(l.get('Motivo da recusa')), saida: txt_(l.get('Saída vinculada'))
  };
}

function minhasDespesas_(u) {
  const lista = ler_(ABA.despesas).linhas.filter(l => txt_(l.get('Colaborador')) === u.nome).slice(-40).reverse().map(resumoDespesa_);
  return { ok: true, lista };
}

function despesasPendentes_() {
  const lista = ler_(ABA.despesas).linhas.filter(l => txt_(l.get('Situação')) === 'Aguardando conferência').map(resumoDespesa_);
  return { ok: true, lista };
}

function conferirDespesa_(u, req) {
  const t = ler_(ABA.despesas);
  const l = t.linhas.find(x => txt_(x.get('Nº')) === txt_(req.n));
  if (!l) throw new Error('Despesa não encontrada.');
  if (['Aprovada', 'Recusada'].indexOf(req.resultado) < 0) throw new Error('Resultado inválido.');
  if (req.resultado === 'Recusada' && !txt_(req.motivo)) throw new Error('Informe o motivo da recusa.');
  set_(t, l._linha, 'Situação', req.resultado);
  set_(t, l._linha, 'Conferido por', u.nome);
  set_(t, l._linha, 'Data da conferência', new Date());
  if (req.resultado === 'Recusada') set_(t, l._linha, 'Motivo da recusa', txt_(req.motivo));
  return { ok: true };
}

/** Marca como reembolsadas as despesas aprovadas de uma pessoa no mês. */
function marcarReembolso_(req) {
  const t = ler_(ABA.despesas);
  let total = 0, qtd = 0;
  t.linhas.forEach(l => {
    const d = data_(l.get('Data'));
    if (!d || Utilities.formatDate(d, TZ, 'yyyy-MM') !== txt_(req.mes)) return;
    if (txt_(l.get('Colaborador')) !== txt_(req.nome) || txt_(l.get('Situação')) !== 'Aprovada' || !/reembolso/i.test(txt_(l.get('Pagamento')))) return;
    set_(t, l._linha, 'Situação', 'Reembolsada');
    set_(t, l._linha, 'Reembolsado em', new Date());
    total += Number(l.get('Valor (R$)')) || 0; qtd++;
  });
  return { ok: true, total, qtd };
}

// ---------- cadastro de itens pelo app ----------

function prefixo_(pat) { return txt_(pat).split('-').slice(0, 2).join('-'); }

function cadastroInfo_(req) {
  const itens = ler_(ABA.itens).linhas.filter(l => txt_(l.get('Patrimônio')));
  const grupos = {};
  itens.forEach(l => {
    const g = txt_(l.get('Grupo')) || txt_(l.get('Descrição'));
    const x = grupos[g] || (grupos[g] = { grupo: g, tipo: txt_(l.get('Tipo')), desc: txt_(l.get('Descrição')), prefixos: {}, qtd: 0 });
    x.prefixos[prefixo_(l.get('Patrimônio'))] = 1; x.qtd++;
  });
  const usados = {};
  itens.forEach(l => { const pf = prefixo_(l.get('Patrimônio')); usados[pf] = Math.max(usados[pf] || 0, Number(txt_(l.get('Patrimônio')).split('-')[2]) || 0); });
  const locais = {};
  itens.forEach(l => { const x = txt_(l.get('Local de guarda')); if (x) locais[x] = 1; });
  return {
    ok: true,
    grupos: Object.keys(grupos).sort().map(k => ({ grupo: k, tipo: grupos[k].tipo, desc: grupos[k].desc, qtd: grupos[k].qtd, prefixos: Object.keys(grupos[k].prefixos) })),
    ultimos: usados,
    tipos: lista_('Tipo'), usos: lista_('Uso'), estados: lista_('Estado'), legendaEstado: lista_('Legenda do estado'), periodicidades: lista_('Periodicidade'),
    colaboradores: ler_(ABA.colab).linhas.filter(l => txt_(l.get('Ativo')) === 'Sim').map(l => txt_(l.get('Nome'))),
    kits: itens.filter(l => txt_(l.get('Tipo')) === 'Kit').map(l => ({ pat: txt_(l.get('Patrimônio')), desc: txt_(l.get('Descrição')) })),
    locais: Object.keys(locais).sort()
  };
}

function novoItem_(u, req) {
  const pf = txt_(req.prefixo).toUpperCase();
  if (!/^[A-Z]{3}-[A-Z]{3}$/.test(pf)) throw new Error('O início do código precisa ter o formato AAA-BBB (3 letras, hífen, 3 letras).');
  if (!txt_(req.descricao)) throw new Error('Informe a descrição.');
  if (lista_('Tipo').indexOf(txt_(req.tipo)) < 0) throw new Error('Escolha o tipo.');
  const uso = txt_(req.uso) || 'Coletivo';
  if (uso === 'Individual' && !txt_(req.responsavel)) throw new Error('Item de uso individual precisa de responsável.');
  const t = ler_(ABA.itens);
  const ult = t.linhas.filter(l => prefixo_(l.get('Patrimônio')) === pf).reduce((m, l) => Math.max(m, Number(txt_(l.get('Patrimônio')).split('-')[2]) || 0), 0);
  const qtd = Math.max(1, Math.min(20, Number(req.quantidade) || 1));
  const criados = [];
  const identBase = Number(req.ident);
  // a aba Itens tem fórmulas em coluna inteira (calibração): grava célula a célula na primeira linha livre
  let linha = t.linhas.reduce((m, l) => Math.max(m, l._linha), 1);
  for (let i = 0; i < qtd; i++) {
    const pat = pf + '-' + ('00' + (ult + 1 + i)).slice(-3);
    linha++;
    const campos = {
      'Patrimônio': pat, 'Descrição': txt_(req.descricao), 'Tipo': txt_(req.tipo), 'Grupo': txt_(req.grupo),
      'Nº pintado / gravado': qtd > 1 && !isNaN(identBase) && txt_(req.ident) ? identBase + i : txt_(req.ident),
      'Uso': uso, 'Responsável (uso individual)': uso === 'Individual' ? txt_(req.responsavel) : '', 'Kit (patrimônio do kit)': txt_(req.kit),
      'Marca / modelo': txt_(req.marca), 'Nº de série': qtd > 1 ? '' : txt_(req.serie), 'Estado': txt_(req.estado),
      'Valor de reposição (R$)': req.valor ? Number(req.valor) : '', 'Data de aquisição': txt_(req.aquisicao) ? Utilities.parseDate(txt_(req.aquisicao), TZ, 'yyyy-MM-dd') : '',
      'Local de guarda': txt_(req.local), 'Situação': 'Disponível', 'Periodicidade': txt_(req.periodicidade),
      'Observações': ['Cadastrado pelo app por ' + u.nome + ' em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy'), txt_(req.obs)].filter(Boolean).join(' | ')
    };
    Object.keys(campos).forEach(k => { if (campos[k] !== '' && t.cab[k] !== undefined) set_(t, linha, k, campos[k]); });
    criados.push(pat);
  }
  return { ok: true, criados };
}

/** Rode uma vez pelo editor para autorizar o script e conferir a leitura da planilha. */
function testarConfiguracao() {
  [ABA.itens, ABA.colab, ABA.clientes, ABA.saidas, ABA.itensSaida, ABA.listas, ABA.checkins, ABA.os, ABA.apont, ABA.despesas].forEach(n => {
    Logger.log(n + ': ' + ler_(n).linhas.length + ' linhas');
  });
  segredo_();
  // pede as permissões de Drive (PDF da OS e comprovantes) e de e-mail (envio da OS)
  Logger.log('Pasta: ' + pasta_(['Kiton Hub']).getName());
  Logger.log('Cota de e-mails hoje: ' + MailApp.getRemainingDailyQuota());
  // pede a permissão da agenda (eventos das OS programadas na agenda GERAL)
  Logger.log('Agenda: ' + CalendarApp.getCalendarById(AGENDA_GERAL).getName());
  Logger.log('Tudo certo.');
}

// Logo da Kiton para o cabeçalho do PDF da OS (PNG 360 px)
const LOGO_B64 = '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';
