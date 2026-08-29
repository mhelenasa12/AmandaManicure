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
