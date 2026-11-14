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
const VERSAO_APP = '1.0 beta'; // mesma versão exibida no rodapé do app
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
    'E-mails do cliente', 'Envio', 'PDF final', 'Motivo do cancelamento', 'Observações', 'APR no PDF do cliente', 'Revisão', 'Histórico de revisões', 'Reaberta', 'PDF com APR completa', 'Aprovada por', 'Aprovada em', 'Devolvida'],
  'Apontamentos de OS': ['Nº', 'Nº OS', 'Início', 'Fim', 'Horas', 'Tipo', 'Equipe', 'Serviço executado', 'Materiais utilizados', 'Fotos',
    'Assinatura', 'Assinado por', 'Cargo / setor de quem assinou', 'Cliente ausente (motivo)', 'PDF do apontamento', 'Check-in',
    'Lat. início', 'Long. início', 'Lat. fim', 'Long. fim', 'Registrado por', 'Iniciado lançado em', 'Fim lançado em', 'Lançamento tardio'],
  'APR': ['Nº APR', 'Data', 'Nº OS', 'Apontamento', 'Cliente', 'Tipo de serviço', 'Registrado por', 'Responsável pela atividade', 'Equipe', 'Modelo',
    'Triagem', 'PT', 'Nº da PT', 'Foto da PT', 'Emissor da PT', 'Condição da instalação', 'Justificativa (energizado)', 'Respostas',
    'Riscos adicionais e medidas', 'Impedimentos', 'Situação', 'Decisão por', 'Justificativa da decisão', 'Data da decisão', 'Lat.', 'Long.',
    'Ciência do cliente', 'Dados da OS'],
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
    case 'fotosAp': exigirAdmin_(u); return fotosAp_(req);
    case 'verAPR': return verAPR_(u, req);
    case 'pdfComAPR': return comTrava_(() => pdfComAPR_(u, req));
    case 'aprovarOS': exigirAdmin_(u); return comTrava_(() => aprovarOS_(u, req));
    case 'devolverOS': exigirAdmin_(u); return comTrava_(() => devolverOS_(u, req));
    case 'pdfAPR': return pdfAPR_(u, req);
    case 'corrigirOS': exigirAdmin_(u); return comTrava_(() => corrigirOS_(u, req));
    case 'reabrirOS': exigirAdmin_(u); return comTrava_(() => reabrirOS_(u, req));
    case 'aprPainel': exigirAdmin_(u); return aprPainel_();
    case 'decidirAPR': exigirAdmin_(u); return comTrava_(() => decidirAPR_(u, req));
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
    materiais: (() => { try { if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Materiais')) return [];
      return ler_('Materiais').linhas.filter(l => txt_(l.get('Descrição'))).map(l => ({ sku: txt_(l.get('Código (SKU)')), ean: txt_(l.get('Código de barras (EAN)')), desc: txt_(l.get('Descrição')), un: txt_(l.get('Unidade')) })); }
      catch (e) { return []; } })(),
    apr: { secoes: APR_SECOES, itens: APR_ITENS, riscos: APR_RISCOS, condicoes: APR_CONDICOES, triagem: APR_TRIAGEM, reduzida: tiposAprReduzida_(), treinos: TREINOS.map(x => x[0]) },
    treinamentos: (() => { const tr = treinamentos_(), o = {}; equipeCampo.forEach(n => { o[n] = {}; TREINOS.forEach(([k]) => { const d = (tr[n] || {})[k]; o[n][k] = d ? dia_(d) : ''; }); }); return o; })(),
    meusTreinos: (() => { const d = treinamentos_()[u.nome] || {}; return TREINOS.map(([k]) => ({ k, venc: d[k] ? dia_(d[k]) : '', dias: diasAte_(d[k]) }))
      .filter(x => x.dias !== null && x.dias <= AVISO_TREINO_DIAS); })(),
    categoriasDespesa: lista_('Categoria de despesa'),
    pagamentosDespesa: lista_('Pagamento de despesa')
  };
}

function pendenciasAdmin_() {
  return {
    itens: ler_(ABA.itensSaida).linhas.filter(l => ['Aguardando conferência', 'Avariado', 'Extraviado'].indexOf(txt_(l.get('Situação'))) >= 0 && !txt_(l.get('Conferido por'))).length,
    despesas: ler_(ABA.despesas).linhas.filter(l => txt_(l.get('Situação')) === 'Aguardando conferência').length,
    clientes: pendentesCliente_().length,
    os: (() => { const b = baseOS_(); return b.os.linhas.map(l => resumoOS_(l, b.porOS[txt_(l.get('Nº OS'))])).filter(o => o.atrasada || o.parada).length; })(),
    apr: aprBloqueadas_().length,
    aprovar: ler_(ABA.os).linhas.filter(l => txt_(l.get('Status')) === ST_APROVACAO).length,
    treinos: situacaoTreinos_().filter(p => p.itens.some(i => i.dias !== null && i.dias <= AVISO_TREINO_DIAS)).length
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
    aprovacaoAtrasada: status === ST_APROVACAO && !!data_(l.get('Finalizada em')) && agora.getTime() - data_(l.get('Finalizada em')).getTime() > 24 * 36e5,
    parada: status === 'Em andamento' && !emExecucao && !!ultimo && agora.getTime() - ultimo.getTime() > DIAS_PARADA * 864e5,
    inicioVsPrevisto: txt_(l.get('Início x programado')), prazo: txt_(l.get('Prazo')),
    pdf: txt_(l.get('PDF final')), envio: txt_(l.get('Envio')), emails: txt_(l.get('E-mails do cliente')),
    pendencias: txt_(l.get('Pendências / recomendações')), motivoCancel: txt_(l.get('Motivo do cancelamento')),
    observacoes: txt_(l.get('Observações')), aprovadaPor: txt_(l.get('Aprovada por')), aprovadaEm: fmt_(l.get('Aprovada em')), devolvida: Number(l.get('Devolvida')) || 0,
    aprNoPdf: txt_(l.get('APR no PDF do cliente')), revisao: Number(l.get('Revisão')) || 0, historico: txt_(l.get('Histórico de revisões')), reaberta: Number(l.get('Reaberta')) || 0
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
  const finalizadas = b.os.linhas.filter(l => ['Finalizada', ST_APROVACAO].indexOf(txt_(l.get('Status'))) >= 0).map(l => resumoOS_(l, b.porOS[txt_(l.get('Nº OS'))]))
    .filter(o => o.envolvidos.indexOf(u.nome) >= 0).slice(-10).reverse();
  return { ok: true, abertas, finalizadas, sessao: sessaoAberta_(u, b), aprs: minhasAPR_(u) };
}

function detalheOS_(u, req) {
  const b = baseOS_();
  const l = b.os.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  const aps = b.porOS[txt_(req.numero)] || [];
  const aprs = aprPorApontamento_();
  return { ok: true, os: resumoOS_(l, aps), apontamentos: aps.map(a => Object.assign(resumoAp_(a), { apr: aprs[txt_(a.get('Nº'))] ? txt_(aprs[txt_(a.get('Nº'))].get('Nº APR')) : '' })) };
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
  if (['Finalizada', 'Cancelada', ST_APROVACAO].indexOf(st) >= 0) throw new Error('OS ' + st.toLowerCase() + ' não pode ser alterada.');
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
  if (['Finalizada', 'Cancelada', ST_APROVACAO].indexOf(txt_(l.get('Status'))) >= 0) throw new Error('Esta OS já está ' + txt_(l.get('Status')).toLowerCase() + '.');
  if (!txt_(req.motivo)) throw new Error('Informe o motivo do cancelamento.');
  const ap = ler_(ABA.apont);
  if (ap.linhas.some(x => txt_(x.get('Nº OS')) === txt_(req.numero) && !txt_(x.get('Fim')))) throw new Error('Há um apontamento em execução. Peça para o técnico apontar antes.');
  if (Number(l.get('Reaberta')) > 0) throw new Error('OS reaberta não pode ser cancelada: o cliente já recebeu a versão finalizada. Finalize com um novo apontamento.');
  set_(t, l._linha, 'Status', 'Cancelada');
  set_(t, l._linha, 'Motivo do cancelamento', txt_(req.motivo) + ' (' + u.nome + ', ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy') + ')');
  agendaApagar_(txt_(l.get('Evento na agenda')));
  return { ok: true };
}

// ----- iniciar -----
function iniciarOS_(u, req) {
  const b = baseOS_();
  if (sessaoAberta_(u, b)) throw new Error('Você já tem uma OS em execução. Aponte o fim dela antes de iniciar outra.');
  // APR liberada por exceção: retoma os dados guardados no bloqueio
  let aprLib = null;
  if (txt_(req.aprN)) {
    const ta = ler_('APR');
    aprLib = ta.linhas.find(x => txt_(x.get('Nº APR')) === txt_(req.aprN));
    if (!aprLib) throw new Error('APR não encontrada.');
    if (txt_(aprLib.get('Registrado por')) !== u.nome) throw new Error('Esta APR foi registrada por outra pessoa.');
    if (txt_(aprLib.get('Situação')) !== 'Liberada por exceção' || txt_(aprLib.get('Apontamento'))) throw new Error('Esta APR não está liberada para uso.');
    let dados = {};
    try { dados = JSON.parse(txt_(aprLib.get('Dados da OS')) || '{}'); } catch (e) { /* segue */ }
    req = Object.assign({}, dados, { horario: req.horario, geo: req.geo || dados.geo, aprN: req.aprN });
  }
  let numero = txt_(req.numero), l = null, cliente, tipo;
  const equipe = [u.nome].concat((req.equipe || []).map(txt_).filter(n => n && n !== u.nome));
  if (numero) {
    l = b.os.linhas.find(x => txt_(x.get('Nº OS')) === numero);
    if (!l) throw new Error('OS não encontrada.');
    if (['Finalizada', 'Cancelada', ST_APROVACAO].indexOf(txt_(l.get('Status'))) >= 0) throw new Error('Esta OS já está ' + txt_(l.get('Status')).toLowerCase() + '.');
    if (b.ap.linhas.some(x => txt_(x.get('Nº OS')) === numero && !txt_(x.get('Fim')))) throw new Error('Esta OS já está em execução por outra pessoa.');
    cliente = txt_(l.get('Cliente')); tipo = txt_(l.get('Tipo de serviço'));
  } else {
    cliente = txt_(req.cliente); tipo = txt_(req.tipo);
    if (!cliente) throw new Error('Escolha o cliente.');
    if (!tipo) throw new Error('Escolha o tipo de serviço.');
  }
  let ck = checkinAberto_(u);
  if (ck && ck.cliente !== cliente) throw new Error('Você está com check-in aberto em ' + ck.cliente + '. Registre a saída de lá antes.');

  // APR: avalia antes de qualquer gravação; impedimento bloqueia o início
  let av = null;
  const ctx = { numero, cliente, tipo, equipe, geo: req.geo };
  if (!aprLib) {
    av = avaliarAPR_(req.apr, equipe, tipo);
    if (av.impedimentos.length) {
      const dados = {}; ['numero', 'cliente', 'novo', 'cidade', 'tipo', 'local', 'solicitante', 'solicitacao', 'equipe', 'geo'].forEach(k => { if (req[k] !== undefined) dados[k] = req[k]; });
      const nApr = gravarAPR_(u, req.apr, av, Object.assign({ dados }, ctx), 'Bloqueada');
      const resumo = avisarBloqueio_(nApr, ctx, u, av.impedimentos);
      return { ok: true, bloqueada: true, apr: nApr, impedimentos: av.impedimentos, resumo };
    }
  }

  // check-in: reaproveita o aberto no mesmo cliente; abre um novo se não houver
  const agora = new Date();
  const quando = horarioInformado_(req.horario, agora);
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
      'Tipo de serviço': tipo, 'Solicitação / problema': txt_(req.solicitacao), 'Técnicos designados': equipe.join(', '),
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
  // APR: vincula ao apontamento
  let nApr;
  if (aprLib) {
    const ta = ler_('APR');
    const la2 = ta.linhas.find(x => txt_(x.get('Nº APR')) === txt_(req.aprN));
    set_(ta, la2._linha, 'Nº OS', numero); set_(ta, la2._linha, 'Apontamento', n); set_(ta, la2._linha, 'Cliente', cliente);
    nApr = txt_(req.aprN);
  } else {
    substituirBloqueios_(u, txt_(req.numero), cliente);
    nApr = gravarAPR_(u, req.apr, av, Object.assign({}, ctx, { numero, cliente, apontamento: n }), 'Liberada');
  }
  return { ok: true, numero, apontamento: n, apr: nApr, cliente, quando: fmt_(quando), checkinNovo: !!ckInfo, situacao: ckInfo ? ckInfo.situacao : '', dist: ckInfo ? ckInfo.dist : '' };
}

// ---------- APR (análise preliminar de risco) antes de iniciar a OS ----------
// Base: NR-10 (Portaria MTE 737/2026, itens 10.7.3 e 10.7.4). Itens com imp: true bloqueiam o início quando a resposta for "Não".
// modelo: 'A' = completa e reduzida; 'C' = só completa. cond: só aparece para a condição da instalação indicada.
const APR_SECOES = [
  ['B', 'Avaliação prévia do local'], ['C', 'Isolamento e sinalização'], ['D', 'Condição da instalação'],
  ['E', 'EPI e EPC'], ['G', 'Emergência'], ['H', 'Comunicação']
];
const APR_ITENS = [
  { id: 'b1', s: 'B', t: 'Atividade e escopo compreendidos pela equipe?', imp: true, m: 'A' },
  { id: 'b2', s: 'B', t: 'Local avaliado antes do início?', imp: true, m: 'A' },
  { id: 'b3', s: 'B', t: 'Condições do ambiente adequadas (umidade, chuva, iluminação, espaço)?', m: 'A' },
  { id: 'c1', s: 'C', t: 'Área delimitada e sinalizada (caso necessário)?', m: 'C' },
  { id: 'd1', s: 'D', t: 'Seccionamento, bloqueio e etiquetagem realizados?', imp: true, m: 'C', cond: 'Desenergizada' },
  { id: 'd2', s: 'D', t: 'Teste de ausência de tensão realizado?', imp: true, m: 'C', cond: 'Desenergizada' },
  { id: 'd3', s: 'D', t: 'Aterramento temporário instalado?', m: 'C', cond: 'Desenergizada' },
  { id: 'd4', s: 'D', t: 'Partes energizadas próximas protegidas?', m: 'C', cond: 'Desenergizada' },
  { id: 'e2', s: 'D', t: 'Procedimento específico disponível e conhecido pela equipe?', imp: true, m: 'C', cond: 'Energizada' },
  { id: 'e3', s: 'D', t: 'Ferramentas isoladas e inspecionadas?', imp: true, m: 'C', cond: 'Energizada' },
  { id: 'p1', s: 'E', t: 'Vestimenta antichama compatível com o risco?', imp: true, m: 'C' },
  { id: 'p2', s: 'E', t: 'Luvas isolantes inspecionadas (se houver contato com partes energizadas)?', m: 'C' },
  { id: 'p3', s: 'E', t: 'Capacete, óculos ou protetor facial e calçado de segurança?', m: 'A' },
  { id: 'p4', s: 'E', t: 'Instrumento usado no teste de ausência de tensão (detector, multímetro, alicate ou outro) verificado antes do uso?', m: 'C', impCond: 'Desenergizada' },
  { id: 'p5', s: 'E', t: 'Tapete isolante ou outro EPC aplicável?', m: 'C' },
  { id: 'g1', s: 'G', t: 'Rota de fuga identificada?', m: 'A' },
  { id: 'g2', s: 'G', t: 'Extintor próximo?', m: 'A' },
  { id: 'g3', s: 'G', t: 'Contato de emergência do cliente conhecido?', m: 'A' },
  { id: 'g4', s: 'G', t: 'Pessoa com treinamento em primeiros socorros na equipe ou no local?', m: 'A' },
  { id: 'h1', s: 'H', t: 'Responsável do cliente informado do início?', m: 'A' }
];
const APR_RISCOS = ['Trabalho em altura', 'Espaço confinado', 'Máquinas em movimento', 'Calor', 'Produtos químicos', 'Ruído'];
const APR_CONDICOES = ['Desenergizada', 'Energizada', 'Sem intervenção elétrica'];
const APR_TRIAGEM = [
  ['zona', 'Haverá abertura de painel ou aproximação de partes energizadas (zona controlada)?'],
  ['altura', 'Haverá trabalho em altura acima de 2 m?'],
  ['confinado', 'Haverá trabalho em espaço confinado?'],
  ['sep', 'O serviço é em SEP (subestação, rede de média ou alta tensão)?']
];
const TREINOS = [['NR-10', 'Venc. NR-10'], ['NR-10 SEP', 'Venc. NR-10 SEP'], ['NR-33', 'Venc. NR-33'], ['NR-35', 'Venc. NR-35'], ['ASO', 'Venc. ASO']];
const AVISO_TREINO_DIAS = 30;

function tiposAprReduzida_() { return lista_('Tipos de OS com APR reduzida'); }

/** Vencimentos de treinamento por colaborador: {nome: {'NR-10': Date|null, ...}} */
function treinamentos_() {
  const r = {};
  ler_(ABA.colab).linhas.forEach(l => {
    const o = {};
    TREINOS.forEach(([k, col]) => { o[k] = data_(l.get(col)); });
    r[txt_(l.get('Nome'))] = o;
  });
  return r;
}

function diasAte_(d) {
  if (!d) return null;
  const h = new Date(); h.setHours(0, 0, 0, 0);
  const x = new Date(d.getTime()); x.setHours(0, 0, 0, 0);
  return Math.round((x.getTime() - h.getTime()) / 864e5);
}

/** Treinamentos exigidos pela APR. */
function treinosExigidos_(apr) {
  const t = apr.triagem || {};
  const req = ['ASO'];
  if (apr.modelo === 'Completa') req.push('NR-10');
  if (t.sep) req.push('NR-10 SEP');
  if (t.confinado) req.push('NR-33');
  if (t.altura) req.push('NR-35');
  return req;
}

/** Valida as respostas e devolve {modelo, impedimentos, textoRespostas, ...}. Não grava nada. */
function avaliarAPR_(apr, equipe, tipoOS) {
  if (!apr || typeof apr !== 'object') throw new Error('Preencha a APR antes de iniciar.');
  const pt = ['Sim', 'Não', 'Não se aplica'].indexOf(txt_(apr.pt)) >= 0 ? txt_(apr.pt) : '';
  if (!pt) throw new Error('Informe se o serviço possui PT emitida pelo cliente.');
  if (pt === 'Sim' && !txt_(apr.ptNumero) && !txt_(apr.ptFoto) && !txt_(apr.ptEmissor)) throw new Error('Informe o número da PT, a foto da PT ou quem a emitiu.');
  const tri = {};
  APR_TRIAGEM.forEach(([k]) => {
    const v = apr.triagem ? apr.triagem[k] : undefined;
    if (v !== true && v !== false) throw new Error('Responda todas as perguntas da triagem.');
    tri[k] = v;
  });
  const reduzidaPermitida = tiposAprReduzida_().indexOf(txt_(tipoOS)) >= 0 && !tri.zona && !tri.altura && !tri.confinado && !tri.sep;
  const modelo = reduzidaPermitida && apr.modelo === 'Reduzida' ? 'Reduzida' : 'Completa';
  const responsavel = txt_(apr.responsavel);
  if (equipe.indexOf(responsavel) < 0) throw new Error('Escolha o responsável pela atividade entre os executores.');
  let condicao = '';
  if (modelo === 'Completa') {
    condicao = APR_CONDICOES.indexOf(txt_(apr.condicao)) >= 0 ? txt_(apr.condicao) : '';
    if (!condicao) throw new Error('Informe a condição da instalação.');
    if (tri.zona && condicao === 'Sem intervenção elétrica') throw new Error('A triagem indicou zona controlada: escolha Desenergizada ou Energizada.');
  }
  const imped = [];
  if (condicao === 'Energizada' && !txt_(apr.justificativa)) imped.push('Trabalho energizado sem justificativa registrada');
  const resp = apr.respostas || {};
  const linhas = [];
  APR_ITENS.forEach(it => {
    if (modelo === 'Reduzida' && it.m !== 'A') return;
    if (it.cond && it.cond !== condicao) return;
    const v = txt_(resp[it.id]);
    if (['Sim', 'Não', 'N/A'].indexOf(v) < 0) throw new Error('Responda todos os itens da APR (falta: ' + it.t + ').');
    linhas.push(it.t + ' ' + v);
    if ((it.imp || it.impCond === condicao) && v === 'Não') imped.push(it.t.replace(/\?$/, '') + ': Não');
  });
  const riscos = [];
  if (modelo === 'Completa') {
    (apr.riscos || []).forEach(r => {
      if (APR_RISCOS.indexOf(txt_(r.risco)) < 0) return;
      if (!txt_(r.medida)) throw new Error('Informe a medida adotada para: ' + r.risco + '.');
      riscos.push(txt_(r.risco) + ': ' + txt_(r.medida));
    });
  }
  if (apr.declaracao !== true) throw new Error('Confirme a declaração de liberação.');
  // treinamentos (automático, pelo cadastro)
  const tr = treinamentos_();
  treinosExigidos_({ modelo, triagem: tri }).forEach(k => equipe.forEach(n => {
    const d = (tr[n] || {})[k];
    if (!d) imped.push(n + ': ' + k + ' sem vencimento cadastrado');
    else if (diasAte_(d) < 0) imped.push(n + ': ' + k + ' vencido em ' + dia_(d));
  }));
  return {
    modelo, pt, triagem: tri, responsavel, condicao, impedimentos: imped, respostas: linhas.join('\n'), riscos: riscos.join('\n'),
    triagemTxt: APR_TRIAGEM.map(([k, t]) => t + ' ' + (tri[k] ? 'Sim' : 'Não')).join('\n')
  };
}

/** Grava a APR e devolve o nº. */
function gravarAPR_(u, apr, av, ctx, situacao) {
  const t = ler_('APR');
  const n = proximoNumero_(t, 'Nº APR');
  const agora = new Date();
  let foto = '';
  if (txt_(apr.ptFoto)) {
    try { foto = pasta_(['Kiton Hub', 'APR', Utilities.formatDate(agora, TZ, 'yyyy')]).createFile(blobDe_(apr.ptFoto, 'image/jpeg', 'APR ' + n + ' - PT.jpg')).getUrl(); }
    catch (e) { foto = 'erro ao salvar a foto'; }
  }
  const g = ctx.geo || null;
  anexar_(t, {
    'Nº APR': n, 'Data': agora, 'Nº OS': ctx.numero || '', 'Apontamento': ctx.apontamento || '', 'Cliente': ctx.cliente, 'Tipo de serviço': ctx.tipo,
    'Registrado por': u.nome, 'Responsável pela atividade': av.responsavel, 'Equipe': ctx.equipe.join(', '), 'Modelo': av.modelo,
    'Triagem': av.triagemTxt, 'PT': av.pt, 'Nº da PT': txt_(apr.ptNumero), 'Foto da PT': foto, 'Emissor da PT': txt_(apr.ptEmissor),
    'Condição da instalação': av.condicao || 'Não se aplica (APR reduzida)', 'Justificativa (energizado)': txt_(apr.justificativa),
    'Respostas': av.respostas, 'Riscos adicionais e medidas': av.riscos, 'Impedimentos': av.impedimentos.join('\n'), 'Situação': situacao,
    'Lat.': g ? g.lat : '', 'Long.': g ? g.lng : '', 'Dados da OS': ctx.dados ? JSON.stringify(ctx.dados) : ''
  });
  return n;
}

function textoBloqueio_(n, ctx, u, imped) {
  return 'APR nº ' + n + ' BLOQUEADA\nOS: ' + (ctx.numero || 'nova, aberta em campo') + '\nCliente: ' + ctx.cliente + '\nTipo de serviço: ' + ctx.tipo +
    '\nRegistrada por: ' + u.nome + '\nEquipe: ' + ctx.equipe.join(', ') + '\n\nImpedimentos:\n' + imped.map(x => '- ' + x).join('\n');
}

function avisarBloqueio_(n, ctx, u, imped) {
  const txt = textoBloqueio_(n, ctx, u, imped);
  try {
    MailApp.sendEmail(EMAIL_KITON, 'APR nº ' + n + ' bloqueada | ' + ctx.cliente + ' | Kiton Hub',
      txt + '\n\nO início da OS foi bloqueado pelo app. Para liberar por exceção ou manter o bloqueio, acesse Administração > OS no Kiton Hub.',
      { name: 'Kiton Hub', replyTo: EMAIL_KITON });
  } catch (e) { /* segue: o aviso pelo WhatsApp continua disponível */ }
  return txt;
}

/** APRs do colaborador que aguardam decisão ou foram liberadas por exceção e ainda não usadas. */
function minhasAPR_(u) {
  return ler_('APR').linhas.filter(l => txt_(l.get('Registrado por')) === u.nome && !txt_(l.get('Apontamento')) &&
    ['Bloqueada', 'Liberada por exceção', 'Mantida bloqueada'].indexOf(txt_(l.get('Situação'))) >= 0 && diasAte_(data_(l.get('Data'))) > -3)
    .map(l => ({ n: txt_(l.get('Nº APR')), numero: txt_(l.get('Nº OS')), cliente: txt_(l.get('Cliente')), situacao: txt_(l.get('Situação')),
      data: fmt_(l.get('Data')), impedimentos: lista3_(l.get('Impedimentos')), decisao: txt_(l.get('Justificativa da decisão')), decisor: txt_(l.get('Decisão por')) }));
}

function lista3_(v) { return txt_(v).split('\n').map(txt_).filter(Boolean); }

function aprBloqueadas_() {
  return ler_('APR').linhas.filter(l => txt_(l.get('Situação')) === 'Bloqueada').map(l => ({
    n: txt_(l.get('Nº APR')), numero: txt_(l.get('Nº OS')), cliente: txt_(l.get('Cliente')), tipo: txt_(l.get('Tipo de serviço')),
    quem: txt_(l.get('Registrado por')), equipe: lista2_(l.get('Equipe')), data: fmt_(l.get('Data')), impedimentos: lista3_(l.get('Impedimentos'))
  }));
}

/** Situação dos treinamentos da equipe de campo (vencidos, vencendo em 30 dias, sem data). */
function situacaoTreinos_() {
  const tr = treinamentos_();
  const campo = ler_(ABA.colab).linhas.filter(l => txt_(l.get('Ativo')) === 'Sim' && txt_(l.get('Função')) !== 'Administrativo').map(l => txt_(l.get('Nome')));
  return campo.map(n => ({
    nome: n,
    itens: TREINOS.map(([k]) => { const d = (tr[n] || {})[k]; return { k, venc: d ? dia_(d) : '', dias: diasAte_(d) }; })
  }));
}

/** APR completa para consulta (administração ou quem participou). */
function verAPR_(u, req) {
  const l = ler_('APR').linhas.find(x => req.ap ? txt_(x.get('Apontamento')) === txt_(req.ap) : txt_(x.get('Nº APR')) === txt_(req.n));
  if (!l) throw new Error('APR não encontrada.');
  const equipe = lista2_(l.get('Equipe'));
  if (u.perfil !== 'Administrador' && equipe.indexOf(u.nome) < 0 && txt_(l.get('Registrado por')) !== u.nome) throw new Error('Só a administração e a equipe da APR podem consultá-la.');
  const g = k => txt_(l.get(k));
  return { ok: true, apr: {
    n: g('Nº APR'), data: fmt_(l.get('Data')), numero: g('Nº OS'), apontamento: g('Apontamento'), cliente: g('Cliente'), tipo: g('Tipo de serviço'),
    registradoPor: g('Registrado por'), responsavel: g('Responsável pela atividade'), equipe, modelo: g('Modelo'), triagem: lista3_(l.get('Triagem')),
    pt: g('PT'), ptNumero: g('Nº da PT'), ptFoto: g('Foto da PT'), ptEmissor: g('Emissor da PT'), condicao: g('Condição da instalação'),
    justificativa: g('Justificativa (energizado)'), respostas: lista3_(l.get('Respostas')), riscos: lista3_(l.get('Riscos adicionais e medidas')),
    impedimentos: lista3_(l.get('Impedimentos')), situacao: g('Situação'), decisor: g('Decisão por'), decisao: g('Justificativa da decisão'),
    ciencia: g('Ciência do cliente'), lat: g('Lat.'), lng: g('Long.')
  } };
}

function aprPainel_() { return { ok: true, bloqueadas: aprBloqueadas_(), treinos: situacaoTreinos_() }; }

function decidirAPR_(u, req) {
  const t = ler_('APR');
  const l = t.linhas.find(x => txt_(x.get('Nº APR')) === txt_(req.n));
  if (!l) throw new Error('APR não encontrada.');
  if (txt_(l.get('Situação')) !== 'Bloqueada') throw new Error('Esta APR já teve decisão.');
  const just = txt_(req.justificativa);
  if (!just) throw new Error('Escreva a justificativa da decisão.');
  set_(t, l._linha, 'Situação', req.liberar ? 'Liberada por exceção' : 'Mantida bloqueada');
  set_(t, l._linha, 'Decisão por', u.nome);
  set_(t, l._linha, 'Justificativa da decisão', just);
  set_(t, l._linha, 'Data da decisão', new Date());
  return { ok: true };
}

/** Bloqueios antigos do mesmo colaborador para a mesma OS (ou o mesmo cliente, se OS nova) deixam de pesar como pendência. */
function substituirBloqueios_(u, numero, cliente) {
  const t = ler_('APR');
  t.linhas.filter(l => txt_(l.get('Registrado por')) === u.nome && ['Bloqueada', 'Mantida bloqueada'].indexOf(txt_(l.get('Situação'))) >= 0 && !txt_(l.get('Apontamento')) &&
    (numero ? txt_(l.get('Nº OS')) === numero : !txt_(l.get('Nº OS')) && txt_(l.get('Cliente')) === cliente))
    .forEach(l => set_(t, l._linha, 'Situação', 'Substituída por nova APR'));
}

/** APR do apontamento (para o PDF e a ciência do cliente). */
function aprPorApontamento_() {
  const m = {};
  ler_('APR').linhas.forEach(l => { const a = txt_(l.get('Apontamento')); if (a) m[a] = l; });
  return m;
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
  // ciência do cliente na APR deste apontamento
  const lapr = aprPorApontamento_()[txt_(req.n)];
  if (lapr) {
    const ta = ler_('APR');
    set_(ta, lapr._linha, 'Ciência do cliente', ausente ? 'Sem ciência do cliente (ausente)' : txt_(req.assinante) + (txt_(req.cargo) ? ' (' + txt_(req.cargo) + ')' : '') + ' em ' + fmt_(fim));
  }

  // totais na OS
  const todos = ler_(ABA.apont).linhas.filter(x => txt_(x.get('Nº OS')) === numero);
  const total = Math.round(todos.reduce((s, x) => s + (Number(x.get('Horas')) || 0), 0) * 10000) / 10000;
  set_(b.os, lo._linha, 'Horas trabalhadas', total);
  set_(b.os, lo._linha, 'Apontamentos', todos.length);
  set_(b.os, lo._linha, 'Último apontamento', fim);

  let pdf, envio, link;
  const osInfo = resumoOS_(ler_(ABA.os).linhas.find(x => txt_(x.get('Nº OS')) === numero), todos);
  if (tipo === 'Final') {
    set_(b.os, lo._linha, 'Status', ST_APROVACAO);
    set_(b.os, lo._linha, 'Finalizada em', fim);
    set_(b.os, lo._linha, 'Pendências / recomendações', txt_(req.pendencias));
    set_(b.os, lo._linha, 'E-mails do cliente', emails.join(', '));
    const prevFim = data_(lo.get('Término previsto'));
    if (prevFim) set_(b.os, lo._linha, 'Prazo', fim.getTime() <= prevFim.getTime() ? 'Dentro do previsto' : 'Após o previsto');
    agendaFinal_(lo);
    osInfo.pendencias = txt_(req.pendencias); osInfo.status = ST_APROVACAO; osInfo.finalizadaEm = fmt_(fim); osInfo.previa = true;
    if (b.os.cab['APR no PDF do cliente'] !== undefined) set_(b.os, lo._linha, 'APR no PDF do cliente', req.incluirAPR === true ? 'Sim' : 'Não');
    // o cliente só recebe depois da aprovação da administração; aqui vai a prévia para a Kiton
    pdf = pdfOS2_(osInfo, todos, 'final', req.incluirAPR === true);
    link = pasta.createFile(pdf).getUrl();
    try { enviarOS2_(osInfo, pdf, emails, 'aprovacao', todos); envio = 'Aguardando aprovação (prévia enviada para a Kiton)'; }
    catch (e) { envio = 'Aguardando aprovação (aviso por e-mail falhou: ' + (e && e.message ? e.message : e) + ')'; }
    set_(b.os, lo._linha, 'Envio', envio);
  } else {
    pdf = pdfOS2_(osInfo, todos.filter(x => txt_(x.get('Nº')) === txt_(req.n)), 'parcial');
    link = pasta.createFile(pdf).getUrl();
    try { enviarOS2_(osInfo, pdf, [], 'parcial', todos.filter(x => txt_(x.get('Nº')) === txt_(req.n))); envio = 'Enviado para a Kiton'; }
    catch (e) { envio = 'Erro no envio: ' + (e && e.message ? e.message : e); }
  }
  set_(b.ap, la._linha, 'PDF do apontamento', link);
  return { ok: true, numero, tipo, cliente: osInfo.cliente, horas, link, envio, enviada: !/^Erro/.test(envio), emails, aprovacao: tipo === 'Final' };
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

// ----- correção e reabertura de OS finalizada (administração) -----
function revTxt_(n) { return ('0' + n).slice(-2); }

function registrarRevisao_(t, l, u, tipo, motivo) {
  const rev = (Number(l.get('Revisão')) || 0) + 1;
  const hist = txt_(l.get('Histórico de revisões'));
  const linha = 'Revisão ' + revTxt_(rev) + ' (' + tipo + ') em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') + ' por ' + u.nome + '. Motivo: ' + motivo;
  set_(t, l._linha, 'Revisão', rev);
  set_(t, l._linha, 'Histórico de revisões', hist ? hist + '\n' + linha : linha);
  return rev;
}

/** Fotos de um apontamento em miniatura, para a tela de correção. */
function fotosAp_(req) {
  const l = ler_(ABA.apont).linhas.find(x => txt_(x.get('Nº')) === txt_(req.n));
  if (!l) throw new Error('Apontamento não encontrado.');
  return { ok: true, fotos: lista2_(l.get('Fotos')).map(id => ({ id, src: imgDrive_(id) })) };
}

function corrigirOS_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  if (txt_(l.get('Status')) !== 'Finalizada') throw new Error('Só OS finalizada pode ser corrigida. Para OS em andamento, use os apontamentos normais.');
  const motivo = txt_(req.motivo);
  if (!motivo) throw new Error('Informe o motivo da correção.');
  const numero = txt_(req.numero);
  const pasta = pasta_(['Kiton Hub', 'Ordens de serviço', numero.split('-')[0], 'OS ' + numero]);
  aplicarEdicoes_(numero, req.apontamentos, pasta);

  if (req.pendencias !== undefined) set_(t, l._linha, 'Pendências / recomendações', txt_(req.pendencias));
  if (typeof req.incluirAPR === 'boolean' && t.cab['APR no PDF do cliente'] !== undefined) {
    const at = txt_(l.get('APR no PDF do cliente'));
    set_(t, l._linha, 'APR no PDF do cliente', req.incluirAPR ? (at === 'Completa' ? 'Completa' : 'Sim') : 'Não');
  }
  const rev = registrarRevisao_(t, l, u, 'correção', motivo);
  const t2 = ler_(ABA.os), l2 = t2.linhas.find(x => txt_(x.get('Nº OS')) === numero);
  const aps = ler_(ABA.apont).linhas.filter(x => txt_(x.get('Nº OS')) === numero);
  const o = resumoOS_(l2, aps);
  const ap2 = txt_(l2.get('APR no PDF do cliente'));
  const pdf = pdfOS2_(o, aps, 'final', ap2 === 'Sim' || ap2 === 'Completa', ap2 === 'Completa');
  const link = pasta.createFile(pdf).getUrl();
  set_(t2, l2._linha, 'PDF final', link);
  let envio = '';
  if (req.reenviar) {
    try { enviarOS2_(Object.assign(o, { motivoRevisao: motivo }), pdf, lista2_(l2.get('E-mails do cliente')), 'final', aps); envio = 'Revisão ' + revTxt_(rev) + ' enviada em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'); }
    catch (e) { envio = 'Erro no envio da revisão: ' + (e && e.message ? e.message : e); }
    set_(t2, l2._linha, 'Envio', envio);
  }
  return { ok: true, revisao: rev, link, envio };
}

function reabrirOS_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  if (txt_(l.get('Status')) !== 'Finalizada') throw new Error('Só OS finalizada pode ser reaberta.');
  const motivo = txt_(req.motivo);
  if (!motivo) throw new Error('Informe o motivo da reabertura.');
  const rev = registrarRevisao_(t, l, u, 'reabertura', motivo);
  set_(t, l._linha, 'Status', 'Em andamento');
  set_(t, l._linha, 'Reaberta', (Number(l.get('Reaberta')) || 0) + 1);
  if (req.tecnicos && req.tecnicos.length) set_(t, l._linha, 'Técnicos designados', req.tecnicos.map(txt_).filter(Boolean).join(', '));
  const id = txt_(l.get('Evento na agenda'));
  if (id && id.indexOf('erro') !== 0) {
    try { const ev = CalendarApp.getCalendarById(AGENDA_GERAL).getEventById(id); if (ev) ev.setTitle(ev.getTitle().replace(/^✓ /, '') + ' (reaberta)'); } catch (e) { /* segue */ }
  }
  return { ok: true, revisao: rev };
}

/** Página da APR completa (anexo do PDF da OS): sempre em uma folha própria. */
function paginaAPR_(x, a, o) {
  const g = k => txt_(x.get(k));
  const linhas = v => lista3_(v);
  const resp = l => { const m = l.match(/^(.*?)\s(Sim|Não|N\/A)$/); return m ? [m[1], m[2]] : [l, '']; };
  const tabSN = lista => '<table class="ak">' + lista.map(l => { const r = resp(l); return '<tr><td>' + esc_(r[0]) + '</td><td class="rr' + (r[1] === 'Não' ? ' nao' : '') + '">' + esc_(r[1]) + '</td></tr>'; }).join('') + '</table>';
  const pt = g('PT') === 'Sim' ? 'Sim' + (g('Nº da PT') ? ', nº ' + g('Nº da PT') : '') + (g('Emissor da PT') ? ', emitida por ' + g('Emissor da PT') : '') + (g('Foto da PT') ? ' (foto arquivada)' : '') : g('PT');
  const ass = a && txt_(a.get('Assinatura')) ? imgDrive_(txt_(a.get('Assinatura'))) : '';
  const sit = g('Situação') === 'Liberada por exceção' ? 'Liberada por exceção, por ' + g('Decisão por') + ': ' + g('Justificativa da decisão') : g('Situação');
  // pares rótulo/valor em duas colunas para a APR caber numa folha
  const kv2 = pares => { pares = pares.filter(x => x[1]); let h = ''; for (let i = 0; i < pares.length; i += 2) { const b = pares[i + 1];
    h += '<tr><td class="ka">' + pares[i][0] + '</td><td' + (b ? '' : ' colspan="3"') + '>' + esc_(pares[i][1]) + '</td>' + (b ? '<td class="ka">' + b[0] + '</td><td>' + esc_(b[1]) + '</td>' : '') + '</tr>'; } return h; };
  const tab2 = lista => { let h = '<table class="ak tri">'; for (let i = 0; i < lista.length; i += 2) { const a1 = resp(lista[i]), b1 = lista[i + 1] ? resp(lista[i + 1]) : null;
    h += '<tr><td>' + esc_(a1[0]) + '</td><td class="rr">' + esc_(a1[1]) + '</td>' + (b1 ? '<td>' + esc_(b1[0]) + '</td><td class="rr">' + esc_(b1[1]) + '</td>' : '<td></td><td></td>') + '</tr>'; } return h + '</table>'; };
  return '<div class="apr">' +
    '<table class="cab"><tr><td><img src="data:image/png;base64,' + LOGO_B64 + '" style="width:160px;height:auto"></td>' +
    '<td class="num"><span>ANÁLISE PRELIMINAR DE RISCO</span><b>APR Nº ' + esc_(g('Nº APR')) + '</b><span>OS nº ' + esc_(o.numero) + ' · ' + fmt_(x.get('Data')) + '</span></td></tr></table>' +
    '<table class="ak kv">' + kv2([['Cliente', g('Cliente')], ['Local / setor', o.local], ['Tipo de serviço', g('Tipo de serviço')], ['Modelo', 'APR ' + g('Modelo').toLowerCase()],
      ['Responsável', g('Responsável pela atividade')], ['Equipe', g('Equipe')], ['Instalação', g('Condição da instalação')], ['Situação', sit]]) +
    kv2([['Permissão de trabalho (PT)', pt]]) + kv2([['Justificativa (energizado)', g('Justificativa (energizado)')]]) + '</table>' +
    '<div class="at">Triagem</div>' + tab2(linhas(x.get('Triagem'))) +
    '<div class="at">Verificações antes do início</div>' + tabSN(linhas(x.get('Respostas'))) +
    (g('Riscos adicionais e medidas') ? '<div class="at">Riscos adicionais e medidas de controle</div><div class="ab">' + quebra_(g('Riscos adicionais e medidas')) + '</div>' : '') +
    (g('Impedimentos') ? '<div class="at">Impedimentos registrados</div><div class="ab">' + quebra_(g('Impedimentos')) + '</div>' : '') +
    '<div class="at">Liberação</div><div class="ab">Declaração do responsável: os riscos foram avaliados e as medidas de controle foram implementadas.<br>' +
    '<b>' + esc_(g('Responsável pela atividade')) + '</b> · registrado por ' + esc_(g('Registrado por')) + ' em ' + fmt_(x.get('Data')) +
    (g('Lat.') ? ' · localização ' + esc_(g('Lat.')) + ', ' + esc_(g('Long.')) : '') + '</div>' +
    '<div class="at">Ciência do cliente</div><div class="ab cie">' + (ass ? '<img src="' + ass + '">' : '') + esc_(g('Ciência do cliente') || 'Não registrada') + '</div>' +
    '</div>';
}

/** PDF somente da APR (uma folha), para imprimir. */
function pdfAPR_(u, req) {
  const l = ler_('APR').linhas.find(x => txt_(x.get('Nº APR')) === txt_(req.n));
  if (!l) throw new Error('APR não encontrada.');
  if (u.perfil !== 'Administrador' && lista2_(l.get('Equipe')).indexOf(u.nome) < 0) throw new Error('Só a administração e a equipe da APR podem imprimi-la.');
  const numero = txt_(l.get('Nº OS'));
  const lo = numero ? ler_(ABA.os).linhas.find(x => txt_(x.get('Nº OS')) === numero) : null;
  const a = txt_(l.get('Apontamento')) ? ler_(ABA.apont).linhas.find(x => txt_(x.get('Nº')) === txt_(l.get('Apontamento'))) : null;
  const o = { numero: numero || '-', local: lo ? txt_(lo.get('Local / setor')) : '' };
  const html = '<html><head><meta charset="utf-8"><style>' + estiloPDF_() + '.apr{page-break-before:auto}</style></head><body>' + envolverPDF_(paginaAPR_(l, a, o)) + '</body></html>';
  const pdf = Utilities.newBlob(html, 'text/html', 'APR.html').getAs('application/pdf').setName('APR ' + txt_(l.get('Nº APR')) + ' - OS ' + o.numero + ' - ' + txt_(l.get('Cliente')).replace(/[\\/:*?"<>|]/g, '') + '.pdf');
  const link = pasta_(['Kiton Hub', 'APR', Utilities.formatDate(new Date(), TZ, 'yyyy')]).createFile(pdf).getUrl();
  return { ok: true, link };
}

/** PDF final com a APR completa anexada (gera sob demanda e reaproveita enquanto a revisão não mudar). */
function pdfComAPR_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  const numero = txt_(req.numero);
  const aps = ler_(ABA.apont).linhas.filter(x => txt_(x.get('Nº OS')) === numero);
  const o = resumoOS_(l, aps);
  if (u.perfil !== 'Administrador' && o.envolvidos.indexOf(u.nome) < 0) throw new Error('Só a administração e a equipe da OS podem abrir este PDF.');
  if (['Finalizada', ST_APROVACAO].indexOf(o.status) < 0) throw new Error('O PDF só existe depois da finalização.');
  const chave = o.revisao + (o.status === ST_APROVACAO ? 'p' : '') + '|';
  const atual = t.cab['PDF com APR completa'] !== undefined ? txt_(l.get('PDF com APR completa')) : '';
  if (atual.indexOf(chave) === 0) return { ok: true, link: atual.slice(chave.length) };
  if (o.status === ST_APROVACAO) o.previa = true;
  const pdf = pdfOS2_(o, aps, 'final', ['Sim', 'Completa'].indexOf(txt_(l.get('APR no PDF do cliente'))) >= 0, true);
  pdf.setName('OS ' + numero + (o.revisao ? ' - Rev ' + revTxt_(o.revisao) : '') + ' - com APR completa - ' + o.cliente.replace(/[\\/:*?"<>|]/g, '') + '.pdf');
  const link = pasta_(['Kiton Hub', 'Ordens de serviço', numero.split('-')[0], 'OS ' + numero]).createFile(pdf).getUrl();
  if (t.cab['PDF com APR completa'] !== undefined) set_(t, l._linha, 'PDF com APR completa', chave + link);
  return { ok: true, link };
}

// ----- aprovação da OS pela administração -----
const ST_APROVACAO = 'Aguardando aprovação';

/** Aplica edições de texto, materiais e fotos nos apontamentos (correção ou aprovação). */
function aplicarEdicoes_(numero, lista, pasta) {
  const ap = ler_(ABA.apont);
  (lista || []).forEach(c => {
    const la = ap.linhas.find(x => txt_(x.get('Nº')) === txt_(c.n) && txt_(x.get('Nº OS')) === numero);
    if (!la) throw new Error('Apontamento ' + c.n + ' não pertence a esta OS.');
    if (!txt_(c.executado)) throw new Error('O serviço executado não pode ficar vazio.');
    set_(ap, la._linha, 'Serviço executado', txt_(c.executado));
    set_(ap, la._linha, 'Materiais utilizados', txt_(c.materiais));
    if (Array.isArray(c.fotos)) {
      const atuais = lista2_(la.get('Fotos'));
      const ids = c.fotos.slice(0, 6).map((f, i) => /^data:/.test(f) ? salvarImagem_(pasta, f, 'image/jpeg', 'Apontamento ' + c.n + ' - foto revisada ' + (i + 1) + '.jpg') : (atuais.indexOf(f) >= 0 ? f : '')).filter(Boolean);
      set_(ap, la._linha, 'Fotos', ids.join(','));
    }
  });
}

function aprovarOS_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  if (txt_(l.get('Status')) !== ST_APROVACAO) throw new Error('Esta OS não está aguardando aprovação.');
  const numero = txt_(req.numero);
  const emails = (req.emails || []).map(txt_).filter(Boolean);
  const inv = emails.find(e => !emailValido_(e));
  if (inv) throw new Error('E-mail inválido: ' + inv);
  if (emails.length > 3) throw new Error('No máximo 3 e-mails do cliente.');
  if (req.enviar && !emails.length) throw new Error('Informe pelo menos um e-mail do cliente para enviar.');
  const pasta = pasta_(['Kiton Hub', 'Ordens de serviço', numero.split('-')[0], 'OS ' + numero]);
  aplicarEdicoes_(numero, req.apontamentos, pasta);
  if (req.pendencias !== undefined) set_(t, l._linha, 'Pendências / recomendações', txt_(req.pendencias));
  // APR no PDF: 'completa' (folha da APR anexada), 'resumida' (quadro em cada apontamento) ou 'nenhuma'
  const modoApr = ['completa', 'resumida', 'nenhuma'].indexOf(req.apr) >= 0 ? req.apr : (req.incluirAPR ? 'resumida' : 'nenhuma');
  if (t.cab['APR no PDF do cliente'] !== undefined) set_(t, l._linha, 'APR no PDF do cliente', modoApr === 'completa' ? 'Completa' : modoApr === 'resumida' ? 'Sim' : 'Não');
  set_(t, l._linha, 'E-mails do cliente', emails.join(', '));
  set_(t, l._linha, 'Status', 'Finalizada');
  if (t.cab['Aprovada por'] !== undefined) { set_(t, l._linha, 'Aprovada por', u.nome); set_(t, l._linha, 'Aprovada em', new Date()); }
  const t2 = ler_(ABA.os), l2 = t2.linhas.find(x => txt_(x.get('Nº OS')) === numero);
  const aps = ler_(ABA.apont).linhas.filter(x => txt_(x.get('Nº OS')) === numero);
  const o = resumoOS_(l2, aps);
  const pdf = pdfOS2_(o, aps, 'final', modoApr !== 'nenhuma', modoApr === 'completa');
  const link = pasta.createFile(pdf).getUrl();
  set_(t2, l2._linha, 'PDF final', link);
  let envio;
  const quando = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm');
  try {
    if (req.enviar) { enviarOS2_(o, pdf, emails, 'final', aps); envio = 'Aprovada por ' + u.nome + ' e enviada ao cliente em ' + quando + ' (APR ' + modoApr + ')'; }
    else { enviarOS2_(o, pdf, [], 'interna', aps); envio = 'Aprovada por ' + u.nome + ' em ' + quando + ', sem envio ao cliente'; }
  } catch (e) { envio = 'Erro no envio: ' + (e && e.message ? e.message : e); }
  set_(t2, l2._linha, 'Envio', envio);
  return { ok: true, link, envio, enviada: !!req.enviar && !/^Erro/.test(envio) };
}

/** Devolve a OS ao técnico antes da aprovação: volta para Em andamento, sem revisão (o cliente ainda não recebeu). */
function devolverOS_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  if (txt_(l.get('Status')) !== ST_APROVACAO) throw new Error('Esta OS não está aguardando aprovação.');
  const motivo = txt_(req.motivo);
  if (!motivo) throw new Error('Informe o motivo da devolução.');
  set_(t, l._linha, 'Status', 'Em andamento');
  set_(t, l._linha, 'Finalizada em', ''); set_(t, l._linha, 'Prazo', '');
  if (req.tecnicos && req.tecnicos.length) set_(t, l._linha, 'Técnicos designados', req.tecnicos.map(txt_).filter(Boolean).join(', '));
  // registro interno: fica em Observações (o histórico de revisões vai no PDF do cliente)
  const obs = txt_(l.get('Observações'));
  const linha = 'Devolvida ao técnico em ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') + ' por ' + u.nome + '. Motivo: ' + motivo;
  set_(t, l._linha, 'Observações', obs ? obs + '\n' + linha : linha);
  if (t.cab['Devolvida'] !== undefined) set_(t, l._linha, 'Devolvida', (Number(l.get('Devolvida')) || 0) + 1);
  return { ok: true };
}

// ----- painel gerencial -----
function painelOS_(req) {
  // período: de/ate (yyyy-MM-dd); sem datas = geral. Compatível com o filtro antigo por mês (req.mes = yyyy-MM).
  let de = txt_(req.de), ate = txt_(req.ate);
  if (!de && !ate && txt_(req.mes)) {
    const [a, m] = txt_(req.mes).split('-').map(Number);
    de = req.mes + '-01'; ate = Utilities.formatDate(new Date(a, m, 0), TZ, 'yyyy-MM-dd');
  }
  const cliente = txt_(req.cliente), colab = txt_(req.colaborador), tipo = txt_(req.tipo);
  const hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const noPeriodo = d => { if (!d) return !de && !ate; const s = Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); return (!de || s >= de) && (!ate || s <= ate); };
  const b = baseOS_();
  const lista = b.os.linhas.map(l => {
    const o = resumoOS_(l, b.porOS[txt_(l.get('Nº OS'))]);
    o._ref = data_(l.get('Início previsto')) || data_(l.get('Iniciada em')) || data_(l.get('Programada em'));
    return o;
  }).filter(o => {
    if (cliente && o.cliente !== cliente) return false;
    if (tipo && o.tipo !== tipo) return false;
    if (colab && o.envolvidos.indexOf(colab) < 0) return false;
    const aberta = ['Programada', 'Em andamento'].indexOf(o.status) >= 0;
    return noPeriodo(o._ref) || (aberta && (!ate || ate >= hoje));
  });
  const numeros = {}; lista.forEach(o => { numeros[o.numero] = o; delete o._ref; });
  // horas por técnico: apontamentos do período nas OS filtradas
  const tecnicos = {};
  b.ap.linhas.forEach(a => {
    const d = data_(a.get('Início'));
    const os = numeros[txt_(a.get('Nº OS'))];
    if (!d || !os || !noPeriodo(d)) return;
    lista2_(a.get('Equipe')).forEach(n => {
      if (colab && n !== colab) return;
      const p = tecnicos[n] || (tecnicos[n] = { nome: n, horas: 0, apontamentos: 0, os: {}, finalizadas: {}, noPrazo: 0, aposPrazo: 0, ausente: 0, reabertas: {} });
      p.horas += Number(a.get('Horas')) || 0; p.apontamentos++; p.os[os.numero] = 1;
      if (os.reaberta) p.reabertas[os.numero] = 1;
      if (txt_(a.get('Cliente ausente (motivo)'))) p.ausente++;
      if (txt_(a.get('Tipo')) === 'Final') {
        p.finalizadas[os.numero] = 1;
        if (os.prazo === 'Dentro do previsto') p.noPrazo++;
        if (os.prazo === 'Após o previsto') p.aposPrazo++;
      }
    });
  });
  const porTecnico = Object.keys(tecnicos).sort().map(k => {
    const p = tecnicos[k];
    return { nome: p.nome, horas: Math.round(p.horas * 10000) / 10000, apontamentos: p.apontamentos, os: Object.keys(p.os).length,
      finalizadas: Object.keys(p.finalizadas).length, noPrazo: p.noPrazo, aposPrazo: p.aposPrazo, ausente: p.ausente, reabertas: Object.keys(p.reabertas).length };
  });
  // por cliente (horas e quantidade)
  const cli = {};
  lista.forEach(o => { const c = cli[o.cliente] || (cli[o.cliente] = { cliente: o.cliente, os: 0, horas: 0, finalizadas: 0 }); c.os++; c.horas += o.horas; if (o.status === 'Finalizada') c.finalizadas++; });
  const porCliente = Object.keys(cli).map(k => cli[k]).sort((a, c) => c.horas - a.horas);
  return { ok: true, de, ate, lista: lista.reverse(), porTecnico, porCliente };
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

/** Rodapé fixo em todas as páginas dos PDFs (a tabela reserva o espaço dele em cada folha). */
function rodapePDF_() {
  return '<div class="rodfix">Todos os direitos reservados | ' + esc_(EMPRESA.nome) + ' · CNPJ ' + esc_(EMPRESA.cnpj) +
    ' | Documento gerado automaticamente via app Kiton Hub (versão ' + esc_(VERSAO_APP) + ')<br>' +
    esc_(EMPRESA.endereco) + ' · ' + esc_(EMPRESA.fone) + ' · ' + esc_(EMPRESA.email) + '</div>';
}
function envolverPDF_(corpo) {
  return '<table class="pg"><tbody><tr><td>' + corpo + '</td></tr></tbody><tfoot><tr><td><div class="espaco-rod"></div></td></tr></tfoot></table>' + rodapePDF_();
}

/** Estilos comuns aos PDFs da OS e da APR. */
function estiloPDF_() {
  return '.rodfix{position:fixed;left:0;right:0;bottom:0;font-size:7pt;color:#5d6670;text-align:center;border-top:1.5px solid #CD0000;padding-top:3px;background:#fff;line-height:1.45}' +
    'table.pg{width:100%;border-collapse:collapse}table.pg>tbody>tr>td,table.pg>tfoot>tr>td{padding:0;font-size:10pt;vertical-align:top}.espaco-rod{height:11mm}' +
    '@page{size:A4;margin:12mm 13mm 10mm}body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#1c1f23}' +
    '.cab{width:100%;border-collapse:collapse;border-bottom:3px solid #CD0000;margin-bottom:8px}.cab td{vertical-align:middle;padding:0 0 6px}' +
    '.emp{font-size:8pt;color:#5d6670}.num{text-align:right}.num b{display:block;font-size:15pt}.num span{font-size:8.5pt;color:#5d6670}' +
    'table.d{width:100%;border-collapse:collapse;margin:2px 0 6px}table.d td{padding:3px 6px;border-bottom:1px solid #e6e9ed;vertical-align:top}' +
    'td.r{width:150px;color:#5d6670;font-size:8.5pt}' +
    '.b{margin:8px 0 6px;page-break-inside:avoid}.bt{font-weight:bold;font-size:10pt;color:#000000;border-bottom:2px solid #CD0000;padding:0 0 2px 0;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px}' +
    '.bc{border:1px solid #9aa3ad;padding:6px 8px;line-height:1.4}' +
    '.quebra{page-break-before:always}.apt{font-weight:bold;font-size:11pt;border-top:2px solid #1c1f23;padding-top:5px;margin:6px 0 4px}' +
    'table.f{width:100%;border-collapse:collapse;table-layout:fixed}table.f td{width:33.3%;height:112px;padding:3px;border:1px solid #9aa3ad;text-align:center;vertical-align:middle}' +
    'table.f img{max-width:100%;max-height:106px}' +
    'table.m{width:100%;border-collapse:collapse;margin:6px 0}table.m th,table.m td{border:1px solid #9aa3ad;padding:3px 5px;text-align:left;font-size:8.5pt}table.m th{font-weight:bold;border-bottom:2px solid #1c1f23}' +
    '.ass{margin-top:8px;border:1px solid #9aa3ad;padding:6px 8px;page-break-inside:avoid}.ass img{height:60px}.ass .n{border-top:1px solid #1c1f23;margin-top:2px;padding-top:3px;font-weight:bold}' +
    '.ass .s{font-size:8pt;color:#5d6670}.aus{color:#8A3B00;font-weight:bold;padding:14px 0 4px}' +
    '.rod{margin-top:10px;font-size:7.5pt;color:#5d6670;text-align:center;border-top:1px solid #e6e9ed;padding-top:5px}' +
    '.apr{page-break-before:always;page-break-inside:avoid;font-size:7.8pt}.apr .cab{margin-bottom:5px}.apr .num b{font-size:12pt}' +
    'table.ak{width:100%;border-collapse:collapse;margin:0 0 3px;font-size:8pt}table.ak td{border:1px solid #c9ced4;padding:1.5px 4px;vertical-align:top;line-height:1.2}' +
    'table.ak td.rr{width:30px;text-align:center;font-weight:bold}table.ak td.nao{color:#B00000}table.kv td.ka{width:82px;color:#5d6670;font-size:7pt}table.tri td{background:#f6f7f8}' +
    '.at{font-weight:bold;font-size:8pt;text-transform:uppercase;border-bottom:1.5px solid #CD0000;margin:5px 0 2px;padding-bottom:1px}' +
    '.ab{border:1px solid #c9ced4;padding:3px 5px;line-height:1.25}.cie img{height:36px;display:block;margin-bottom:1px}.apr .rod{margin-top:5px}';
}

function pdfOS2_(o, aps, modo, comAPR, aprCompleta) {
  const linha = (rot, val) => val ? '<tr><td class="r">' + rot + '</td><td>' + quebra_(val) + '</td></tr>' : '';
  const bloco = (tit, val) => val ? '<div class="b"><div class="bt">' + tit + '</div><div class="bc">' + quebra_(val) + '</div></div>' : '';
  const r = resumoExecucao_(aps);
  const ordenados = modo === 'final' ? r.ord : aps;
  const varios = modo === 'final' && ordenados.length > 1;
  const aprs = aprPorApontamento_();
  const blocoAPR = a => {
    const x = aprs[txt_(a.get('Nº'))];
    if (!x || (modo === 'final' && !comAPR)) return '';
    const pt = txt_(x.get('PT')) === 'Sim' ? 'Sim' + (txt_(x.get('Nº da PT')) ? ', nº ' + txt_(x.get('Nº da PT')) : '') + (txt_(x.get('Emissor da PT')) ? ', emitida por ' + txt_(x.get('Emissor da PT')) : '') + (txt_(x.get('Foto da PT')) ? ', foto arquivada' : '') : txt_(x.get('PT'));
    // no PDF do cliente a APR só entra quando o técnico responsável escolhe enviar na finalização
    const sit = txt_(x.get('Situação')) === 'Liberada por exceção' ? 'Liberada por exceção (' + txt_(x.get('Decisão por')) + ')' : 'Liberada';
    return '<div class="b"><div class="bt">Análise preliminar de risco (APR)</div><table class="d">' +
      linha('APR', 'Nº ' + txt_(x.get('Nº APR')) + ' · ' + txt_(x.get('Modelo')).toLowerCase() + ' · ' + sit + ' · responsável: ' + txt_(x.get('Responsável pela atividade'))) +
      linha('PT e instalação', 'PT: ' + pt + ' · Instalação: ' + txt_(x.get('Condição da instalação')).toLowerCase()) +
      linha('Riscos adicionais e medidas', txt_(x.get('Riscos adicionais e medidas'))) +
      linha('Ciência do cliente', txt_(x.get('Ciência do cliente'))) + '</table></div>';
  };

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
        : '<div class="aus">Cliente ausente no momento do apontamento.</div><div class="s">Justificativa: ' + esc_(a.get('Cliente ausente (motivo)')) + '</div>') + '</div>' + blocoAPR(a) + '</div>';
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

  const titulo = modo === 'final' ? (o.previa ? 'ORDEM DE SERVIÇO · PRÉVIA PARA APROVAÇÃO' : 'ORDEM DE SERVIÇO') : 'APONTAMENTO PARCIAL DA OS';
  const html = '<html><head><meta charset="utf-8"><style>' + estiloPDF_() +
    '</style></head><body>' + envolverPDF_(
    '<table class="cab"><tr><td><img src="data:image/png;base64,' + LOGO_B64 + '" style="width:200px;height:auto">' +
    '</td>' +
    '<td class="num"><span>' + titulo + '</span><b>Nº ' + esc_(o.numero) + (modo === 'final' && o.revisao ? ' · Rev. ' + revTxt_(o.revisao) : '') + '</b><span>' + esc_(modo === 'final' ? 'Finalizada em ' + o.finalizadaEm : 'Situação: em andamento') + '</span></td></tr></table>' +
    '<table class="d">' + linha('Cliente', o.cliente) + linha('Local / setor', o.local) + linha('Solicitante', o.solicitante) + linha('Tipo de serviço', o.tipo) +
    linha('Programação', o.inicioPrev ? o.inicioPrev + (o.fimPrev ? ' a ' + o.fimPrev : '') : 'Aberta em campo') + '</table>' +
    bloco('Solicitação / problema relatado', o.solicitacao) + resumo + ordenados.map(paginaAp).join('') +
    (modo === 'final' && o.historico ? '<div class="b"><div class="bt">Histórico de revisões</div><div class="bc" style="font-size:8.5pt">' + quebra_(o.historico) + '<br>Esta revisão substitui as versões anteriores deste documento.</div></div>' : '') +
    (aprCompleta ? ordenados.map(a => aprs[txt_(a.get('Nº'))] ? paginaAPR_(aprs[txt_(a.get('Nº'))], a, o) : '').join('') : '')) + '</body></html>';
  const cli = o.cliente.replace(/[\\/:*?"<>|]/g, '');
  return Utilities.newBlob(html, 'text/html', 'OS.html').getAs('application/pdf')
    .setName(modo === 'final' ? 'OS ' + o.numero + (o.revisao ? ' - Rev ' + revTxt_(o.revisao) : '') + ' - ' + cli + '.pdf' : 'OS ' + o.numero + ' - parcial ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HHmm') + ' - ' + cli + '.pdf');
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
    const rv = o.revisao ? ' (revisão ' + revTxt_(o.revisao) + ')' : '';
    assunto = 'Ordem de serviço nº ' + o.numero + (o.motivoRevisao ? ' revisada' + rv : ' finalizada' + rv) + ' | Kiton Engenharia Integrada | ' + o.cliente;
    corpo = '<div style="' + estilo + '"><p>Olá!</p><p>Eu sou o KAI, o assistente inteligente da Kiton Engenharia Integrada.</p>' +
      (o.motivoRevisao
        ? '<p>Esta é uma mensagem automática para informar que a ordem de serviço nº ' + esc_(o.numero) + ', referente à sua empresa, foi revisada. ' +
          'Em anexo, segue a versão revisada (revisão ' + revTxt_(o.revisao) + '), que substitui a enviada anteriormente, e abaixo, o resumo da execução.</p><p><b>Motivo da revisão:</b> ' + esc_(o.motivoRevisao) + '</p>'
        : '<p>Esta é uma mensagem automática para informar que foi finalizada uma ordem de serviço referente à sua empresa. Em anexo, segue a cópia da ordem de serviço, ' +
          'e abaixo, o resumo da execução.' + (o.revisao ? ' Esta versão (revisão ' + revTxt_(o.revisao) + ') substitui a enviada anteriormente.' : '') + '</p>') +
      '<p style="margin:16px 0 0"><b>Resumo da ordem de serviço nº ' + esc_(o.numero) + '</b></p>' + tabela +
      '<p>Agradecemos a confiança no trabalho da nossa equipe. Se tiver qualquer dúvida sobre o serviço realizado, basta responder este e-mail que retornaremos o mais breve possível.</p>' +
      '<p>Para conhecer as nossas soluções e saber como podemos ajudar a sua empresa a performar ainda melhor, acesse <a href="https://' + SITE + '">' + SITE + '</a> ' +
      'ou fale com a gente pelo WhatsApp <a href="https://wa.me/' + WHATS_KITON + '">(44) 4141-0714</a>.</p>' + assinaturaEmail_() + '</div>';
  } else if (modo === 'interna') {
    assunto = 'OS nº ' + o.numero + ' aprovada (sem envio ao cliente) | Kiton Hub | ' + o.cliente;
    corpo = '<div style="' + estilo + '"><p>A OS foi aprovada pela administração sem envio ao cliente. Em anexo, a versão final para registro da equipe.</p>' +
      '<p style="margin:12px 0 0"><b>OS nº ' + esc_(o.numero) + '</b></p>' + tabela + '</div>';
  } else if (modo === 'aprovacao') {
    assunto = 'OS nº ' + o.numero + ' aguardando aprovação | Kiton Hub | ' + o.cliente;
    corpo = '<div style="' + estilo + '"><p>O técnico finalizou a OS e ela aguarda a revisão e aprovação da administração no Kiton Hub (Menu > OS para aprovar). ' +
      'O cliente só recebe depois da aprovação. Em anexo, a prévia do documento.</p>' +
      '<p style="margin:12px 0 0"><b>OS nº ' + esc_(o.numero) + '</b></p>' + tabela + (emails.length ? '<p>E-mails do cliente indicados pelo técnico: ' + esc_(emails.join(', ')) + '</p>' : '') + '</div>';
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
  } else {
    if (modo === 'interna') { const bcc = emailsEquipe_(aps); if (bcc.length) opc.bcc = bcc.join(','); }
    MailApp.sendEmail(EMAIL_KITON, assunto, assunto, opc);
  }
}

function reenviarOS_(u, req) {
  const t = ler_(ABA.os);
  const l = t.linhas.find(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  if (!l) throw new Error('OS não encontrada.');
  const id = (txt_(l.get('PDF final')).match(/[-\w]{25,}/) || [])[0];
  if (!id) throw new Error('PDF final da OS não encontrado.');
  const aps = ler_(ABA.apont).linhas.filter(x => txt_(x.get('Nº OS')) === txt_(req.numero));
  const o = resumoOS_(l, aps);
  if (!lista2_(l.get('E-mails do cliente')).length) throw new Error('A OS não tem e-mail do cliente. Use Corrigir para informar e reenviar.');
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
