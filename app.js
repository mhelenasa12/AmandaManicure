(function(){
'use strict';

/* ================= helpers ================= */
function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function pad2(n){ return n<10 ? '0'+n : ''+n; }
function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function parseISO(iso){ var p=(iso||todayISO()).split('-'); return new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10)); }
function toISO(d){ return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
function addDays(iso, n){ var d=parseISO(iso); d.setDate(d.getDate()+n); return toISO(d); }
function fmtDateBR(iso){ if(!iso) return '—'; var p=iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0].slice(2); }
function fmtDateFull(iso){ if(!iso) return '—'; var p=iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function fmtBRL(v){ v = Number(v)||0; return 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function sumBy(arr, key){ return arr.reduce(function(acc,it){ return acc + (Number(it[key])||0); }, 0); }
function inRange(iso, start, end){ return iso>=start && iso<=end; }
function opt(val,label,current){ return '<option value="'+val+'"'+(val===current?' selected':'')+'>'+escapeHtml(label)+'</option>'; }

var MONTHS_LONG=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function currentYYYYMM(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1); }
function monthLabelFromYYYYMM(ym){ var p=ym.split('-'); return MONTHS_LONG[parseInt(p[1],10)-1]+' de '+p[0]; }
function monthRange(yyyymm){
  var parts = yyyymm.split('-'); var y=parseInt(parts[0],10), m=parseInt(parts[1],10);
  var start = y+'-'+pad2(m)+'-01';
  var lastDay = new Date(y, m, 0).getDate();
  var end = y+'-'+pad2(m)+'-'+pad2(lastDay);
  return {start:start,end:end};
}

var KANBAN_DAYS = ['Terça','Quarta','Quinta','Sexta','Sábado'];
function tueSatWeekStart(iso){
  var d = parseISO(iso);
  var day = d.getDay();
  var offsetToTue;
  if(day===0) offsetToTue = 2;
  else if(day===1) offsetToTue = 1;
  else offsetToTue = -(day-2);
  d.setDate(d.getDate()+offsetToTue);
  return toISO(d);
}
function weekRangeLabel(startIso){
  var endIso = addDays(startIso,4);
  var s = parseISO(startIso), e = parseISO(endIso);
  var mo=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  if(s.getMonth()===e.getMonth()){
    return pad2(s.getDate())+' a '+pad2(e.getDate())+' de '+mo[s.getMonth()];
  }
  return pad2(s.getDate())+' '+mo[s.getMonth()]+' a '+pad2(e.getDate())+' '+mo[e.getMonth()];
}
function defaultKanbanDay(iso){
  var day = parseISO(iso).getDay();
  var map = {0:'Terça',1:'Terça',2:'Terça',3:'Quarta',4:'Quinta',5:'Sexta',6:'Sábado'};
  return map[day];
}

var PAYMENT_METHODS = ['Dinheiro','Pix','Cartão de Débito','Cartão de Crédito','Transferência'];

var ANAMNESE_QUESTIONS = [
  { key:'alergia', label:'Possui alguma alergia a produtos (esmalte, acetona, látex, etc.)?', detail:true },
  { key:'condicaoUnha', label:'Tem unha encravada, onicomicose (fungo) ou outra condição na pele/unha?', detail:true },
  { key:'gestante', label:'Está grávida ou amamentando?', detail:false },
  { key:'diabetes', label:'Tem diabetes ou problema de circulação?', detail:false },
  { key:'medicamento', label:'Faz uso de anticoagulante ou outro medicamento relevante?', detail:true },
  { key:'reacao', label:'Já teve reação alérgica a esmalte em gel, cola ou removedor?', detail:true },
  { key:'ferida', label:'Possui ferida, corte ou infecção ativa nas mãos ou pés hoje?', detail:false }
];

/* ================= state ================= */
var STATE = null; /* filled in asynchronously by boot(), from the server */

function seedState(){
  return {
    meta: { profissional:'Amanda', negocio:'Amanda Nails' },
    services: [
      { id:'s1', name:'Mão Básica', value:25 },
      { id:'s2', name:'Pé Básico', value:30 },
      { id:'s3', name:'Esmaltação em Gel', value:35 },
      { id:'s4', name:'Banho de Gel', value:45 },
      { id:'s5', name:'Pé de Gel', value:40 },
      { id:'s6', name:'Aplicação', value:80 },
      { id:'s7', name:'Manutenção', value:60 },
      { id:'s8', name:'Reposição de Unha', value:10 },
      { id:'s9', name:'Troca de Formato', value:15 },
      { id:'s10', name:'Decoração (Par)', value:10 },
      { id:'s11', name:'Decoração (Todas)', value:30 }
    ],
    planoContas: [
      { id:'p1', name:'Produtos e Insumos' },
      { id:'p2', name:'Equipamentos' },
      { id:'p3', name:'Aluguel do Espaço' },
      { id:'p4', name:'Marketing e Divulgação' },
      { id:'p5', name:'Transporte' },
      { id:'p6', name:'Taxas e Impostos' },
      { id:'p7', name:'Outros' }
    ],
    entradas: [], saidas: [], anamneses: [], seq: 1
  };
}
function normalizeState(s){
  s = s || seedState();
  s.meta = s.meta || { profissional:'Amanda', negocio:'Amanda Nails' };
  s.entradas = s.entradas || [];
  s.saidas = s.saidas || [];
  s.anamneses = s.anamneses || [];
  s.services = s.services || [];
  s.planoContas = s.planoContas || [];
  return s;
}

function SERVICE_BY_ID(id){ var r=null; STATE.services.forEach(function(s){ if(s.id===id) r=s; }); return r; }
function PLANO_BY_ID(id){ var r=null; STATE.planoContas.forEach(function(p){ if(p.id===id) r=p; }); return r; }
function ENTRADA_BY_ID(id){ var r=null; STATE.entradas.forEach(function(e){ if(e.id===id) r=e; }); return r; }

/* ================= ui-only prefs (per viewer, not published) ================= */
var ui = {};
try { ui = JSON.parse(sessionStorage.getItem('amanda-ui')||'{}'); } catch(err){ ui = {}; }
function saveUi(){ try{ sessionStorage.setItem('amanda-ui', JSON.stringify(ui)); }catch(err){} }

/* draft = unsaved form state, lives only in memory, reset on submit */
var draft = { entrada:null, anamnese:null, editingServiceId:null, editingPlanoId:null };
function ensureEntradaDraft(){
  if(!draft.entrada){
    draft.entrada = { date: todayISO(), client:'', serviceId:'', value:'', valueEdited:false, hasManutencao:false, weekChoice:'recomendada' };
  }
  return draft.entrada;
}
function ensureAnamneseDraft(){
  if(!draft.anamnese){
    var answers = {};
    ANAMNESE_QUESTIONS.forEach(function(q){ answers[q.key] = { value:'', detail:'' }; });
    draft.anamnese = { client:'', birth:'', phone:'', answers: answers, obs:'' };
  }
  return draft.anamnese;
}

/* ================= routing ================= */
function currentRoute(){
  var h = location.hash.replace(/^#\/?/, '');
  return h || 'inicio';
}
function navigate(route){ location.hash = '#/' + route; }

/* ================= small components ================= */
function field(labelHtml, inputHtml){
  return '<div class="field"><label>'+labelHtml+'</label>'+inputHtml+'</div>';
}
function statTile(label, value, hint, variant){
  var cls = variant ? ' '+variant : '';
  return '<div class="stat-tile'+cls+'"><span class="label">'+escapeHtml(label)+'</span><span class="value mono">'+escapeHtml(value)+'</span>'+(hint?'<span class="hint">'+escapeHtml(hint)+'</span>':'')+'</div>';
}
function emptyState(msg){ return '<div class="empty-state"><div class="big">–</div>'+escapeHtml(msg)+'</div>'; }
function barListHtml(items, max, variant){
  var rows = items.map(function(it){
    var pct = max>0 ? Math.max(4, Math.round((it.value/max)*100)) : 0;
    return '<div class="bar-row">'
      + '<span class="bar-label">'+escapeHtml(it.label)+(it.sub?('<br><span class="bar-sub">'+escapeHtml(it.sub)+'</span>'):'')+'</span>'
      + '<span class="bar-track"><span class="bar-fill '+variant+'" style="width:'+pct+'%"></span></span>'
      + '<span class="bar-value mono">'+fmtBRL(it.value)+'</span>'
      + '</div>';
  }).join('');
  return '<div class="bar-list">'+rows+'</div>';
}
function quickAction(route,title,desc){
  return '<button type="button" class="card" data-action="nav" data-route="'+route+'">'
   + '<h3 style="margin-bottom:6px;font-size:15px">'+escapeHtml(title)+' →</h3><p class="page-sub" style="margin:0">'+escapeHtml(desc)+'</p></button>';
}

/* ================= page: início ================= */
function pageInicio(){
  var range = monthRange(currentYYYYMM());
  var entradasMes = STATE.entradas.filter(function(e){ return inRange(e.date, range.start, range.end); });
  var saidasMes = STATE.saidas.filter(function(s){ return inRange(s.date, range.start, range.end); });
  var faturado = sumBy(entradasMes,'value');
  var totalSaidas = sumBy(saidasMes,'valor');
  var caixa = faturado - totalSaidas;
  var pendentesManut = STATE.entradas.filter(function(e){ return e.hasManutencao && !e.contacted; }).length;
  var monthLabel = monthLabelFromYYYYMM(currentYYYYMM());

  return ''
  + '<div class="page-head"><div><span class="eyebrow">Visão geral</span><h1>Olá, '+escapeHtml(STATE.meta.profissional||'Amanda')+'</h1>'
  + '<p class="page-sub">Resumo de '+monthLabel+'. Use os atalhos abaixo para lançar um atendimento ou uma anamnese.</p></div></div>'
  + '<div class="stat-grid">'
  +   statTile('Faturado no mês', fmtBRL(faturado), entradasMes.length+' atendimento(s)', 'accent')
  +   statTile('Saídas no mês', fmtBRL(totalSaidas), saidasMes.length+' lançamento(s)', 'expense')
  +   statTile('Geração de caixa', fmtBRL(caixa), caixa>=0?'saldo positivo':'saldo negativo', caixa>=0?'good':'critical')
  +   statTile('Manutenções pendentes', String(pendentesManut), 'aguardando contato', pendentesManut>0?'warning':'')
  + '</div>'
  + '<div class="grid-3">'
  +   quickAction('financeiro/entradas','Nova entrada','Registrar um atendimento e o valor recebido.')
  +   quickAction('financeiro/saidas','Nova saída','Lançar um pagamento a fornecedor.')
  +   quickAction('clientes/anamnese','Nova anamnese','Preencher a ficha de uma cliente nova.')
  + '</div>'
  + '<div class="card">'
  +   '<div class="card-head"><h2>Manutenções da semana</h2><button type="button" class="btn btn-secondary btn-sm" data-action="nav" data-route="clientes/manutencoes">Ver kanban</button></div>'
  +   (pendentesManut>0
        ? '<p class="page-sub">Você tem <strong>'+pendentesManut+'</strong> cliente(s) aguardando contato para agendar manutenção.</p>'
        : '<p class="page-sub">Nenhuma manutenção pendente de contato no momento.</p>')
  + '</div>';
}

/* ================= page: entradas ================= */
function serviceSelectHtml(selectedId){
  var opts = '<option value="">Selecione um serviço</option>';
  STATE.services.forEach(function(s){
    opts += '<option value="'+s.id+'"'+(s.id===selectedId?' selected':'')+'>'+escapeHtml(s.name)+' — '+fmtBRL(s.value)+'</option>';
  });
  return '<select name="serviceId" data-action="service-change">'+opts+'</select>';
}
function valueFieldHtml(d){
  var svc = SERVICE_BY_ID(d.serviceId);
  if(d.valueEdited){
    return '<div class="actions-row"><input type="number" step="0.01" min="0" name="value" value="'+(d.value===''?'':d.value)+'" style="max-width:140px" data-action="value-input"><button type="button" class="btn btn-ghost btn-sm" data-action="lock-value">usar valor do serviço</button></div>';
  }
  var shown = svc ? fmtBRL(svc.value) : '—';
  return '<div class="actions-row"><input type="text" value="'+shown+'" readonly style="max-width:140px;background:var(--surface-3)"><button type="button" class="btn btn-ghost btn-sm" data-action="unlock-value">✎ editar</button></div>';
}
function manutencaoBlockHtml(manutDate, weekOptions, chosen){
  var opts = weekOptions.map(function(w){
    var lbl = (w.key==='recomendada'?'Semana recomendada — ':w.key==='anterior'?'Semana anterior — ':'Semana seguinte — ') + weekRangeLabel(w.start);
    return '<option value="'+w.key+'"'+(w.key===chosen?' selected':'')+'>'+lbl+'</option>';
  }).join('');
  return '<div class="card" style="background:var(--accent-soft);border-color:transparent;margin-top:14px;padding:16px 18px">'
    + '<p style="font-weight:700;font-size:13px;color:var(--accent-strong);margin-bottom:8px">Manutenção prevista para '+fmtDateFull(manutDate)+' (21 dias após o atendimento)</p>'
    + '<div class="field"><label>Semana para entrar em contato</label><select name="weekChoice">'+opts+'</select></div>'
    + '</div>';
}
function entradasTableHtml(rows){
  if(!rows.length) return emptyState('Nenhuma entrada registrada ainda.');
  var trs = rows.map(function(e){
    var manutCell = e.hasManutencao
      ? ('<span class="pill '+(e.contacted?'pill-good':'pill-accent')+'">'+(e.contacted?'contatada':'manutenção '+fmtDateBR(e.manutencaoDate))+'</span>')
      : '<span class="pill pill-neutral">—</span>';
    return '<tr>'
      + '<td>'+fmtDateBR(e.date)+'</td>'
      + '<td>'+escapeHtml(e.client)+'</td>'
      + '<td>'+escapeHtml(e.serviceName)+'</td>'
      + '<td class="num">'+fmtBRL(e.value)+'</td>'
      + '<td>'+manutCell+'</td>'
      + '<td><button type="button" class="btn btn-ghost btn-icon" data-action="delete-entrada" data-id="'+e.id+'" aria-label="Excluir">✕</button></td>'
      + '</tr>';
  }).join('');
  return '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th class="num">Valor</th><th>Manutenção</th><th></th></tr></thead><tbody>'+trs+'</tbody></table></div>';
}
function pageEntradas(){
  var d = ensureEntradaDraft();
  var manutDate = d.date ? addDays(d.date,21) : null;
  var weekBase = manutDate ? tueSatWeekStart(manutDate) : null;
  var weekOptions = [];
  if(weekBase){
    weekOptions = [
      {key:'anterior', start: addDays(weekBase,-7)},
      {key:'recomendada', start: weekBase},
      {key:'seguinte', start: addDays(weekBase,7)}
    ];
  }
  var rows = STATE.entradas.slice().sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0; }).slice(0,60);

  return ''
   + '<div class="page-head"><div><span class="eyebrow">Financeiro</span><h1>Entradas</h1>'
   + '<p class="page-sub">Registre cada atendimento realizado e o valor recebido.</p></div></div>'
   + '<div class="card">'
   +   '<form data-form="entrada">'
   +     '<div class="grid-2">'
   +       field('Data do atendimento','<input type="date" name="date" value="'+d.date+'" required>')
   +       field('Cliente <span class="req">*</span>','<input type="text" name="client" placeholder="Nome da cliente" value="'+escapeHtml(d.client)+'" required>')
   +     '</div>'
   +     '<div class="grid-2" style="margin-top:14px">'
   +       field('Serviço', serviceSelectHtml(d.serviceId))
   +       field('Valor', valueFieldHtml(d))
   +     '</div>'
   +     '<div style="margin-top:16px">'
   +       '<label class="checkbox-row"><input type="checkbox" name="hasManutencao" '+(d.hasManutencao?'checked':'')+'><span>Esta cliente terá manutenção futura</span></label>'
   +     '</div>'
   +     (d.hasManutencao && manutDate ? manutencaoBlockHtml(manutDate, weekOptions, d.weekChoice) : '')
   +     '<div class="actions-row" style="margin-top:18px">'
   +       '<button type="submit" class="btn btn-primary">Salvar entrada</button>'
   +       '<button type="button" class="btn btn-ghost" data-action="reset-entrada-draft">Limpar</button>'
   +     '</div>'
   +   '</form>'
   + '</div>'
   + '<div class="card">'
   +   '<div class="card-head"><h2>Últimas entradas</h2><span class="pill pill-neutral">'+STATE.entradas.length+' no total</span></div>'
   +   entradasTableHtml(rows)
   + '</div>';
}
function submitEntrada(form){
  var fd = new FormData(form);
  var date = fd.get('date') || todayISO();
  var client = (fd.get('client')||'').toString().trim();
  var serviceId = fd.get('serviceId')||'';
  var svc = SERVICE_BY_ID(serviceId);
  if(!client){ toast('Informe o nome da cliente.', true); return; }
  if(!svc){ toast('Selecione um serviço.', true); return; }
  var d = draft.entrada;
  var value = d.valueEdited ? parseFloat(fd.get('value')) : svc.value;
  if(isNaN(value) || value<0) value = svc.value;
  var hasManutencao = !!fd.get('hasManutencao');
  var entry = {
    id: uid('e_'), date: date, client: client, serviceId: svc.id, serviceName: svc.name, value: value,
    hasManutencao: hasManutencao, manutencaoDate: null, weekStart: null, kanbanDay: null, contacted: false
  };
  if(hasManutencao){
    var manutDate = addDays(date,21);
    var weekBase = tueSatWeekStart(manutDate);
    var choice = fd.get('weekChoice') || 'recomendada';
    var weekStart = choice==='anterior' ? addDays(weekBase,-7) : choice==='seguinte' ? addDays(weekBase,7) : weekBase;
    entry.manutencaoDate = manutDate;
    entry.weekStart = weekStart;
    entry.kanbanDay = defaultKanbanDay(manutDate);
  }
  STATE.entradas.push(entry);
  draft.entrada = null;
  toast('Entrada salva.');
  persist();
}
function deleteEntrada(id){ STATE.entradas = STATE.entradas.filter(function(e){ return e.id!==id; }); toast('Entrada removida.'); persist(); }

/* ================= page: saídas ================= */
function paymentSelectHtml(){
  var opts = PAYMENT_METHODS.map(function(m){ return '<option value="'+m+'">'+m+'</option>'; }).join('');
  return '<select name="formaPagamento">'+opts+'</select>';
}
function planoContasSelectHtml(){
  if(!STATE.planoContas.length) return '<select disabled><option>Cadastre um plano de contas em Configurações</option></select>';
  var opts = STATE.planoContas.map(function(p){ return '<option value="'+p.id+'">'+escapeHtml(p.name)+'</option>'; }).join('');
  return '<select name="planoContaId">'+opts+'</select>';
}
function saidasTableHtml(rows){
  if(!rows.length) return emptyState('Nenhuma saída registrada ainda.');
  var trs = rows.map(function(s){
    return '<tr>'
     + '<td>'+fmtDateBR(s.date)+'</td>'
     + '<td>'+escapeHtml(s.fornecedor||'—')+'</td>'
     + '<td class="num">'+fmtBRL(s.valor)+'</td>'
     + '<td>'+escapeHtml(s.formaPagamento||'—')+'</td>'
     + '<td><span class="pill pill-expense">'+escapeHtml(s.planoContaName||'—')+'</span></td>'
     + '<td><button type="button" class="btn btn-ghost btn-icon" data-action="delete-saida" data-id="'+s.id+'" aria-label="Excluir">✕</button></td>'
     + '</tr>';
  }).join('');
  return '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Fornecedor</th><th class="num">Valor</th><th>Forma</th><th>Plano de contas</th><th></th></tr></thead><tbody>'+trs+'</tbody></table></div>';
}
function pageSaidas(){
  var rows = STATE.saidas.slice().sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0; }).slice(0,60);
  return ''
  + '<div class="page-head"><div><span class="eyebrow">Financeiro</span><h1>Saídas</h1>'
  + '<p class="page-sub">Lance os pagamentos feitos a fornecedores e despesas do dia a dia.</p></div></div>'
  + '<div class="card">'
  +   '<form data-form="saida">'
  +     '<div class="grid-2">'
  +       field('Data do pagamento','<input type="date" name="date" value="'+todayISO()+'" required>')
  +       field('Fornecedor','<input type="text" name="fornecedor" placeholder="Ex: Distribuidora Beleza Pura">')
  +     '</div>'
  +     '<div class="grid-2" style="margin-top:14px">'
  +       field('Valor pago <span class="req">*</span>','<input type="number" step="0.01" min="0" name="valor" placeholder="0,00" required>')
  +       field('Forma de pagamento', paymentSelectHtml())
  +     '</div>'
  +     '<div style="margin-top:14px">'
  +       field('Plano de contas <span class="req">*</span>', planoContasSelectHtml())
  +     '</div>'
  +     '<div class="actions-row" style="margin-top:18px">'
  +       '<button type="submit" class="btn btn-primary">Salvar saída</button>'
  +     '</div>'
  +   '</form>'
  + '</div>'
  + '<div class="card">'
  +   '<div class="card-head"><h2>Últimas saídas</h2><span class="pill pill-neutral">'+STATE.saidas.length+' no total</span></div>'
  +   saidasTableHtml(rows)
  + '</div>';
}
function submitSaida(form){
  var fd = new FormData(form);
  var valor = parseFloat(fd.get('valor'));
  var planoContaId = fd.get('planoContaId');
  if(isNaN(valor) || valor<=0){ toast('Informe um valor válido.', true); return; }
  if(!planoContaId){ toast('Selecione um plano de contas.', true); return; }
  var plano = PLANO_BY_ID(planoContaId);
  STATE.saidas.push({
    id: uid('sa_'), date: fd.get('date')||todayISO(), fornecedor: (fd.get('fornecedor')||'').toString().trim(),
    valor: valor, formaPagamento: fd.get('formaPagamento'), planoContaId: planoContaId, planoContaName: plano?plano.name:''
  });
  toast('Saída salva.');
  persist();
}
function deleteSaida(id){ STATE.saidas = STATE.saidas.filter(function(s){return s.id!==id;}); toast('Saída removida.'); persist(); }

/* ================= page: DFC ================= */
function pageDFC(){
  if(!ui.dfcMonth) ui.dfcMonth = currentYYYYMM();
  var range = monthRange(ui.dfcMonth);
  var entradasP = STATE.entradas.filter(function(e){ return inRange(e.date, range.start, range.end); });
  var saidasP = STATE.saidas.filter(function(s){ return inRange(s.date, range.start, range.end); });
  var faturado = sumBy(entradasP,'value');
  var recebido = faturado;
  var totalSaidas = sumBy(saidasP,'valor');
  var caixa = recebido - totalSaidas;

  var byPlano = {};
  saidasP.forEach(function(s){
    var key = s.planoContaId || 'sem-plano';
    if(!byPlano[key]) byPlano[key] = { name: s.planoContaName || 'Sem plano de contas', total: 0 };
    byPlano[key].total += Number(s.valor)||0;
  });
  var planoRows = Object.keys(byPlano).map(function(k){ return byPlano[k]; }).sort(function(a,b){ return b.total-a.total; });
  var maxPlano = planoRows.reduce(function(m,r){ return Math.max(m,r.total); }, 0);

  return ''
  + '<div class="page-head"><div><span class="eyebrow">Financeiro</span><h1>DFC — Demonstrativo de Fluxo de Caixa</h1>'
  + '<p class="page-sub">Faturamento, recebimentos e saídas agrupadas por plano de contas.</p></div>'
  + '<div class="field" style="max-width:190px"><label>Período</label><input type="month" value="'+ui.dfcMonth+'" data-action="dfc-month"></div>'
  + '</div>'
  + '<div class="stat-grid">'
  +   statTile('Faturou', fmtBRL(faturado), entradasP.length+' atendimento(s)', 'accent')
  +   statTile('Recebeu', fmtBRL(recebido), 'regime de caixa', 'accent')
  +   statTile('Saídas', fmtBRL(totalSaidas), saidasP.length+' lançamento(s)', 'expense')
  +   statTile('Geração de caixa', fmtBRL(caixa), caixa>=0?'positivo no período':'negativo no período', caixa>=0?'good':'critical')
  + '</div>'
  + '<div class="card">'
  +   '<div class="card-head"><h2>Saídas por plano de contas</h2></div>'
  +   (planoRows.length ? barListHtml(planoRows.map(function(r){ return {label:r.name, value:r.total}; }), maxPlano, 'expense') : emptyState('Nenhuma saída neste período.'))
  + '</div>';
}

/* ================= page: anamnese ================= */
function anamneseFormHtml(){
  var d = ensureAnamneseDraft();
  var qs = ANAMNESE_QUESTIONS.map(function(q){
    var a = d.answers[q.key];
    return '<div class="qa-item">'
      + '<div class="qa-q">'+escapeHtml(q.label)+'</div>'
      + '<div class="radio-row">'
      +   '<label class="radio-opt"><input type="radio" name="q_'+q.key+'" value="sim" '+(a.value==='sim'?'checked':'')+' data-action="anamnese-radio" data-key="'+q.key+'">Sim</label>'
      +   '<label class="radio-opt"><input type="radio" name="q_'+q.key+'" value="nao" '+(a.value==='nao'?'checked':'')+' data-action="anamnese-radio" data-key="'+q.key+'">Não</label>'
      + '</div>'
      + (q.detail && a.value==='sim' ? '<input type="text" style="margin-top:8px" placeholder="Detalhe (qual produto, medicamento, etc.)" value="'+escapeHtml(a.detail)+'" data-action="anamnese-detail" data-key="'+q.key+'">' : '')
      + '</div>';
  }).join('');
  return '<div class="card"><form data-form="anamnese">'
   + '<div class="grid-2">'
   +   field('Nome completo da cliente <span class="req">*</span>','<input type="text" name="client" value="'+escapeHtml(d.client)+'" required>')
   +   field('Telefone / WhatsApp','<input type="tel" name="phone" value="'+escapeHtml(d.phone)+'" placeholder="(00) 00000-0000">')
   + '</div>'
   + '<div class="grid-2" style="margin-top:14px">'
   +   field('Data de nascimento','<input type="date" name="birth" value="'+d.birth+'">')
   +   field('Data da anamnese','<input type="date" name="date" value="'+todayISO()+'">')
   + '</div>'
   + '<hr class="divider">'
   + qs
   + '<div class="field" style="margin-top:8px"><label>Observações adicionais</label><textarea name="obs">'+escapeHtml(d.obs)+'</textarea></div>'
   + '<div class="actions-row" style="margin-top:18px"><button type="submit" class="btn btn-primary">Salvar anamnese</button></div>'
   + '</form></div>';
}
function anamneseListHtml(){
  if(!STATE.anamneses.length) return '<div class="card">'+emptyState('Nenhuma anamnese registrada ainda.')+'</div>';
  var rows = STATE.anamneses.slice().sort(function(a,b){ return a.date<b.date?1:a.date>b.date?-1:0; }).map(function(a){
    var qa = ANAMNESE_QUESTIONS.map(function(q){
      var ans = a.answers[q.key] || {value:'',detail:''};
      var val = ans.value==='sim' ? ('Sim' + (ans.detail?(' — '+escapeHtml(ans.detail)):'')) : ans.value==='nao' ? 'Não' : '—';
      return '<div class="qa-item"><div class="qa-q">'+escapeHtml(q.label)+'</div><div class="qa-a">'+val+'</div></div>';
    }).join('');
    return '<details class="anamnese-row">'
     + '<summary><span>'+escapeHtml(a.client)+'</span><span class="pill pill-neutral">'+fmtDateBR(a.date)+'</span></summary>'
     + '<div class="qa-body">'
     +   '<div class="qa-item"><div class="qa-q">Telefone</div><div class="qa-a">'+escapeHtml(a.phone||'—')+'</div></div>'
     +   '<div class="qa-item"><div class="qa-q">Data de nascimento</div><div class="qa-a">'+(a.birth?fmtDateBR(a.birth):'—')+'</div></div>'
     +   qa
     +   (a.obs ? '<div class="qa-item"><div class="qa-q">Observações</div><div class="qa-a">'+escapeHtml(a.obs)+'</div></div>' : '')
     +   '<div class="actions-row" style="margin-top:10px"><button type="button" class="btn btn-danger btn-sm" data-action="delete-anamnese" data-id="'+a.id+'">Excluir ficha</button></div>'
     + '</div></details>';
  }).join('');
  return '<div>'+rows+'</div>';
}
function pageAnamnese(){
  if(!ui.anamneseTab) ui.anamneseTab = 'nova';
  return ''
  + '<div class="page-head"><div><span class="eyebrow">Clientes</span><h1>Anamnese</h1>'
  + '<p class="page-sub">Ficha de avaliação obrigatória para toda cliente nova.</p></div></div>'
  + '<div class="tabs">'
  +   '<button type="button" class="tab-btn'+(ui.anamneseTab==='nova'?' active':'')+'" data-action="anamnese-tab" data-tab="nova">Nova anamnese</button>'
  +   '<button type="button" class="tab-btn'+(ui.anamneseTab==='lista'?' active':'')+'" data-action="anamnese-tab" data-tab="lista">Anamneses realizadas ('+STATE.anamneses.length+')</button>'
  + '</div>'
  + (ui.anamneseTab==='nova' ? anamneseFormHtml() : anamneseListHtml());
}
function submitAnamnese(form){
  var fd = new FormData(form);
  var client = (fd.get('client')||'').toString().trim();
  if(!client){ toast('Informe o nome da cliente.', true); return; }
  var d = draft.anamnese;
  var answersOut = {};
  ANAMNESE_QUESTIONS.forEach(function(q){ answersOut[q.key] = { value: d.answers[q.key].value||'', detail: d.answers[q.key].detail||'' }; });
  STATE.anamneses.push({
    id: uid('an_'), client: client, phone:(fd.get('phone')||'').toString().trim(),
    birth: fd.get('birth')||'', date: fd.get('date')||todayISO(), answers: answersOut, obs: (fd.get('obs')||'').toString().trim()
  });
  draft.anamnese = null;
  ui.anamneseTab = 'lista'; saveUi();
  toast('Anamnese salva.');
  persist();
}
function deleteAnamnese(id){ STATE.anamneses = STATE.anamneses.filter(function(a){return a.id!==id;}); toast('Ficha removida.'); persist(); }

/* ================= page: manutenções da semana ================= */
function kanbanCardHtml(c){
  var opts = KANBAN_DAYS.map(function(day){ return '<option value="'+day+'"'+(day===c.kanbanDay?' selected':'')+'>'+day+'</option>'; }).join('');
  return '<div class="kcard'+(c.contacted?' done':'')+'">'
   + '<span class="kname">'+escapeHtml(c.client)+'</span>'
   + '<span class="kmeta">'+escapeHtml(c.serviceName)+' · atendida em '+fmtDateBR(c.date)+'</span>'
   + '<span class="kmeta">manutenção prevista: '+fmtDateBR(c.manutencaoDate)+'</span>'
   + '<div class="kcard-foot">'
   +   '<select data-action="move-kanban-day" data-id="'+c.id+'">'+opts+'</select>'
   +   '<button type="button" class="btn btn-sm '+(c.contacted?'btn-secondary':'btn-primary')+'" data-action="toggle-contacted" data-id="'+c.id+'">'+(c.contacted?'Reabrir':'Contatada ✓')+'</button>'
   + '</div>'
   + '</div>';
}
function pageManutencoes(){
  var pendentes = STATE.entradas.filter(function(e){ return e.hasManutencao && e.weekStart; });
  if(!ui.manutWeek){
    var weeksWithPending = pendentes.filter(function(e){ return !e.contacted; }).map(function(e){return e.weekStart;}).sort();
    ui.manutWeek = weeksWithPending.length ? weeksWithPending[0] : tueSatWeekStart(todayISO());
  }
  var weekStart = ui.manutWeek;
  var cards = pendentes.filter(function(e){ return e.weekStart===weekStart; });
  var cols = KANBAN_DAYS.map(function(day){
    var dayCards = cards.filter(function(c){ return c.kanbanDay===day; });
    var items = dayCards.length ? dayCards.map(kanbanCardHtml).join('') : '<div class="kanban-empty">Sem clientes</div>';
    return '<div class="kanban-col"><div class="kanban-col-head"><strong>'+day+'</strong><span class="kanban-count">'+dayCards.length+'</span></div>'+items+'</div>';
  }).join('');

  return ''
  + '<div class="page-head"><div><span class="eyebrow">Clientes</span><h1>Manutenções da Semana</h1>'
  + '<p class="page-sub">Clientes para avisar sobre manutenção, organizadas por dia de contato.</p></div></div>'
  + '<div class="week-nav">'
  +   '<button type="button" class="btn btn-secondary btn-icon" data-action="week-prev" aria-label="Semana anterior">←</button>'
  +   '<span class="week-label">Semana de '+weekRangeLabel(weekStart)+'</span>'
  +   '<button type="button" class="btn btn-secondary btn-icon" data-action="week-next" aria-label="Próxima semana">→</button>'
  +   '<button type="button" class="btn btn-ghost btn-sm" data-action="week-today">Semana atual</button>'
  + '</div>'
  + '<div class="kanban">'+cols+'</div>';
}
function moveKanbanDay(id, day){ var e = ENTRADA_BY_ID(id); if(e){ e.kanbanDay = day; persist(); } }
function toggleContacted(id){ var e = ENTRADA_BY_ID(id); if(e){ e.contacted = !e.contacted; persist(); } }
function weekPrev(){ ui.manutWeek = addDays(ui.manutWeek,-7); saveUi(); render(); }
function weekNext(){ ui.manutWeek = addDays(ui.manutWeek,7); saveUi(); render(); }
function weekToday(){ ui.manutWeek = tueSatWeekStart(todayISO()); saveUi(); render(); }

/* ================= page: indicadores ================= */
function periodRange(key){
  var now = todayISO();
  if(key==='mes'){ return monthRange(currentYYYYMM()); }
  if(key==='mes-passado'){
    var d = parseISO(currentYYYYMM()+'-01'); d.setMonth(d.getMonth()-1);
    var ym = d.getFullYear()+'-'+pad2(d.getMonth()+1);
    return monthRange(ym);
  }
  if(key==='3meses'){
    var d3 = parseISO(now); d3.setMonth(d3.getMonth()-3);
    return { start: toISO(d3), end: now };
  }
  return { start:'0000-01-01', end:'9999-12-31' };
}
function pageIndicadores(){
  if(!ui.indPeriod) ui.indPeriod = 'mes';
  var range = periodRange(ui.indPeriod);
  var entradasP = STATE.entradas.filter(function(e){ return inRange(e.date, range.start, range.end); });
  var faturamento = sumBy(entradasP,'value');
  var atendimentos = entradasP.length;
  var ticketMedio = atendimentos ? faturamento/atendimentos : 0;

  var byService = {};
  entradasP.forEach(function(e){
    if(!byService[e.serviceId]) byService[e.serviceId] = { name: e.serviceName, total:0, count:0 };
    byService[e.serviceId].total += Number(e.value)||0;
    byService[e.serviceId].count += 1;
  });
  var serviceRows = Object.keys(byService).map(function(k){return byService[k];}).sort(function(a,b){ return b.total-a.total; });
  var maisRealizado = serviceRows.length ? serviceRows.slice().sort(function(a,b){return b.count-a.count;})[0] : null;
  var maxServiceTotal = serviceRows.reduce(function(m,r){return Math.max(m,r.total);},0);

  var manutOportunidades = entradasP.filter(function(e){ return e.hasManutencao; });
  var manutContatadas = manutOportunidades.filter(function(e){ return e.contacted; });
  var taxaManut = manutOportunidades.length ? Math.round((manutContatadas.length/manutOportunidades.length)*100) : null;

  var periodSelect = '<select data-action="ind-period">'
    + opt('mes','Este mês',ui.indPeriod) + opt('mes-passado','Mês passado',ui.indPeriod)
    + opt('3meses','Últimos 3 meses',ui.indPeriod) + opt('todos','Todo o período',ui.indPeriod)
    + '</select>';

  return ''
  + '<div class="page-head"><div><span class="eyebrow">Análise</span><h1>Indicadores</h1>'
  + '<p class="page-sub">Desempenho do seu trabalho no período selecionado.</p></div>'
  + '<div class="field" style="max-width:190px"><label>Período</label>'+periodSelect+'</div>'
  + '</div>'
  + '<div class="stat-grid">'
  +   statTile('Faturamento', fmtBRL(faturamento), null, 'accent')
  +   statTile('Atendimentos', String(atendimentos), null, '')
  +   statTile('Ticket médio', fmtBRL(ticketMedio), null, '')
  +   statTile('Serviço mais realizado', maisRealizado?maisRealizado.name:'—', maisRealizado?(maisRealizado.count+' vez(es)'):null, 'accent')
  + '</div>'
  + '<div class="card">'
  +   '<div class="card-head"><h2>Faturamento por serviço</h2></div>'
  +   (serviceRows.length ? barListHtml(serviceRows.map(function(r){ return {label:r.name, value:r.total, sub:r.count+' atendimento(s)'}; }), maxServiceTotal, 'accent') : emptyState('Nenhum atendimento neste período.'))
  + '</div>'
  + '<div class="card">'
  +   '<div class="card-head"><h2>Taxa de retorno para manutenção</h2></div>'
  +   (taxaManut===null
      ? '<p class="page-sub">Nenhuma manutenção agendada neste período ainda.</p>'
      : '<div class="stat-tile" style="max-width:260px"><span class="label">Contatadas / agendadas</span><span class="value mono">'+taxaManut+'%</span><span class="hint">'+manutContatadas.length+' de '+manutOportunidades.length+' manutenções contatadas</span></div>')
  + '</div>';
}

/* ================= page: configurações ================= */
function servicesListHtml(){
  if(!STATE.services.length) return emptyState('Nenhum serviço cadastrado.');
  return STATE.services.map(function(s){
    if(draft.editingServiceId===s.id){
      return '<div class="svc-row">'
       + '<input type="text" class="editrow-input" style="flex:1" value="'+escapeHtml(s.name)+'" data-edit="name">'
       + '<input type="number" step="0.01" min="0" class="editrow-input" style="width:100px" value="'+s.value+'" data-edit="value">'
       + '<div class="svc-actions">'
       +   '<button type="button" class="btn btn-primary btn-sm" data-action="save-service" data-id="'+s.id+'">Salvar</button>'
       +   '<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit-service">Cancelar</button>'
       + '</div></div>';
    }
    return '<div class="svc-row">'
     + '<span class="svc-name">'+escapeHtml(s.name)+'</span>'
     + '<span class="svc-value mono">'+fmtBRL(s.value)+'</span>'
     + '<div class="svc-actions">'
     +   '<button type="button" class="btn btn-ghost btn-icon" data-action="edit-service" data-id="'+s.id+'" aria-label="Editar">✎</button>'
     +   '<button type="button" class="btn btn-ghost btn-icon" data-action="delete-service" data-id="'+s.id+'" aria-label="Excluir">✕</button>'
     + '</div></div>';
  }).join('');
}
function planosListHtml(){
  if(!STATE.planoContas.length) return emptyState('Nenhuma categoria cadastrada.');
  return STATE.planoContas.map(function(p){
    if(draft.editingPlanoId===p.id){
      return '<div class="svc-row">'
       + '<input type="text" class="editrow-input" style="flex:1" value="'+escapeHtml(p.name)+'" data-edit="name">'
       + '<div class="svc-actions">'
       +   '<button type="button" class="btn btn-primary btn-sm" data-action="save-plano" data-id="'+p.id+'">Salvar</button>'
       +   '<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit-plano">Cancelar</button>'
       + '</div></div>';
    }
    return '<div class="svc-row">'
     + '<span class="svc-name">'+escapeHtml(p.name)+'</span>'
     + '<div class="svc-actions">'
     +   '<button type="button" class="btn btn-ghost btn-icon" data-action="edit-plano" data-id="'+p.id+'" aria-label="Editar">✎</button>'
     +   '<button type="button" class="btn btn-ghost btn-icon" data-action="delete-plano" data-id="'+p.id+'" aria-label="Excluir">✕</button>'
     + '</div></div>';
  }).join('');
}
function pageConfig(){
  return ''
  + '<div class="page-head"><div><span class="eyebrow">Configurações</span><h1>Serviços e plano de contas</h1>'
  + '<p class="page-sub">Ajuste os valores dos seus serviços e as categorias usadas nas saídas.</p></div></div>'
  + '<div class="card">'
  +   '<div class="card-head"><h2>Serviços</h2></div>'
  +   servicesListHtml()
  +   '<form data-form="novo-servico" class="new-svc-form">'
  +     '<input type="text" name="name" placeholder="Nome do novo serviço" required>'
  +     '<input type="number" step="0.01" min="0" name="value" placeholder="Valor (R$)" style="max-width:130px" required>'
  +     '<button type="submit" class="btn btn-primary btn-sm">+ Adicionar serviço</button>'
  +   '</form>'
  + '</div>'
  + '<div class="card">'
  +   '<div class="card-head"><h2>Plano de contas</h2></div>'
  +   planosListHtml()
  +   '<form data-form="novo-plano" class="new-svc-form">'
  +     '<input type="text" name="name" placeholder="Nome da categoria" required>'
  +     '<button type="submit" class="btn btn-primary btn-sm">+ Adicionar categoria</button>'
  +   '</form>'
  + '</div>'
  + '<div class="card">'
  +   '<div class="card-head"><h2>Backup dos dados</h2></div>'
  +   '<p class="page-sub" style="margin-bottom:14px">Baixe uma cópia de segurança com todos os dados do painel (serviços, plano de contas, entradas, saídas e anamneses), ou restaure a partir de um arquivo salvo anteriormente.</p>'
  +   '<div class="actions-row">'
  +     '<button type="button" class="btn btn-primary" data-action="backup-download">⬇ Baixar backup (.json)</button>'
  +     '<button type="button" class="btn btn-secondary" data-action="backup-restore-trigger">⬆ Restaurar backup</button>'
  +     '<input type="file" accept="application/json" id="backup-file-input" data-action="backup-file-change" style="display:none">'
  +   '</div>'
  +   '<p class="help" style="margin-top:10px">Atenção: restaurar um backup substitui todos os dados atuais do painel pelos dados do arquivo escolhido.</p>'
  + '</div>';
}
function saveServiceEdit(id, row){
  var name = row.querySelector('[data-edit="name"]').value.trim();
  var value = parseFloat(row.querySelector('[data-edit="value"]').value);
  if(!name){ toast('Informe um nome para o serviço.', true); return; }
  if(isNaN(value) || value<0){ toast('Informe um valor válido.', true); return; }
  var s = SERVICE_BY_ID(id);
  if(s){ s.name = name; s.value = value; }
  draft.editingServiceId = null;
  toast('Serviço atualizado.');
  persist();
}
function deleteService(id){
  if(!confirm('Excluir este serviço?')) return;
  STATE.services = STATE.services.filter(function(s){return s.id!==id;});
  toast('Serviço removido.');
  persist();
}
function submitNovoServico(form){
  var fd = new FormData(form);
  var name = (fd.get('name')||'').toString().trim();
  var value = parseFloat(fd.get('value'));
  if(!name || isNaN(value) || value<0){ toast('Preencha nome e valor do serviço.', true); return; }
  STATE.services.push({ id: uid('s_'), name:name, value:value });
  toast('Serviço adicionado.');
  persist();
}
function savePlanoEdit(id, row){
  var name = row.querySelector('[data-edit="name"]').value.trim();
  if(!name){ toast('Informe um nome para a categoria.', true); return; }
  var p = PLANO_BY_ID(id);
  if(p){ p.name = name; STATE.saidas.forEach(function(s){ if(s.planoContaId===id) s.planoContaName = name; }); }
  draft.editingPlanoId = null;
  toast('Categoria atualizada.');
  persist();
}
function deletePlano(id){
  if(!confirm('Excluir esta categoria? As saídas já lançadas manterão o nome atual.')) return;
  STATE.planoContas = STATE.planoContas.filter(function(p){return p.id!==id;});
  toast('Categoria removida.');
  persist();
}
function submitNovoPlano(form){
  var fd = new FormData(form);
  var name = (fd.get('name')||'').toString().trim();
  if(!name){ toast('Informe um nome para a categoria.', true); return; }
  STATE.planoContas.push({ id: uid('p_'), name:name });
  toast('Categoria adicionada.');
  persist();
}

/* ================= backup (export / import) ================= */
function downloadBackup(){
  try{
    var payload = JSON.stringify(STATE, null, 2);
    var blob = new Blob([payload], { type:'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = todayISO();
    a.href = url;
    a.download = 'backup-painel-amanda-'+stamp+'.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    toast('Backup baixado.');
  }catch(err){
    toast('Não foi possível gerar o backup.', true);
  }
}
function restoreBackupFromFile(file){
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    var parsed;
    try{ parsed = JSON.parse(reader.result); }
    catch(err){ toast('Arquivo inválido: não é um JSON válido.', true); return; }
    if(!confirm('Restaurar este backup vai substituir todos os dados atuais do painel. Deseja continuar?')) return;
    STATE = normalizeState(parsed);
    toast('Backup restaurado.');
    persist();
  };
  reader.onerror = function(){ toast('Não foi possível ler o arquivo.', true); };
  reader.readAsText(file);
}

/* ================= render dispatch ================= */
function renderPage(route){
  var el = document.getElementById('page');
  if(!el) return;
  if(route==='inicio') el.innerHTML = pageInicio();
  else if(route==='financeiro/entradas') el.innerHTML = pageEntradas();
  else if(route==='financeiro/saidas') el.innerHTML = pageSaidas();
  else if(route==='financeiro/dfc') el.innerHTML = pageDFC();
  else if(route==='clientes/anamnese') el.innerHTML = pageAnamnese();
  else if(route==='clientes/manutencoes') el.innerHTML = pageManutencoes();
  else if(route==='indicadores') el.innerHTML = pageIndicadores();
  else if(route==='config') el.innerHTML = pageConfig();
  else el.innerHTML = pageInicio();
}
function navLink(route, label){
  var r = currentRoute();
  var active = r===route ? ' active' : '';
  return '<button type="button" class="nav-link'+active+'" data-action="nav" data-route="'+route+'">'+label+'</button>';
}
function navGroupLabel(text){
  return '<div class="nav-link" style="cursor:default;color:var(--ink-mute);font-size:11px;text-transform:uppercase;letter-spacing:.07em;padding-top:12px;padding-bottom:2px">'+text+'</div>';
}
function shellHtml(){
  var mobileOpenClass = ui.mobileNavOpen ? ' open' : '';
  return ''
  + '<div class="shell">'
  +   '<aside class="sidebar'+mobileOpenClass+'" id="sidebar">'
  +     '<div class="brand">'
  +       '<img class="brand-mark" src="/logo.jpg" alt="Amanda Pereira - Arts in Nails">'
  +       '<div class="brand-text"><strong>'+escapeHtml(STATE.meta.negocio||'Amanda Nails')+'</strong><span>Painel de gestão</span></div>'
  +       '<button type="button" class="mob-toggle" data-action="mobile-toggle" aria-label="Abrir menu">☰</button>'
  +     '</div>'
  +     '<div class="nav-wrap"><nav class="nav">'
  +       navLink('inicio','Início')
  +       '<div class="nav-group">'
  +         navGroupLabel('Financeiro')
  +         '<div class="nav-sub">'+navLink('financeiro/entradas','Entradas')+navLink('financeiro/saidas','Saídas')+navLink('financeiro/dfc','DFC')+'</div>'
  +       '</div>'
  +       '<div class="nav-group">'
  +         navGroupLabel('Clientes')
  +         '<div class="nav-sub">'+navLink('clientes/anamnese','Anamnese')+navLink('clientes/manutencoes','Manutenções da Semana')+'</div>'
  +       '</div>'
  +       navLink('indicadores','Indicadores')
  +       navLink('config','Configurações')
  +     '</nav>'
  +     '<div class="sidebar-foot"><button type="button" class="btn btn-ghost btn-sm" data-action="lock-panel">Bloquear painel</button></div>'
  +     '</div>'
  +   '</aside>'
  +   '<div class="main" id="main-col">'
  +     '<div id="page"></div>'
  +   '</div>'
  + '</div>';
}
function render(){
  var route = currentRoute();
  ui.route = route; saveUi();
  var app = document.getElementById('app');
  if(!app) return;
  app.innerHTML = shellHtml();
  renderPage(route);
}

/* ================= toast ================= */
function toast(msg, isErr){
  var wrap = document.getElementById('toast-wrap');
  if(!wrap){ wrap = document.createElement('div'); wrap.className='toast-wrap'; wrap.id='toast-wrap'; document.body.appendChild(wrap); }
  var t = document.createElement('div');
  t.className = 'toast'+(isErr?' err':'');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 3200);
}

/* ================= persistence (server API + Vercel Blob) ================= */
var API_URL = '/api/state';
var PW_KEY = 'amanda-panel-pw';
function getStoredPassword(){ try{ return localStorage.getItem(PW_KEY)||''; }catch(err){ return ''; } }
function setStoredPassword(pw){ try{ localStorage.setItem(PW_KEY, pw); }catch(err){} }
function clearStoredPassword(){ try{ localStorage.removeItem(PW_KEY); }catch(err){} }

function apiGet(){
  return fetch(API_URL, { headers: { 'x-panel-password': getStoredPassword() } }).then(function(res){
    if(res.status===401) return { ok:false, status:401 };
    if(!res.ok) return { ok:false, status:res.status };
    return res.json().then(function(data){ return { ok:true, status:200, data:data }; });
  });
}
function apiPost(state){
  return fetch(API_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-panel-password': getStoredPassword() },
    body: JSON.stringify(state)
  }).then(function(res){ return { ok: res.ok, status: res.status }; });
}
function persist(){
  render();
  apiPost(STATE).then(function(result){
    if(!result.ok){
      if(result.status===401){
        clearStoredPassword();
        renderGate('Sessão expirada. Digite a senha novamente para continuar.');
        return;
      }
      toast('Não foi possível salvar agora. Verifique sua conexão.', true);
    }
  }).catch(function(){ toast('Sem conexão — não foi possível salvar.', true); });
}

/* ================= boot / access gate ================= */
function renderLoading(){
  var app = document.getElementById('app');
  if(app) app.innerHTML = '<div class="boot-screen"><div class="boot-card" style="text-align:center">Carregando painel…</div></div>';
}
function renderConnError(){
  var app = document.getElementById('app');
  if(!app) return;
  app.innerHTML = '<div class="boot-screen"><div class="boot-card" style="text-align:center">'
   + '<p style="margin-bottom:16px">Não foi possível conectar ao servidor.</p>'
   + '<button type="button" class="btn btn-primary" data-action="retry-load">Tentar novamente</button>'
   + '</div></div>';
}
function renderGate(errorMsg){
  var app = document.getElementById('app');
  if(!app) return;
  app.innerHTML = '<div class="boot-screen"><form class="boot-card" data-form="gate-password" style="text-align:center">'
   + '<img class="boot-logo" src="/logo.jpg" alt="Amanda Pereira - Arts in Nails">'
   + '<p class="page-sub" style="margin-bottom:22px">Digite a senha para acessar o painel.</p>'
   + (errorMsg ? '<p style="color:var(--critical);font-size:13px;margin-bottom:14px">'+escapeHtml(errorMsg)+'</p>' : '')
   + '<div class="field" style="text-align:left"><label>Senha</label><input type="password" name="password" autofocus></div>'
   + '<button type="submit" class="btn btn-primary btn-block" style="margin-top:16px">Entrar</button>'
   + '</form></div>';
}
function tryLoad(){
  renderLoading();
  apiGet().then(function(result){
    if(!result.ok && result.status===401){ renderGate(getStoredPassword() ? 'Senha incorreta.' : null); return; }
    if(!result.ok){ renderConnError(); return; }
    var isFirstRun = !result.data.state;
    STATE = normalizeState(result.data.state);
    if(!location.hash) location.hash = '#/' + (ui.route || 'inicio');
    render();
    if(isFirstRun){ apiPost(STATE); }
  }).catch(function(){ renderConnError(); });
}

/* ================= global events (attached once) ================= */
function initEvents(){
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-action]');
    if(!btn) return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');
    if(action==='nav'){ navigate(btn.getAttribute('data-route')); ui.mobileNavOpen=false; saveUi(); }
    else if(action==='mobile-toggle'){ ui.mobileNavOpen = !ui.mobileNavOpen; saveUi(); render(); }
    else if(action==='delete-entrada'){ deleteEntrada(id); }
    else if(action==='delete-saida'){ deleteSaida(id); }
    else if(action==='delete-anamnese'){ deleteAnamnese(id); }
    else if(action==='anamnese-tab'){ ui.anamneseTab = btn.getAttribute('data-tab'); saveUi(); renderPage(currentRoute()); }
    else if(action==='toggle-contacted'){ toggleContacted(id); }
    else if(action==='week-prev'){ weekPrev(); }
    else if(action==='week-next'){ weekNext(); }
    else if(action==='week-today'){ weekToday(); }
    else if(action==='edit-service'){ draft.editingServiceId = id; renderPage(currentRoute()); }
    else if(action==='cancel-edit-service'){ draft.editingServiceId = null; renderPage(currentRoute()); }
    else if(action==='save-service'){ saveServiceEdit(id, btn.closest('.svc-row')); }
    else if(action==='delete-service'){ deleteService(id); }
    else if(action==='edit-plano'){ draft.editingPlanoId = id; renderPage(currentRoute()); }
    else if(action==='cancel-edit-plano'){ draft.editingPlanoId = null; renderPage(currentRoute()); }
    else if(action==='save-plano'){ savePlanoEdit(id, btn.closest('.svc-row')); }
    else if(action==='delete-plano'){ deletePlano(id); }
    else if(action==='unlock-value'){
      var dd = ensureEntradaDraft();
      var svcNow = SERVICE_BY_ID(dd.serviceId);
      dd.value = (dd.value!=='' ? dd.value : (svcNow?svcNow.value:''));
      dd.valueEdited = true;
      renderPage(currentRoute());
    }
    else if(action==='lock-value'){ ensureEntradaDraft().valueEdited = false; renderPage(currentRoute()); }
    else if(action==='reset-entrada-draft'){ draft.entrada = null; renderPage(currentRoute()); }
    else if(action==='retry-load'){ tryLoad(); }
    else if(action==='lock-panel'){ clearStoredPassword(); STATE = null; renderGate(null); }
    else if(action==='backup-download'){ downloadBackup(); }
    else if(action==='backup-restore-trigger'){
      var fileInput = document.getElementById('backup-file-input');
      if(fileInput) fileInput.click();
    }
  });

  document.addEventListener('change', function(e){
    var el = e.target;
    var action = el.getAttribute && el.getAttribute('data-action');
    var form = el.closest && el.closest('form[data-form="entrada"]');
    if(action==='service-change'){
      var d = ensureEntradaDraft();
      d.serviceId = el.value; d.valueEdited = false;
      renderPage(currentRoute());
    } else if(action==='value-input'){
      draft.entrada.value = el.value;
    } else if(el.name==='hasManutencao' && form){
      ensureEntradaDraft().hasManutencao = el.checked;
      renderPage(currentRoute());
    } else if(el.name==='weekChoice' && form){
      draft.entrada.weekChoice = el.value;
    } else if(el.name==='date' && form){
      ensureEntradaDraft().date = el.value;
      if(draft.entrada.hasManutencao) renderPage(currentRoute());
    } else if(action==='move-kanban-day'){
      moveKanbanDay(el.getAttribute('data-id'), el.value);
    } else if(action==='dfc-month'){
      ui.dfcMonth = el.value; saveUi(); renderPage(currentRoute());
    } else if(action==='ind-period'){
      ui.indPeriod = el.value; saveUi(); renderPage(currentRoute());
    } else if(action==='anamnese-radio'){
      draft.anamnese.answers[el.getAttribute('data-key')].value = el.value;
      renderPage(currentRoute());
    } else if(action==='anamnese-detail'){
      draft.anamnese.answers[el.getAttribute('data-key')].detail = el.value;
    } else if(action==='backup-file-change'){
      restoreBackupFromFile(el.files && el.files[0]);
      el.value = '';
    }
  });

  document.addEventListener('input', function(e){
    var el = e.target;
    var form = el.closest && el.closest('form[data-form="entrada"]');
    if(form && el.name==='client'){ ensureEntradaDraft().client = el.value; }
    var aform = el.closest && el.closest('form[data-form="anamnese"]');
    if(aform && el.name==='client'){ ensureAnamneseDraft().client = el.value; }
    if(aform && el.name==='phone'){ ensureAnamneseDraft().phone = el.value; }
    if(aform && el.name==='birth'){ ensureAnamneseDraft().birth = el.value; }
    if(aform && el.name==='obs'){ ensureAnamneseDraft().obs = el.value; }
  });

  document.addEventListener('submit', function(e){
    var form = e.target.closest('form[data-form]');
    if(!form) return;
    e.preventDefault();
    var kind = form.getAttribute('data-form');
    if(kind==='entrada') submitEntrada(form);
    else if(kind==='saida') submitSaida(form);
    else if(kind==='anamnese') submitAnamnese(form);
    else if(kind==='novo-servico') submitNovoServico(form);
    else if(kind==='novo-plano') submitNovoPlano(form);
    else if(kind==='gate-password'){
      var fd2 = new FormData(form);
      setStoredPassword((fd2.get('password')||'').toString());
      tryLoad();
    }
  });

  window.addEventListener('hashchange', function(){ if(STATE) render(); });
}

/* ================= init ================= */
function init(){
  initEvents();
  tryLoad();
}
init();

})();
