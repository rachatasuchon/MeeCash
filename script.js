/* =========================================================
   MeeCash - script.js
   (รวมจากแท็ก <script> 3 ก้อนเดิม เรียงตามลำดับเดิม ห้ามสลับ
    เพราะก้อนที่ 2 ทำหน้าที่ router และใช้ร่วมกับก้อนอื่น)
   ========================================================= */

/* ################ ก้อนที่ 1 : เฟส 1: Dashboard / บันทึกรายรับ-รายจ่าย ################ */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var KEY='meecash.v1', LIMIT=6;

/* ---------- icons ---------- */
var ICONS={
  down:'<path d="M12 4v15m0 0l-6-6m6 6l6-6"/>',
  up:'<path d="M12 20V5m0 0l-6 6m6-6l6 6"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  trash:'<path d="M5 7h14M10 11v6M14 11v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12"/>',
  pie:'<path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.6A9 9 0 0120.4 9H15z"/>'
};
function ic(n){return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+ICONS[n]+'</svg>'}
document.querySelectorAll('[data-icon]').forEach(function(el){el.innerHTML=ic(el.getAttribute('data-icon'))});

/* ---------- helpers ---------- */
var MONTHS=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
var DAYS=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
function p2(n){return String(n).padStart(2,'0')}
function iso(d){return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
function todayISO(){return iso(new Date())}
function daysAgoISO(n){var d=new Date();d.setDate(d.getDate()-n);return iso(d)}
function parts(s){return {y:+s.slice(0,4),m:+s.slice(5,7),d:+s.slice(8,10)}}
function fmtDateTH(s){var p=parts(s);return p2(p.d)+' '+MONTHS[p.m-1]+' '+p2((p.y+543)%100)}
function diffDays(s){var p=parts(s),t=parts(todayISO());return Math.round((Date.UTC(t.y,t.m-1,t.d)-Date.UTC(p.y,p.m-1,p.d))/864e5)}
function money(satang){return (satang/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

var CATS={
  expense:[{id:'food',name:'อาหาร',c:1},{id:'travel',name:'เดินทาง',c:2},{id:'shop',name:'ช้อปปิ้ง',c:3},{id:'bill',name:'บิล/ค่าใช้จ่าย',c:4},{id:'fun',name:'บันเทิง',c:5},{id:'health',name:'สุขภาพ',c:6},{id:'other',name:'อื่นๆ',c:7}],
  income:[{id:'salary',name:'เงินเดือน',c:1},{id:'free',name:'ฟรีแลนซ์',c:2},{id:'gift',name:'ของขวัญ',c:3},{id:'other',name:'อื่นๆ',c:7}]
};
function catOf(it){var l=CATS[it.type]||CATS.expense;for(var i=0;i<l.length;i++)if(l[i].id===it.cat)return l[i];return l[l.length-1]}

/* ---------- storage (LocalStorage, with in-memory fallback) ---------- */
var storageOk=true;
try{localStorage.setItem('__mc','1');localStorage.removeItem('__mc')}catch(e){storageOk=false}
function load(){
  try{var raw=localStorage.getItem(KEY);if(raw){var d=JSON.parse(raw);if(d&&Array.isArray(d.items))return d}}catch(e){}
  return null;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function seed(){
  var rows=[
    ['income','salary','เงินเดือน','รอบเดือนนี้',18000,6],
    ['income','free','งานออกแบบโลโก้','',2500,3],
    ['expense','bill','ค่าไฟ','รอบเดือน ต.ค.',1350,5],
    ['expense','fun','สมัคร Netflix','',169,4],
    ['expense','health','ยา/วิตามิน','',220,3],
    ['expense','shop','หนังสือเรียน','',890,2],
    ['expense','food','อาหารเย็นกับเพื่อน','',480,1],
    ['expense','food','กาแฟ','',75,1],
    ['expense','travel','BTS','ไป-กลับ',88,0],
    ['expense','food','ข้าวมันไก่','',65,0]
  ];
  var base=Date.now();
  return rows.map(function(r,i){return {id:'demo'+i,type:r[0],cat:r[1],title:r[2],note:r[3],amount:Math.round(r[4]*100),date:daysAgoISO(r[5]),ts:base-(rows.length-i)*1000,demo:true}});
}
var state=load();
if(!state){state={v:1,items:seed()};save()}

/* ---------- ui state ---------- */
var expanded=false, pendingDel=null, delTimer=null, pieType='expense', pieSel=null, addType='expense';

/* ---------- render: dashboard ---------- */
function totals(){
  var inc=0,exp=0;
  state.items.forEach(function(i){if(i.type==='income')inc+=i.amount;else exp+=i.amount});
  return {inc:inc,exp:exp,bal:inc-exp};
}
function renderTop(){
  var t=totals(), bal=t.bal;
  var ratio=t.inc>0?Math.max(0,Math.min(1,bal/t.inc)):0;
  var arc=$('#gArc');
  arc.style.strokeDasharray=(ratio*100)+' 100';
  arc.style.opacity=ratio>0?'1':'0';
  arc.style.stroke=bal<0?'var(--out)':'var(--accent)';
  var txt=(bal<0?'-':'')+money(Math.abs(bal));
  var v=$('#balVal');
  v.innerHTML=esc(txt)+' <small>฿</small>';
  v.className='g-val'+(txt.length>13?' sm':'')+(bal<0?' neg':'');
  $('#balSub').textContent=bal<0?'รายจ่ายเกินรายรับ':(t.inc>0?'เหลือ '+Math.round(ratio*100)+'% ของรายรับ':'ยังไม่มีรายรับ');
  $('#incVal').innerHTML='+ '+money(t.inc)+' <small>฿</small>';
  $('#expVal').innerHTML='- '+money(t.exp)+' <small>฿</small>';
}
function sortedItems(){
  return state.items.slice().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:b.ts-a.ts});
}
function rowHtml(it){
  var c=catOf(it), inc=it.type==='income', ask=pendingDel===it.id;
  var sub=esc(c.name)+(it.note?' · '+esc(it.note):'');
  return '<div class="row">'+
    '<span class="dot" style="background:var(--c'+c.c+')"></span>'+
    '<div style="min-width:0"><div class="r-title">'+esc(it.title)+'</div><div class="r-sub">'+sub+'</div></div>'+
    '<div class="r-amt '+(inc?'in':'out')+'">'+(inc?'+':'-')+' '+money(it.amount)+'</div>'+
    '<button type="button" class="del'+(ask?' ask':'')+'" data-del="'+esc(it.id)+'" aria-label="'+(ask?'กดอีกครั้งเพื่อยืนยันการลบ':'ลบรายการ')+' '+esc(it.title)+'">'+(ask?'ลบ?':ic('trash'))+'</button>'+
  '</div>';
}
function renderList(){
  var all=sortedItems(), shown=expanded?all:all.slice(0,LIMIT);
  var hasDemo=state.items.some(function(i){return i.demo});
  var h='<div class="l-head"><h2>รายการล่าสุด</h2><span>'+all.length+' รายการ</span></div>';
  if(hasDemo) h+='<div class="note"><span>กำลังแสดงข้อมูลตัวอย่าง</span><button type="button" id="clearDemo">ล้างตัวอย่าง</button></div>';
  if(!storageOk) h+='<div class="note"><span>เบราว์เซอร์นี้ไม่ให้บันทึกถาวร ข้อมูลจะหายเมื่อรีเฟรช</span></div>';
  if(!all.length){
    h+='<div class="empty"><b>ยังไม่มีรายการ</b>กดปุ่ม + มุมขวาล่างเพื่อเพิ่มรายรับหรือรายจ่ายแรก</div>';
  }else{
    var last='';
    shown.forEach(function(it){
      if(it.date!==last){
        last=it.date;
        var p=parts(it.date), df=diffDays(it.date);
        var rel=df===0?'วันนี้':df===1?'เมื่อวาน':fmtDateTH(it.date);
        h+='<div class="gh"><b>'+p2(p.d)+'/'+p2(p.m)+'</b><span>'+rel+'</span></div>';
      }
      h+=rowHtml(it);
    });
    if(all.length>LIMIT) h+='<button type="button" class="more" id="toggleAll">'+(expanded?'แสดงน้อยลง':'ดูทั้งหมด ('+all.length+')')+'</button>';
  }
  $('#listSec').innerHTML=h;
}
function renderAll(){renderTop();renderList();if(!$('#pieLayer').hidden)renderPie()}

/* ---------- render: pie ---------- */
function renderPie(){
  var t=pieType, sums={}, total=0;
  state.items.forEach(function(i){if(i.type===t){sums[i.cat]=(sums[i.cat]||0)+i.amount;total+=i.amount}});
  var segs=CATS[t].map(function(c){return {c:c,v:sums[c.id]||0}}).filter(function(s){return s.v>0}).sort(function(a,b){return b.v-a.v});
  if(pieSel&&!segs.some(function(s){return s.c.id===pieSel}))pieSel=null;
  var R=70,C=2*Math.PI*R,cum=0,circles='';
  segs.forEach(function(s){
    var share=s.v/total, len=C*share, gap=segs.length>1?2.5:0, drawn=Math.max(len-gap,0.8);
    var dim=pieSel&&pieSel!==s.c.id, sel=pieSel===s.c.id;
    circles+='<circle cx="100" cy="100" r="'+R+'" fill="none" stroke="var(--c'+s.c.c+')" stroke-width="'+(sel?31:26)+'" stroke-dasharray="'+drawn.toFixed(2)+' '+(C-drawn).toFixed(2)+'" stroke-dashoffset="'+(-cum).toFixed(2)+'"'+(dim?' opacity=".3"':'')+'/>';
    cum+=len;
  });
  var label=t==='expense'?'รวมรายจ่าย':'รวมรายรับ', value=money(total)+' ฿', pc='';
  if(pieSel){var s=segs.filter(function(x){return x.c.id===pieSel})[0];label=s.c.name;value=money(s.v)+' ฿';pc=(s.v/total*100).toFixed(1)+'%'}
  var h='<div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="กราฟวงกลมแสดงสัดส่วน'+(t==='expense'?'รายจ่าย':'รายรับ')+'">'+
    '<circle cx="100" cy="100" r="'+R+'" fill="none" stroke="var(--track)" stroke-width="26"/>'+
    '<g transform="rotate(-90 100 100)">'+circles+'</g></svg>'+
    '<div class="d-c">'+(segs.length?'<span class="l">'+esc(label)+'</span><span class="v">'+esc(value)+'</span>'+(pc?'<span class="p">'+pc+'</span>':''):'<span class="l">ยังไม่มีข้อมูล</span>')+'</div></div>';
  if(segs.length){
    h+='<div class="legend">';
    segs.forEach(function(s){
      h+='<button type="button" class="lg" data-cat="'+s.c.id+'" aria-pressed="'+(pieSel===s.c.id)+'">'+
        '<span class="sw" style="background:var(--c'+s.c.c+')"></span><span class="n">'+esc(s.c.name)+'</span>'+
        '<span class="a">'+money(s.v)+'</span><span class="pc">'+(s.v/total*100).toFixed(1)+'%</span></button>';
    });
    h+='</div>';
  }else{
    h+='<p class="p-empty">ยังไม่มี'+(t==='expense'?'รายจ่าย':'รายรับ')+'ให้สรุป เพิ่มรายการแล้วกราฟจะอัปเดตทันที</p>';
  }
  $('#pieBody').innerHTML=h;
}

/* ---------- layers ---------- */
var lastFocus=null;
function openLayer(el,focusEl){
  lastFocus=document.activeElement;
  el.hidden=false;
  document.documentElement.style.overflow='hidden';
  requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.add('show')})});
  if(focusEl)focusEl.focus({preventScroll:true});
}
function closeLayer(el){
  if(el.hidden)return;
  el.classList.remove('show');
  document.documentElement.style.overflow='';
  setTimeout(function(){el.hidden=true},220);
  if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
}
var toastT;
function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on')},2200)}

/* ---------- add form ---------- */
var addLayer=$('#addLayer'), addPanel=$('#addPanel'), form=$('#addForm');
var amt=$('#amtInput'), titleI=$('#titleInput'), noteI=$('#noteInput'), dateI=$('#dateInput');
function setDate(v){dateI.value=v;$('#dateText').textContent=fmtDateTH(v)}
function setType(t){
  addType=t;
  addPanel.setAttribute('data-type',t);
  $('#tabIncome').setAttribute('aria-selected',t==='income');
  $('#tabExpense').setAttribute('aria-selected',t==='expense');
  $('#amtArrow').innerHTML=ic(t==='income'?'down':'up');
  $('#saveBtn').textContent=t==='income'?'บันทึกรายรับ':'บันทึกรายจ่าย';
  titleI.placeholder=t==='income'?'เช่น เงินเดือน, ค่าขนม':'เช่น ข้าวกลางวัน, ค่าเดินทาง';
  var keep=form.elements.cat&&form.elements.cat.value;
  var list=CATS[t], h='';
  list.forEach(function(c,i){
    var on=keep?keep===c.id:i===0;
    h+='<label class="chip"><input type="radio" name="cat" value="'+c.id+'"'+(on?' checked':'')+'><span><i class="sw" style="background:var(--c'+c.c+')"></i>'+esc(c.name)+'</span></label>';
  });
  $('#chips').innerHTML=h;
  if(!form.elements.cat.value){var f=$('#chips input');if(f)f.checked=true}
}
function clearErr(){$('#amtErr').textContent='';$('#amtWrap').classList.remove('bad')}
function openAdd(){
  amt.value='';titleI.value='';noteI.value='';clearErr();
  setDate(todayISO());
  setType('expense');
  openLayer(addLayer,amt);
}
function cleanAmt(s){
  s=s.replace(/[^\d.]/g,'');
  var i=s.indexOf('.'), a=i<0?s:s.slice(0,i), b=i<0?null:s.slice(i+1).replace(/\./g,'').slice(0,2);
  a=a.slice(0,9);
  return b===null?a:a+'.'+b;
}
amt.addEventListener('input',function(){var c=cleanAmt(amt.value);if(c!==amt.value)amt.value=c;clearErr()});
dateI.addEventListener('change',function(){setDate(dateI.value||todayISO())});
$('#tabIncome').addEventListener('click',function(){setType('income')});
$('#tabExpense').addEventListener('click',function(){setType('expense')});
form.addEventListener('submit',function(e){
  e.preventDefault();
  var n=Math.round(parseFloat(amt.value)*100);
  if(!amt.value||!isFinite(n)||n<=0){
    $('#amtErr').textContent='กรอกจำนวนเงินที่มากกว่า 0';
    $('#amtWrap').classList.add('bad');
    amt.focus();return;
  }
  var catId=form.elements.cat.value||'other';
  var cat=CATS[addType].filter(function(c){return c.id===catId})[0]||CATS[addType][0];
  state.items.push({
    id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    type:addType,cat:cat.id,
    title:titleI.value.trim()||cat.name,
    note:noteI.value.trim(),
    amount:n,date:dateI.value||todayISO(),ts:Date.now()
  });
  save();renderAll();closeLayer(addLayer);
  toast(addType==='income'?'บันทึกรายรับแล้ว':'บันทึกรายจ่ายแล้ว');
});

/* ---------- events ---------- */
$('#fab').addEventListener('click',openAdd);
$('#addClose').addEventListener('click',function(){closeLayer(addLayer)});
$('#openPie').addEventListener('click',function(){renderPie();openLayer($('#pieLayer'),$('#pieClose'))});
$('#pieClose').addEventListener('click',function(){closeLayer($('#pieLayer'))});
[addLayer,$('#pieLayer')].forEach(function(l){l.addEventListener('mousedown',function(e){if(e.target===l)closeLayer(l)})});
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if(!$('#pieLayer').hidden)closeLayer($('#pieLayer'));
  else if(!addLayer.hidden)closeLayer(addLayer);
});
document.querySelectorAll('[data-ptype]').forEach(function(b){
  b.addEventListener('click',function(){
    pieType=b.getAttribute('data-ptype');pieSel=null;
    document.querySelectorAll('[data-ptype]').forEach(function(x){x.setAttribute('aria-selected',x===b)});
    renderPie();
  });
});
$('#pieBody').addEventListener('click',function(e){
  var b=e.target.closest('[data-cat]');if(!b)return;
  var id=b.getAttribute('data-cat');pieSel=pieSel===id?null:id;renderPie();
});
$('#listSec').addEventListener('click',function(e){
  var d=e.target.closest('[data-del]');
  if(d){
    var id=d.getAttribute('data-del');
    if(pendingDel===id){
      clearTimeout(delTimer);pendingDel=null;
      state.items=state.items.filter(function(i){return i.id!==id});
      save();renderAll();toast('ลบรายการแล้ว');
    }else{
      pendingDel=id;clearTimeout(delTimer);
      delTimer=setTimeout(function(){pendingDel=null;renderList()},3000);
      renderList();
    }
    return;
  }
  if(e.target.closest('#toggleAll')){expanded=!expanded;renderList();return}
  if(e.target.closest('#clearDemo')){
    state.items=state.items.filter(function(i){return !i.demo});
    save();renderAll();toast('ล้างข้อมูลตัวอย่างแล้ว');
  }
});
document.addEventListener('click',function(e){
  if(pendingDel&&!e.target.closest('[data-del]')){pendingDel=null;clearTimeout(delTimer);renderList()}
});

/* ---------- init ---------- */
var now=new Date();
$('#todayText').textContent='วัน'+DAYS[now.getDay()]+'ที่ '+fmtDateTH(todayISO());
renderList();
renderTop(); /* gauge animates from empty on first paint */
})();

/* ################ ก้อนที่ 2 : เฟส 2: Investment Simulator + router ################ */
/* ===== เฟส 2: Investment Simulator + router ===== */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var SKEY='meecash.sim.v3', START=1000000, VIEW=48, HIST=100, LIST=8;

/* ================================================================
   [ALPHA VANTAGE] ตั้งค่า API  <<<<<<  ใส่ API Key ตรงนี้  >>>>>>
   ขอ key ฟรีได้ที่ https://www.alphavantage.co/support/#api-key
   ================================================================ */
var AV_API_KEY='MO3AN4IGZLAEH1XS';   // <<< ใส่ API Key ของคุณแทนข้อความในเครื่องหมายคำพูด
var AV_BASE='https://www.alphavantage.co/query'; // endpoint ของ Alpha Vantage (ไม่ต้องแก้)

/* [ALPHA VANTAGE] ตัวคุมโควต้า: แผนฟรีมีจำกัดประมาณ 25 request/วัน (และ ~1 request/วินาที)
   จึงแคชข้อมูลไว้ใน localStorage และดึงเฉพาะสินทรัพย์ที่กำลังดูอยู่เท่านั้น */
var CACHE_TTL=6*60*60*1000;  // อายุแคช 6 ชม. ก่อนดึงใหม่อัตโนมัติ (ปรับได้)
var MIN_GAP=60*1000;         // กดปุ่มรีเฟรชได้ไม่ถี่กว่า 1 นาทีต่อสินทรัพย์
var RETRY_GAP=5*60*1000;     // ถ้าดึงพลาด จะลองใหม่อัตโนมัติไม่ถี่กว่า 5 นาที

/* [ALPHA VANTAGE] รายการสินทรัพย์ในแอป: id = ชื่อที่แสดงบนชิป, sym = ticker ที่ส่งให้ API
   เปลี่ยน/เพิ่มได้ที่นี่ เช่น 'AMZN', 'QQQ' (col = สี 1-6) */
var ASSETS=[
  {id:'NVDA',sym:'NVDA',name:'NVIDIA',typeTh:'หุ้น',desc:'หุ้นชิปและ AI',col:4},
  {id:'GOOGL',sym:'GOOGL',name:'Alphabet (Google)',typeTh:'หุ้น',desc:'หุ้นเทคโนโลยี Alphabet',col:1},
  {id:'MSFT',sym:'MSFT',name:'Microsoft',typeTh:'หุ้น',desc:'หุ้นซอฟต์แวร์และคลาวด์',col:3},
  {id:'TSLA',sym:'TSLA',name:'Tesla',typeTh:'หุ้น',desc:'หุ้นรถยนต์ไฟฟ้า',col:2},
  /* ทองคำ: ใช้ ETF ทองคำ GLD เป็นตัวแทนราคา (Alpha Vantage แผนฟรีให้ OHLC รายวันของ ETF) */
  {id:'GLD',sym:'GLD',name:'ทองคำ (Gold)',typeTh:'ทองคำ',desc:'ทองคำ (ผ่าน ETF GLD)',col:6}
];
var BYID={};ASSETS.forEach(function(a){BYID[a.id]=a});

/* ---------- icons ---------- */
var ICONS={
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  chev:'<path d="M9 5l7 7-7 7"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  home:'<path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"/>',
  sim:'<path d="M7 3v3M7 17v4M17 7v3M17 19v2"/><rect x="5" y="6" width="4" height="11" rx="1"/><rect x="15" y="10" width="4" height="9" rx="1"/>',
  learn:'<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2z"/><path d="M4 20a2 2 0 002 2h13v-4M9 7h6"/>',
  trade:'<path d="M3 17l5-6 4 4 8-10"/><path d="M15 5h5v5"/>',
  gear:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  wallet:'<path d="M3 7a3 3 0 013-3h11a2 2 0 012 2v2"/><path d="M3 7v10a3 3 0 003 3h13a2 2 0 002-2v-3"/><path d="M21 10h-5a2 2 0 000 4h5z"/>'
};
function ic(n){return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[n]||'')+'</svg>'}
document.querySelectorAll('[data-i2]').forEach(function(el){el.innerHTML=ic(el.getAttribute('data-i2'))});

/* ---------- helpers ---------- */
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function p2(n){return String(n).padStart(2,'0')}
function money(c){return (c/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function price2(p){return p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function qtyS(q){return q.toLocaleString('en-US',{maximumFractionDigits:4})}
function r2(x){return Math.round(x*100)/100}
function r4(x){return Math.round(x*1e4)/1e4}
function sg(n){return n>0?'+':n<0?'-':''}
function fmtTime(ts){var d=new Date(ts);return p2(d.getDate())+'/'+p2(d.getMonth()+1)+' '+p2(d.getHours())+':'+p2(d.getMinutes())}
function gauss(){var u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function plSpan(c,pct){var cl=c>=0?'gain':'loss';return '<span class="'+cl+'">'+sg(c)+money(Math.abs(c))+' $ ('+sg(c)+Math.abs(pct).toFixed(2)+'%)</span>'}
function cleanNum(s,maxInt,maxDec){
  s=s.replace(/[^\d.]/g,'');
  var i=s.indexOf('.'),a=i<0?s:s.slice(0,i),b=i<0?null:s.slice(i+1).replace(/\./g,'').slice(0,maxDec);
  a=a.slice(0,maxInt);
  return b===null?a:a+'.'+b;
}

/* ---------- storage ---------- */
function fresh(){
  var mk={};ASSETS.forEach(function(a){mk[a.id]=[]});
  return {v:2,cash:START,holdings:{},trades:[],mk:mk,meta:{},sel:ASSETS[0].id,mode:'line',sim:'trading'};
}
function load(){
  try{
    var raw=localStorage.getItem(SKEY);
    if(!raw)return null;
    var d=JSON.parse(raw);
    if(!d||typeof d.cash!=='number'||!d.mk||!d.holdings||!Array.isArray(d.trades))return null;
    ASSETS.forEach(function(a){if(!Array.isArray(d.mk[a.id]))d.mk[a.id]=[]});
    if(!d.meta||typeof d.meta!=='object')d.meta={};
    if(!BYID[d.sel])d.sel=ASSETS[0].id;
    d.mode=d.mode==='candle'?'candle':'line';
    d.sim=d.sim==='wallet'?'wallet':'trading';
    return d;
  }catch(e){return null}
}
var S=load()||fresh();
function persist(){try{localStorage.setItem(SKEY,JSON.stringify(S))}catch(e){}}
persist();

/* ================================================================
   [ALPHA VANTAGE] ส่วนดึงข้อมูลราคา
   ใช้ฟังก์ชัน TIME_SERIES_DAILY (ฟรี) ได้ราคา open/high/low/close รายวัน ~100 วันล่าสุด
   ราคา "ปัจจุบัน" ในแอป = ราคาปิดล่าสุดของข้อมูลชุดนี้ (ไม่ใช่ราคาเรียลไทม์)
   ================================================================ */
var loading={},errs={},tried={},netChain=Promise.resolve();
function hasKey(){return !!AV_API_KEY&&AV_API_KEY!=='YOUR_ALPHA_VANTAGE_API_KEY'}

/* [ALPHA VANTAGE] ต่อคิวการเรียก API ให้ห่างกัน ~1.1 วินาที เพื่อไม่ชนข้อจำกัด burst ของแผนฟรี */
function throttled(fn){
  var p=netChain.then(fn);
  netChain=p.then(null,function(){}).then(function(){return new Promise(function(r){setTimeout(r,1100)})});
  return p;
}

/* [ALPHA VANTAGE] แปลง JSON ที่ API ตอบกลับ -> [[open,high,low,close],...] เรียงเก่า -> ใหม่ */
function parseDaily(j){
  if(j['Error Message'])throw new Error('ไม่พบ ticker นี้ ตรวจสอบค่า sym ในรายการ ASSETS');
  var note=j['Note']||j['Information'];
  if(note)throw new Error('Alpha Vantage แจ้งว่า: '+note);
  var ts=j['Time Series (Daily)'];
  if(!ts)throw new Error('รูปแบบข้อมูลที่ได้รับไม่ถูกต้อง');
  var dates=Object.keys(ts).sort().slice(-HIST),out=[];
  dates.forEach(function(d){
    var v=ts[d],o=+v['1. open'],h=+v['2. high'],l=+v['3. low'],c=+v['4. close'];
    if([o,h,l,c].every(isFinite))out.push([r2(o),r2(h),r2(l),r2(c)]);
  });
  if(out.length<2)throw new Error('ข้อมูลราคาไม่เพียงพอ');
  return {candles:out,last:dates[dates.length-1]};
}

/* [ALPHA VANTAGE] ดึงข้อมูลของสินทรัพย์ 1 ตัว (ข้ามถ้าแคชยังใหม่ ยกเว้น force=true) */
function fetchAsset(a,force){
  if(!hasKey())return Promise.reject(new Error('NOKEY'));
  if(loading[a.id])return loading[a.id];
  var m=S.meta[a.id],has=S.mk[a.id].length>=2;
  if(has&&m&&Date.now()-m.t<(force?MIN_GAP:CACHE_TTL))return Promise.resolve(false);
  if(!force&&errs[a.id]&&tried[a.id]&&Date.now()-tried[a.id]<RETRY_GAP)return Promise.resolve(false);
  tried[a.id]=Date.now();
  var p=throttled(function(){
    /* --- [ALPHA VANTAGE] จุดที่เรียก API จริง: ถ้าจะเปลี่ยน function/outputsize แก้ที่ url นี้ --- */
    var url=AV_BASE+'?function=TIME_SERIES_DAILY&symbol='+encodeURIComponent(a.sym)+
      '&outputsize=compact&apikey='+encodeURIComponent(AV_API_KEY);
    return fetch(url).then(function(r){
      if(!r.ok)throw new Error('เชื่อมต่อไม่สำเร็จ (HTTP '+r.status+')');
      return r.json();
    });
  }).then(function(j){
    var res=parseDaily(j);
    S.mk[a.id]=res.candles;S.meta[a.id]={t:Date.now(),d:res.last};
    delete errs[a.id];persist();
    return true;
  }).then(function(v){delete loading[a.id];return v},function(e){
    delete loading[a.id];
    errs[a.id]=(e&&e.message)||'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    throw e;
  });
  loading[a.id]=p;
  return p;
}

/* [ALPHA VANTAGE] ดึงข้อมูลให้หน้าที่เปิดอยู่: หน้า Trading = ตัวที่เลือก, หน้า Wallet = ตัวที่ถืออยู่ */
function syncData(force){
  var ids=cur==='trading'?[S.sel]:cur==='wallet'?Object.keys(S.holdings):[];
  ids.forEach(function(id){
    var a=BYID[id];if(!a)return;
    fetchAsset(a,force).then(afterData,function(e){
      afterData();
      if(force&&e.message!=='NOKEY')toast('โหลดข้อมูล '+a.sym+' ไม่สำเร็จ');
    });
  });
  renderLive();
}
function afterData(){renderLive()}

/* ---------- price helpers ---------- */
function px(id){var c=S.mk[id];return c&&c.length?c[c.length-1][3]:null}  // ราคาปิดล่าสุด (null = ยังไม่มีข้อมูล)
function holdVal(id){var h=S.holdings[id];if(!h)return 0;var p=px(id);return p===null?h.cost:Math.round(h.qty*p*100)}
function portfolio(){var hv=0,id;for(id in S.holdings)hv+=holdVal(id);return {hv:hv,net:S.cash+hv,pl:S.cash+hv-START}}

/* ---------- layers ---------- */
function openL(el,focusEl){
  el._ret=document.activeElement;
  el.hidden=false;
  document.documentElement.style.overflow='hidden';
  requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.add('show')})});
  if(focusEl)focusEl.focus({preventScroll:true});
}
function closeL(el){
  if(el.hidden)return;
  el.classList.remove('show');
  document.documentElement.style.overflow='';
  setTimeout(function(){el.hidden=true},220);
  if(el._ret&&el._ret.focus)el._ret.focus({preventScroll:true});
}
var toastT;
function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on')},2400)}

/* ---------- trading page ---------- */
function buildAssets(){
  $('#assetRow').innerHTML=ASSETS.map(function(a){
    return '<button type="button" class="ac" data-id="'+a.id+'" aria-pressed="false" aria-label="'+esc(a.name)+' '+a.typeTh+'">'+
      '<span class="ac-c" style="--cc:var(--c'+a.col+')">'+a.id+'</span><span class="ac-l">'+a.typeTh+'</span></button>';
  }).join('');
  markAssets();
}
function markAssets(){
  document.querySelectorAll('.ac').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-id')===S.sel)});
  document.querySelectorAll('[data-mode]').forEach(function(b){b.setAttribute('aria-selected',b.getAttribute('data-mode')===S.mode)});
}
function renderCash(){
  var P=portfolio(),pct=P.pl/START*100,cl=P.pl>=0?'gain':'loss';
  $('#tCash').innerHTML=money(S.cash)+' <small>$</small>';
  $('#tNet').innerHTML='รวมพอร์ต '+money(P.net)+' $ · <span class="'+cl+'">'+sg(P.pl)+Math.abs(pct).toFixed(2)+'%</span>';
}
function axisFmt(v){return v>=1000?v.toLocaleString('en-US',{maximumFractionDigits:0}):v.toFixed(2)}
function renderChart(){
  var a=BYID[S.sel],w=S.mk[a.id].slice(-VIEW),n=w.length,i;
  if(n<2){renderEmpty(a);return}
  var W=340,H=206,x0=6,x1=W-54,y0=10,y1=H-10,cdl=S.mode==='candle';
  var lo=Infinity,hi=-Infinity;
  w.forEach(function(k){var l=cdl?k[2]:k[3],h=cdl?k[1]:k[3];if(l<lo)lo=l;if(h>hi)hi=h});
  var pad=(hi-lo)*0.1;if(pad<=0)pad=hi*0.002;lo-=pad;hi+=pad;
  var sx=(x1-x0)/n;
  function X(j){return x0+(j+0.5)*sx}
  function Y(v){return y1-(v-lo)/(hi-lo)*(y1-y0)}
  var first=w[0][0],last=w[n-1][3],up=last>=first,pct=(last/first-1)*100;
  var s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="กราฟ'+(cdl?'แท่ง':'เส้น')+' '+esc(a.name)+' ราคาล่าสุด '+price2(last)+' ดอลลาร์" style="--lc:'+(up?'var(--in)':'var(--out)')+'">';
  s+='<defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--lc);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--lc);stop-opacity:0"/></linearGradient></defs>';
  [0.125,0.375,0.625,0.875].forEach(function(f){
    var v=lo+(hi-lo)*f,y=Y(v);
    s+='<line x1="'+x0+'" x2="'+x1+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-width="1"/>';
    s+='<text x="'+(x1+6)+'" y="'+(y+3.5).toFixed(1)+'">'+axisFmt(v)+'</text>';
  });
  if(!cdl){
    var d='';
    for(i=0;i<n;i++)d+=(i?'L':'M')+X(i).toFixed(1)+' '+Y(w[i][3]).toFixed(1);
    s+='<path d="'+d+'L'+X(n-1).toFixed(1)+' '+y1+'L'+X(0).toFixed(1)+' '+y1+'Z" fill="url(#cg)"/>';
    s+='<path d="'+d+'" fill="none" stroke="var(--lc)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    s+='<circle cx="'+X(n-1).toFixed(1)+'" cy="'+Y(last).toFixed(1)+'" r="3.5" fill="var(--lc)" stroke="var(--surface)" stroke-width="1.5"/>';
  }else{
    var bw=Math.max(2,sx*0.62);
    w.forEach(function(k,j){
      var col=k[3]>=k[0]?'var(--in)':'var(--out)',x=X(j),top=Y(Math.max(k[0],k[3])),bot=Y(Math.min(k[0],k[3]));
      s+='<line x1="'+x.toFixed(1)+'" x2="'+x.toFixed(1)+'" y1="'+Y(k[1]).toFixed(1)+'" y2="'+Y(k[2]).toFixed(1)+'" stroke="'+col+'" stroke-width="1.2"/>';
      s+='<rect x="'+(x-bw/2).toFixed(1)+'" y="'+top.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,bot-top).toFixed(1)+'" fill="'+col+'"/>';
    });
  }
  var ly=Y(last);
  s+='<line x1="'+x0+'" x2="'+x1+'" y1="'+ly.toFixed(1)+'" y2="'+ly.toFixed(1)+'" stroke="var(--lc)" stroke-width="1" stroke-dasharray="3 3" opacity=".8"/>';
  s+='<rect x="'+(x1+2)+'" y="'+(ly-8).toFixed(1)+'" width="50" height="16" rx="4" style="fill:var(--lc)"/>';
  s+='<text x="'+(x1+27)+'" y="'+(ly+3.5).toFixed(1)+'" text-anchor="middle" style="fill:var(--on-solid);font-weight:700">'+axisFmt(last)+'</text>';
  s+='</svg>';
  $('#chartBox').innerHTML=s;

  $('#ccName').textContent=a.name+' ('+a.id+')';
  $('#ccType').textContent=a.desc;
  $('#ccPrice').textContent=price2(last)+' $';
  var chg=$('#ccChg');chg.textContent=sg(pct)+Math.abs(pct).toFixed(2)+'%';chg.className='chg '+(up?'up':'down');
  var mx=-Infinity,mn=Infinity,sum=0;
  w.forEach(function(k){if(k[1]>mx)mx=k[1];if(k[2]<mn)mn=k[2];sum+=k[3]});
  $('#stHi').textContent=price2(mx);$('#stLo').textContent=price2(mn);$('#stAvg').textContent=price2(sum/n);
  renderStatus(a);
}
/* [ALPHA VANTAGE] แสดงสถานะเมื่อยังไม่มีข้อมูล (ไม่มี key / กำลังโหลด / error) */
function renderEmpty(a){
  var T,M;
  if(!hasKey()){T='ยังไม่ได้ตั้งค่า API Key';M='ใส่ Alpha Vantage API Key ที่ตัวแปร AV_API_KEY ในโค้ดสคริปต์'}
  else if(loading[a.id]){T='กำลังโหลดข้อมูล';M='ดึงราคา '+a.sym+' จาก Alpha Vantage…'}
  else if(errs[a.id]){T='โหลดข้อมูลไม่สำเร็จ';M=errs[a.id]}
  else{T='ยังไม่มีข้อมูลราคา';M='กด "รีเฟรชข้อมูล" ด้านล่าง'}
  $('#chartBox').innerHTML='<div class="empty" style="min-height:206px;display:flex;flex-direction:column;justify-content:center"><b>'+esc(T)+'</b>'+esc(M)+'</div>';
  $('#ccName').textContent=a.name+' ('+a.id+')';
  $('#ccType').textContent=a.desc;
  $('#ccPrice').textContent='—';
  var chg=$('#ccChg');chg.textContent='';chg.className='chg';
  $('#stHi').textContent=$('#stLo').textContent=$('#stAvg').textContent='—';
  renderStatus(a);
}
/* [ALPHA VANTAGE] ข้อความใต้กราฟ + สถานะปุ่มรีเฟรช */
function renderStatus(a){
  var m=S.meta[a.id],t='';
  if(m&&S.mk[a.id].length>=2){
    t='ข้อมูลรายวันจาก Alpha Vantage ('+a.sym+') · 1 แท่ง = 1 วันทำการ · สถิติคิดจาก '+VIEW+' แท่งล่าสุด · ข้อมูลถึงวันที่ '+m.d+' · อัปเดต '+fmtTime(m.t);
    if(errs[a.id])t+=' · ⚠ รีเฟรชล่าสุดไม่สำเร็จ: '+errs[a.id];
  }else{
    t='ข้อมูลรายวันจาก Alpha Vantage ('+a.sym+')';
  }
  $('#dataStatus').textContent=t;
  $('#refreshBtn').disabled=!hasKey()||!!loading[a.id];
}
function renderHold(){
  var a=BYID[S.sel],h=S.holdings[a.id],el=$('#tHold');
  if(h&&h.qty>0){
    var v=holdVal(a.id),pl=v-h.cost,pct=h.cost>0?pl/h.cost*100:0;
    el.innerHTML='ถือ '+a.id+' '+qtyS(h.qty)+' หน่วย · ต้นทุนเฉลี่ย '+price2(h.cost/100/h.qty)+' $ · '+plSpan(pl,pct);
  }else{
    el.textContent='ยังไม่มี '+a.id+' ในพอร์ต';
  }
  $('#sellBtn').disabled=!(h&&h.qty>0)||px(a.id)===null;
  $('#buyBtn').disabled=px(a.id)===null;  // ยังไม่มีราคา = ซื้อไม่ได้
}
function renderTradingLive(){renderCash();renderChart();renderHold()}
function renderTradingAll(){buildAssets();renderTradingLive()}

/* ---------- wallet page ---------- */
var histAll=false;
function renderWalletTop(){
  var P=portfolio(),pct=P.pl/START*100;
  $('#wCash').innerHTML=money(S.cash)+' <small>$</small>';
  $('#wHold').textContent=money(P.hv)+' $';
  $('#wNet').textContent=money(P.net)+' $';
  $('#wPL').innerHTML=plSpan(P.pl,pct);
}
function renderWalletAssets(){
  var P=portfolio(),net=Math.max(P.net,1);
  var rows=[{id:'USD',label:'$',name:'เงินสด',sub:'พร้อมใช้ซื้อสินทรัพย์',val:S.cash,col:7,pl:null}];
  Object.keys(S.holdings).forEach(function(id){
    var h=S.holdings[id],a=BYID[id];if(!a||!h||h.qty<=0)return;
    var v=holdVal(id);
    rows.push({id:id,label:id,name:a.name,sub:qtyS(h.qty)+' หน่วย · ต้นทุน '+price2(h.cost/100/h.qty)+' $',val:v,col:a.col,pl:v-h.cost,cost:h.cost});
  });
  rows.sort(function(x,y){return y.val-x.val});
  var bar='';
  rows.forEach(function(r){if(r.val>0)bar+='<i style="width:'+(r.val/net*100).toFixed(2)+'%;background:var(--c'+r.col+')"></i>'});
  var h='<div class="l-head"><h2>สินทรัพย์ที่ถือครอง</h2><span>สัดส่วน</span></div>';
  h+='<div class="alloc" role="img" aria-label="สัดส่วนพอร์ต">'+bar+'</div>';
  rows.forEach(function(r){
    var right='<div class="r-amt">'+money(r.val)+' $</div>';
    if(r.pl!==null){var pct=r.cost>0?r.pl/r.cost*100:0;right+='<div class="r-sub '+(r.pl>=0?'gain':'loss')+'">'+sg(r.pl)+Math.abs(pct).toFixed(2)+'%</div>'}
    h+='<div class="arow"><span class="ac-c sm" style="--cc:var(--c'+r.col+')">'+esc(r.label)+'</span>'+
      '<div style="min-width:0"><div class="r-title">'+esc(r.name)+'</div><div class="r-sub">'+esc(r.sub)+'</div></div>'+
      '<div class="ar-r">'+right+'</div><div class="ar-p">'+(r.val/net*100).toFixed(1)+'%</div></div>';
  });
  if(rows.length===1)h+='<div class="empty"><b>ยังไม่มีสินทรัพย์</b>ไปหน้า Trading แล้วกด Buy เพื่อซื้อชิ้นแรก</div>';
  $('#wAssets').innerHTML=h;
}
function renderWalletHist(){
  var t=S.trades,shown=histAll?t:t.slice(0,LIST);
  var h='<div class="l-head"><h2>ประวัติการซื้อขาย</h2><span>'+t.length+' รายการ</span></div>';
  if(!t.length){
    h+='<div class="empty"><b>ยังไม่มีประวัติ</b>รายการซื้อขายจะแสดงที่นี่</div>';
  }else{
    shown.forEach(function(x){
      var a=BYID[x.a],buy=x.s==='buy';
      var extra=buy?'':' · '+(x.pnl>=0?'กำไร +':'ขาดทุน -')+money(Math.abs(x.pnl))+' $';
      h+='<div class="row h"><span class="dot" style="background:var(--c'+(a?a.col:7)+')"></span>'+
        '<div style="min-width:0"><div class="r-title">'+(buy?'ซื้อ ':'ขาย ')+esc(x.a)+' · '+qtyS(x.q)+' หน่วย</div>'+
        '<div class="r-sub">@ '+price2(x.p)+' $ · '+fmtTime(x.ts)+extra+'</div></div>'+
        '<div class="r-amt '+(buy?'out':'in')+'">'+(buy?'-':'+')+' '+money(x.t)+'</div></div>';
    });
    if(t.length>LIST)h+='<button type="button" class="more" id="histToggle">'+(histAll?'แสดงน้อยลง':'ดูทั้งหมด ('+t.length+')')+'</button>';
  }
  $('#wHist').innerHTML=h;
}
function renderWalletLive(){renderWalletTop();renderWalletAssets()}
function renderWalletAll(){renderWalletLive();renderWalletHist()}

/* ---------- router ---------- */
var PAGES={dashboard:1,trading:1,wallet:1,learning:1},cur=null;
function route(r,fromHash){
  if(!PAGES[r])r='dashboard';
  cur=r;
  Object.keys(PAGES).forEach(function(k){$('#pg-'+k).hidden=(k!==r)});
  document.body.setAttribute('data-route',r);
  document.querySelectorAll('[data-nav]').forEach(function(b){
    var t=b.getAttribute('data-nav');
    var on=t===r||(t==='simulator'&&(r==='trading'||r==='wallet'));
    if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-go]').forEach(function(b){
    if(b.getAttribute('data-go')===r)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  if(r==='trading'||r==='wallet'){S.sim=r;persist()}
  if(r==='trading')renderTradingAll();
  if(r==='wallet')renderWalletAll();
  if(r==='trading'||r==='wallet')syncData(false);  // [ALPHA VANTAGE] ดึงข้อมูลเมื่อเข้าหน้า (ข้ามถ้าแคชยังใหม่)
  if(!fromHash&&location.hash!=='#'+r){try{location.hash=r}catch(e){}}
  document.dispatchEvent(new CustomEvent('mc:route',{detail:r}));
  window.scrollTo(0,0);
}
document.querySelectorAll('[data-nav]').forEach(function(b){
  b.addEventListener('click',function(){
    var t=b.getAttribute('data-nav');
    route(t==='simulator'?(S.sim||'trading'):t);
  });
});
window.addEventListener('hashchange',function(){
  var r=location.hash.slice(1);
  if(r&&r!==cur)route(r,true);
});

/* ---------- drawer ---------- */
$('#menuBtn').addEventListener('click',function(){openL($('#drawerLayer'),$('#drawerClose'))});
$('#drawerClose').addEventListener('click',function(){closeL($('#drawerLayer'))});
document.querySelectorAll('[data-go]').forEach(function(b){
  b.addEventListener('click',function(){closeL($('#drawerLayer'));route(b.getAttribute('data-go'))});
});
$('#walletClose').addEventListener('click',function(){route('trading')});

/* ---------- asset picker / chart mode ---------- */
$('#assetRow').addEventListener('click',function(e){
  var b=e.target.closest('.ac');if(!b)return;
  S.sel=b.getAttribute('data-id');persist();markAssets();renderTradingLive();
  syncData(false);  // [ALPHA VANTAGE] เลือกสินทรัพย์ใหม่ -> ดึงข้อมูลตัวนั้น (ถ้าแคชหมดอายุ)
  b.scrollIntoView({inline:'nearest',block:'nearest'});
});
$('#assetNext').addEventListener('click',function(){
  var row=$('#assetRow'),end=row.scrollLeft+row.clientWidth>=row.scrollWidth-4;
  var calm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  row.scrollTo({left:end?0:row.scrollLeft+row.clientWidth*0.8,behavior:calm?'auto':'smooth'});
});
document.querySelectorAll('[data-mode]').forEach(function(b){
  b.addEventListener('click',function(){S.mode=b.getAttribute('data-mode');persist();markAssets();renderChart()});
});

/* [ALPHA VANTAGE] ปุ่มรีเฟรช: บังคับดึงข้อมูลใหม่ของสินทรัพย์ที่เลือก (กินโควต้า 1 request) */
$('#refreshBtn').addEventListener('click',function(){syncData(true)});

/* ---------- order sheet ---------- */
var oSide='buy',oLayer=$('#orderLayer'),oQty=$('#oQty');
function oRow(k,v){return '<div><dt>'+k+'</dt><dd>'+v+'</dd></div>'}
function clearOErr(){$('#oErr').textContent='';$('#oWrap').classList.remove('bad')}
function updateOrder(){
  var a=BYID[S.sel],pr=px(a.id),h=S.holdings[a.id];
  var q=parseFloat(oQty.value)||0,tot=Math.round(q*pr*100),rows='';
  $('#oPrice').textContent=price2(pr)+' $';
  if(oSide==='buy'){
    $('#oAvail').textContent='เงินสด '+money(S.cash)+' $';
    rows=oRow('มูลค่ารวม',money(tot)+' $')+oRow('เงินสดหลังซื้อ',money(S.cash-tot)+' $');
  }else{
    var hq=h?h.qty:0;
    $('#oAvail').textContent='ถืออยู่ '+qtyS(hq)+' หน่วย';
    var portion=h&&q>0?(q>=h.qty-1e-9?h.cost:Math.round(h.cost*q/h.qty)):0,pnl=tot-portion;
    rows=oRow('เงินที่ได้รับ',money(tot)+' $')+oRow('ถือเหลือ',qtyS(r4(Math.max(0,hq-q)))+' หน่วย')+
      oRow('กำไร/ขาดทุน','<span class="'+(pnl>=0?'gain':'loss')+'">'+sg(pnl)+money(Math.abs(pnl))+' $</span>');
  }
  $('#oSum').innerHTML=rows;
}
function openOrder(side){
  var a=BYID[S.sel],h=S.holdings[a.id];
  if(side==='sell'&&(!h||h.qty<=0))return;
  if(px(a.id)===null){toast('ยังไม่มีราคาของ '+a.id);return}
  oSide=side;
  $('#orderPanel').setAttribute('data-side',side);
  $('#orderTitle').textContent=(side==='buy'?'ซื้อ ':'ขาย ')+a.id;
  $('#oName').textContent=a.name+' · '+a.typeTh;
  $('#oSubmit').textContent=side==='buy'?'ยืนยันซื้อ':'ยืนยันขาย';
  oQty.value='';clearOErr();updateOrder();
  openL(oLayer,oQty);
}
$('#buyBtn').addEventListener('click',function(){openOrder('buy')});
$('#sellBtn').addEventListener('click',function(){openOrder('sell')});
$('#orderClose').addEventListener('click',function(){closeL(oLayer)});
oQty.addEventListener('input',function(){var c=cleanNum(oQty.value,7,4);if(c!==oQty.value)oQty.value=c;clearOErr();updateOrder()});
$('#oQuick').addEventListener('click',function(e){
  var b=e.target.closest('[data-pct]');if(!b)return;
  var pct=+b.getAttribute('data-pct'),a=BYID[S.sel],pr=px(a.id),q;
  if(oSide==='buy'){q=Math.floor((S.cash/100*pct/100)/pr*1e4)/1e4}
  else{var h=S.holdings[a.id];q=pct>=100?h.qty:Math.floor(h.qty*pct/100*1e4)/1e4}
  oQty.value=q>0?String(q):'';clearOErr();updateOrder();
});
$('#orderForm').addEventListener('submit',function(e){
  e.preventDefault();
  var a=BYID[S.sel],pr=px(a.id),h=S.holdings[a.id],q=r4(parseFloat(oQty.value)),tot=Math.round(q*pr*100),msg='';
  if(!isFinite(q)||q<=0)msg='กรอกจำนวนหน่วยที่มากกว่า 0';
  else if(tot<1)msg='จำนวนน้อยเกินไป มูลค่าต้องไม่ต่ำกว่า 0.01 $';
  else if(oSide==='buy'&&tot>S.cash)msg='เงินสดไม่พอ ที่ราคานี้ซื้อได้สูงสุด '+qtyS(Math.floor(S.cash/100/pr*1e4)/1e4)+' หน่วย';
  else if(oSide==='sell'&&(!h||q>h.qty+1e-9))msg='ถือไม่พอ ขายได้สูงสุด '+qtyS(h?h.qty:0)+' หน่วย';
  if(msg){$('#oErr').textContent=msg;$('#oWrap').classList.add('bad');oQty.focus();return}
  var rec={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),ts:Date.now(),a:a.id,s:oSide,q:q,p:pr,t:tot};
  if(oSide==='buy'){
    S.cash-=tot;
    var nh=h||{qty:0,cost:0};nh.qty=r4(nh.qty+q);nh.cost+=tot;S.holdings[a.id]=nh;
  }else{
    var full=q>=h.qty-1e-9,portion=full?h.cost:Math.round(h.cost*q/h.qty);
    S.cash+=tot;rec.pnl=tot-portion;
    h.qty=r4(h.qty-q);h.cost-=portion;
    if(h.qty<=0.00005)delete S.holdings[a.id];
  }
  S.trades.unshift(rec);if(S.trades.length>300)S.trades.length=300;
  persist();closeL(oLayer);
  renderTradingLive();renderWalletAll();
  toast((oSide==='buy'?'ซื้อ ':'ขาย ')+a.id+' '+qtyS(q)+' หน่วย ที่ '+price2(pr)+' $');
});

/* ---------- reset ---------- */
var rLayer=$('#resetLayer');
$('#resetBtn').addEventListener('click',function(){openL(rLayer,$('#resetCancel'))});
$('#resetCancel').addEventListener('click',function(){closeL(rLayer)});
$('#resetX').addEventListener('click',function(){closeL(rLayer)});
$('#resetConfirm').addEventListener('click',function(){
  S.cash=START;S.holdings={};S.trades=[];histAll=false;
  persist();closeL(rLayer);renderWalletAll();renderTradingLive();
  toast('รีเซ็ตพอร์ตจำลองแล้ว');
});
$('#wHist').addEventListener('click',function(e){
  if(e.target.closest('#histToggle')){histAll=!histAll;renderWalletHist()}
});

/* ---------- [THEME] ตั้งค่า: โหมด มืด/สว่าง ---------- */
var sLayer=$('#settingsLayer'),TKEY='meecash.theme';
function getTheme(){try{var t=localStorage.getItem(TKEY);return t==='light'||t==='dark'?t:'system'}catch(e){return 'system'}}
function applyTheme(t){
  var el=document.documentElement;
  if(t==='light'||t==='dark')el.setAttribute('data-theme',t);else el.removeAttribute('data-theme');
  try{if(t==='system')localStorage.removeItem(TKEY);else localStorage.setItem(TKEY,t)}catch(e){}
  document.querySelectorAll('[data-theme-set]').forEach(function(b){b.setAttribute('aria-selected',b.getAttribute('data-theme-set')===t)});
}
applyTheme(getTheme());
$('#settingsBtn').addEventListener('click',function(){openL(sLayer,$('#settingsClose'))});
$('#settingsClose').addEventListener('click',function(){closeL(sLayer)});
$('#themeSeg').addEventListener('click',function(e){
  var b=e.target.closest('[data-theme-set]');if(!b)return;
  applyTheme(b.getAttribute('data-theme-set'));
});

/* backdrops + Esc */
[$('#drawerLayer'),oLayer,rLayer,sLayer].forEach(function(l){
  l.addEventListener('mousedown',function(e){if(e.target===l)closeL(l)});
});
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  if(!oLayer.hidden)closeL(oLayer);
  else if(!sLayer.hidden)closeL(sLayer);
  else if(!rLayer.hidden)closeL(rLayer);
  else if(!$('#drawerLayer').hidden)closeL($('#drawerLayer'));
});

/* ---------- live loop ---------- */
function renderLive(){
  if(cur==='trading')renderTradingLive();
  else if(cur==='wallet')renderWalletLive();
  if(!oLayer.hidden)updateOrder();
}
/* [ALPHA VANTAGE] ตรวจทุก 60 วินาทีว่าแคชหมดอายุหรือยัง (ถ้ายังไม่หมดจะไม่ยิง API) */
setInterval(function(){if(!document.hidden)syncData(false)},60000);
document.addEventListener('visibilitychange',function(){
  if(document.hidden)persist();
  else syncData(false);
});
window.addEventListener('pagehide',persist);

/* ---------- init ---------- */
var start=location.hash.slice(1);
route(PAGES[start]?start:'dashboard',true);
})();

/* ################ ก้อนที่ 3 : เฟส 3: Investment Learning ################ */
/* ===== เฟส 3: Investment Learning ===== */
(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var LKEY='meecash.learn.v1', PASS=60, PER_Q=20;

/* ---------- icons ---------- */
var ICONS={
  back:'<path d="M19 12H5m0 0l6-6m-6 6l6 6"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  play:'<path d="M8 5v14l11-7z" fill="currentColor"/>',
  flame:'<path d="M12 3c.5 3 4 5 4 9a4 4 0 01-8 0c0-1.6.7-2.8 1.6-3.7.3 1.2 1 1.9 1.9 2.1C11.3 8 11 5.5 12 3z"/>',
  clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 3h5"/>',
  check:'<path d="M5 13l4 4 10-10"/>',
  coins:'<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  trade:'<path d="M3 17l5-6 4 4 8-10"/><path d="M15 5h5v5"/>',
  scale:'<path d="M12 4v16M6 20h12M5 8h14"/><path d="M5 8l-3 7a3 3 0 006 0zM19 8l-3 7a3 3 0 006 0z"/>',
  pie:'<path d="M12 3a9 9 0 109 9h-9z"/><path d="M15 3.6A9 9 0 0120.4 9H15z"/>',
  repeat:'<path d="M17 3l4 4-4 4"/><path d="M3 11V9a2 2 0 012-2h16M7 21l-4-4 4-4"/><path d="M21 13v2a2 2 0 01-2 2H3"/>',
  sim:'<path d="M7 3v3M7 17v4M17 7v3M17 19v2"/><rect x="5" y="6" width="4" height="11" rx="1"/><rect x="15" y="10" width="4" height="9" rx="1"/>'
};
function ic(n){return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[n]||'')+'</svg>'}
document.querySelectorAll('[data-i3]').forEach(function(el){el.innerHTML=ic(el.getAttribute('data-i3'))});

/* ---------- เนื้อหาบทเรียน (o[0] คือคำตอบที่ถูก จะถูกสุ่มตำแหน่งตอนทำควิซ) ---------- */
var LESSONS=[
{id:'l1',sec:'พื้นฐาน',title:'รู้จักการลงทุน',sub:'ออม ลงทุน เงินเฟ้อ และความเสี่ยงเบื้องต้น',icon:'coins',col:1,
 pts:['การออมคือการเก็บเงินให้ปลอดภัย ส่วนการลงทุนคือการนำเงินไปสร้างผลตอบแทนโดยยอมรับว่ามูลค่าอาจลดลงได้',
      'เงินเฟ้อทำให้ของแพงขึ้นเรื่อยๆ เงินที่นอนเฉยๆ จึงซื้อของได้น้อยลงเมื่อเวลาผ่านไป',
      'ผลตอบแทนที่คาดหวังสูง มักมาพร้อมความเสี่ยงสูง ไม่มีการลงทุนที่ให้ผลตอบแทนสูงโดยไม่มีความเสี่ยง'],
 qs:[
 {q:'ข้อใดอธิบาย "การลงทุน" ได้ถูกต้องที่สุด?',o:['นำเงินไปสร้างผลตอบแทน โดยยอมรับว่ามูลค่าอาจลดลงได้','เก็บเงินไว้ในที่ปลอดภัยโดยไม่มีวันขาดทุน','การเสี่ยงโชคเพื่อให้รวยเร็วที่สุด','การซื้อของที่ราคาจะแพงขึ้นเสมอ'],x:'การลงทุนคือการนำเงินไปทำงานเพื่อหวังผลตอบแทน แต่มูลค่าขึ้นหรือลงได้ จึงมีความเสี่ยง'},
 {q:'เงินเฟ้อส่งผลอย่างไรต่อเงินที่เก็บไว้เฉยๆ?',o:['ซื้อของได้น้อยลงเมื่อเวลาผ่านไป','มูลค่าเงินเพิ่มขึ้นเอง','ไม่มีผลใดๆ','ทำให้ดอกเบี้ยเป็นศูนย์เสมอ'],x:'เมื่อราคาสินค้าสูงขึ้น เงินจำนวนเท่าเดิมจะซื้อของได้น้อยลง'},
 {q:'โดยทั่วไป การลงทุนที่คาดหวังผลตอบแทนสูง มักเป็นอย่างไร?',o:['ความเสี่ยงสูงตามไปด้วย','ไม่มีความเสี่ยงเลย','ความเสี่ยงต่ำกว่าเงินฝากเสมอ','รับประกันกำไรทุกปี'],x:'ผลตอบแทนที่คาดหวังกับความเสี่ยงมักไปด้วยกัน ยิ่งหวังมาก ยิ่งต้องรับความไม่แน่นอนมาก'},
 {q:'เงินก้อนใดเหมาะกับ "การออม" มากกว่า "การลงทุน"?',o:['เงินสำรองฉุกเฉินที่ต้องใช้ได้ทันที','เงินเกษียณอีก 30 ปีข้างหน้า','เงินที่ไม่ต้องใช้ใน 10 ปี','เงินที่ตั้งใจเพิ่มพูนระยะยาว'],x:'เงินที่อาจต้องใช้ทันทีควรอยู่ในที่ที่มูลค่าไม่แกว่ง เช่น บัญชีเงินฝาก'},
 {q:'ทำไมบางคนเลือกลงทุนแทนการเก็บเงินสดอย่างเดียว?',o:['หวังให้เงินเติบโตสู้เงินเฟ้อได้','เพราะการลงทุนไม่มีวันขาดทุน','เพราะเงินสดสูญหายง่ายกว่าเสมอ','เพราะไม่ต้องวางแผนอะไร'],x:'การลงทุนมีโอกาสให้ผลตอบแทนมากกว่าเงินเฟ้อ แต่ก็ไม่การันตี'},
 {q:'ข้อใดเป็นสัญญาณเตือนของการลงทุนที่น่าสงสัย?',o:['สัญญาว่ากำไรสูงแน่นอนโดยไม่มีความเสี่ยง','แสดงข้อมูลความเสี่ยงให้ครบ','มีหน่วยงานกำกับดูแล','อธิบายวิธีสร้างผลตอบแทนได้ชัดเจน'],x:'การการันตีกำไรสูงโดยไม่มีความเสี่ยงเป็นลักษณะของการหลอกลวงที่พบบ่อย'}
 ]},
{id:'l2',sec:'พื้นฐาน',title:'หุ้น ETF และทองคำ',sub:'สินทรัพย์พื้นฐานที่พบในตลาดการลงทุน',icon:'trade',col:2,
 pts:['หุ้นคือส่วนหนึ่งของความเป็นเจ้าของบริษัท ราคาขึ้นลงตามผลประกอบการและความคาดหวังของตลาด',
      'ETF คือกองทุนที่ซื้อขายในตลาดเหมือนหุ้น มักถือสินทรัพย์หลายตัวในหน่วยเดียว เช่น ตามดัชนีตลาด',
      'ทองคำไม่จ่ายดอกเบี้ยหรือปันผล ผลตอบแทนมาจากราคาที่เปลี่ยนไปเท่านั้น'],
 qs:[
 {q:'การถือ "หุ้น" หมายถึงอะไร?',o:['เป็นเจ้าของส่วนหนึ่งของบริษัท','ให้บริษัทกู้เงินและรับดอกเบี้ยคงที่','ซื้อทองคำแท่งไว้ในตู้เซฟ','ฝากเงินกับธนาคารระยะสั้น'],x:'หุ้นแสดงความเป็นเจ้าของบริษัทตามสัดส่วนที่ถือ ต่างจากหุ้นกู้ซึ่งเป็นการให้กู้'},
 {q:'ETF ต่างจากหุ้นรายตัวอย่างไร?',o:['ถือสินทรัพย์หลายตัวในหน่วยเดียว ช่วยกระจายความเสี่ยงเบื้องต้น','ราคาไม่เคยเปลี่ยน','ซื้อขายได้เฉพาะวันครบกำหนด','รับประกันผลตอบแทน'],x:'ETF เปรียบเหมือนตะกร้าที่บรรจุสินทรัพย์หลายตัว แต่ซื้อขายง่ายเหมือนหุ้น'},
 {q:'ข้อใดเป็นลักษณะของทองคำ?',o:['ไม่จ่ายปันผลหรือดอกเบี้ย ผลตอบแทนมาจากราคาที่เปลี่ยนไป','จ่ายปันผลทุกไตรมาสเสมอ','ราคาคงที่ตลอดเวลา','เป็นหุ้นของบริษัทเหมืองทุกแห่ง'],x:'ถือทองคำไม่มีรายได้ประจำ กำไรหรือขาดทุนเกิดจากราคาที่ต่างจากตอนซื้อ'},
 {q:'ใครได้ "ปันผล" จากหุ้น?',o:['ผู้ถือหุ้นเมื่อบริษัทตัดสินใจจ่าย','ทุกคนที่เคยดูราคาหุ้น','เฉพาะผู้ซื้อทองคำ','ผู้ขายหุ้นทุกคนในวันเดียวกัน'],x:'ปันผลคือส่วนหนึ่งของกำไรที่บริษัทอาจจ่ายให้ผู้ถือหุ้น ไม่ได้จ่ายทุกปีเสมอไป'},
 {q:'อยากลงทุนตามภาพรวมตลาดโดยไม่เลือกหุ้นทีละตัว ตัวเลือกใดเหมาะ?',o:['ETF ที่ตามดัชนีตลาด','หุ้นรายตัวเพียงตัวเดียว','เก็งกำไรรายวัน','เก็บเงินสดทั้งหมด'],x:'ETF ตามดัชนีช่วยให้ถือตลาดโดยรวมได้ในหน่วยเดียว'},
 {q:'ข้อใดต่อไปนี้เป็น ETF?',o:['SPY ซึ่งตามดัชนี S&P 500','NVDA (NVIDIA)','TSLA (Tesla)','MSFT (Microsoft)'],x:'SPY เป็น ETF ที่ถือหุ้นหลายตัวตามดัชนี ส่วน NVDA, TSLA และ MSFT เป็นหุ้นรายตัว'},
 ]},
{id:'l3',sec:'ความเสี่ยง',title:'ความเสี่ยงและผลตอบแทน',sub:'เข้าใจความผันผวนก่อนกด Buy',icon:'scale',col:3,
 pts:['ความเสี่ยงคือโอกาสที่ผลลัพธ์จะต่างจากที่คาดไว้ รวมถึงการขาดทุน',
      'ราคาที่ผันผวนมากหมายถึงความไม่แน่นอนสูง ไม่ได้แปลว่าต้องขาดทุนเสมอ',
      'ควรลงทุนด้วยเงินที่รับความผันผวนได้ และไม่ต้องใช้ในระยะสั้น'],
 qs:[
 {q:'ความเสี่ยงในการลงทุนหมายถึงอะไร?',o:['ผลลัพธ์อาจต่างจากที่คาดไว้ รวมถึงอาจขาดทุน','โอกาสที่จะได้กำไรเท่านั้น','ค่าธรรมเนียมที่ต้องจ่ายทุกเดือน','จำนวนครั้งที่ซื้อขายต่อวัน'],x:'ความเสี่ยงคือความไม่แน่นอนของผลลัพธ์ ทั้งด้านที่ดีกว่าและแย่กว่าที่คาด'},
 {q:'ราคาสินทรัพย์ที่ "ผันผวนสูง" หมายความว่าอย่างไร?',o:['ราคาขึ้นลงแรงและคาดเดายากกว่า','ราคาจะขึ้นอย่างเดียว','ราคาไม่เปลี่ยนแปลง','รับประกันว่าจะขาดทุน'],x:'ความผันผวนวัดว่าราคาแกว่งมากแค่ไหน ไม่ได้บอกทิศทางว่าขึ้นหรือลง'},
 {q:'เงินก้อนใดไม่ควรนำไปลงทุนในสินทรัพย์เสี่ยงสูง?',o:['เงินที่ต้องใช้จ่ายภายในไม่กี่เดือน','เงินที่ไม่ต้องใช้อีกหลายปี','เงินส่วนเกินจากเงินสำรองฉุกเฉิน','เงินที่ตั้งใจลงทุนระยะยาว'],x:'ถ้าราคาตกตอนต้องใช้เงิน อาจต้องขายขาดทุนโดยไม่มีทางเลือก'},
 {q:'ราคาหุ้นที่ถือลดลง 20% แต่ยังไม่ได้ขาย เรียกว่าอะไร?',o:['ขาดทุนที่ยังไม่รับรู้ (Unrealized loss)','ขาดทุนที่รับรู้แล้ว','กำไรที่รับรู้แล้ว','ปันผล'],x:'ขาดทุนจะรับรู้จริงเมื่อขายออกไป ก่อนหน้านั้นยังเป็นเพียงตัวเลขบนหน้าจอ ซึ่งอาจกลับมาหรือลึกกว่าเดิมได้'},
 {q:'หุ้นราคา 100 ลดลง 50% ต้องขึ้นกี่เปอร์เซ็นต์ถึงกลับมาเท่าเดิม?',o:['100%','50%','25%','75%'],x:'ราคาเหลือ 50 ต้องขึ้นอีก 50 ซึ่งเท่ากับ 100% ของราคาที่เหลือ ยิ่งตกลึก ยิ่งใช้แรงขึ้นมากขึ้น'},
 {q:'ผลตอบแทนที่เคยทำได้ในอดีต บอกอะไรเกี่ยวกับอนาคต?',o:['ไม่รับประกันว่าจะเกิดซ้ำ','รับประกันว่าจะเกิดซ้ำ','รับประกันว่าจะสูงกว่าเดิม','บอกราคาพรุ่งนี้ได้แน่นอน'],x:'ผลงานในอดีตเป็นข้อมูลอ้างอิง แต่ไม่ใช่คำสัญญาถึงอนาคต'}
 ]},
{id:'l4',sec:'ความเสี่ยง',title:'กระจายความเสี่ยง',sub:'ไม่ใส่ไข่ทั้งหมดในตะกร้าใบเดียว',icon:'pie',col:4,
 pts:['กระจายเงินไปหลายสินทรัพย์ เพื่อลดผลกระทบเมื่อตัวใดตัวหนึ่งราคาตกหนัก',
      'สินทรัพย์ต่างชนิดมักไม่เคลื่อนไหวพร้อมกัน เช่น หุ้นกับทองคำ จึงช่วยลดความแกว่งของพอร์ตรวม',
      'การกระจายความเสี่ยงช่วยลดความเสี่ยงเฉพาะตัว แต่ไม่ได้ทำให้พอร์ตไม่มีทางขาดทุน'],
 qs:[
 {q:'หลักการ "ไม่ใส่ไข่ทั้งหมดในตะกร้าใบเดียว" คืออะไร?',o:['กระจายเงินไปในสินทรัพย์หลายชนิด','ซื้อหุ้นตัวเดียวที่มั่นใจที่สุด','ลงทุนครั้งเดียวทั้งหมด','เก็บเงินสดทั้งหมด'],x:'ถ้าตะกร้าใบเดียวหล่น ไข่ทั้งหมดแตก กระจายไว้หลายใบจะเสียหายน้อยกว่า'},
 {q:'พอร์ตแบบใดกระจายความเสี่ยงได้ดีกว่า?',o:['หุ้น ETF และทองคำรวมกัน','หุ้นเทคโนโลยีสามตัวในอุตสาหกรรมเดียวกัน','หุ้นตัวเดียวทั้งพอร์ต','ทองคำอย่างเดียว'],x:'สินทรัพย์ต่างชนิดกัน มีโอกาสที่ราคาจะไม่ตกพร้อมกันมากกว่า'},
 {q:'การกระจายความเสี่ยงช่วยอะไรได้?',o:['ลดผลกระทบเมื่อสินทรัพย์ตัวใดตัวหนึ่งราคาตกหนัก','ทำให้ไม่มีทางขาดทุน','รับประกันผลตอบแทนสูงสุด','ทำให้ราคาทุกตัวขึ้นพร้อมกัน'],x:'ช่วยลดความเสี่ยงเฉพาะตัว แต่ความเสี่ยงของตลาดโดยรวมยังอยู่'},
 {q:'การกำหนดสัดส่วนเงินลงทุนในสินทรัพย์ต่างชนิดเรียกว่าอะไร?',o:['การจัดสรรสินทรัพย์ (Asset Allocation)','การเก็งกำไรระยะสั้น','การกู้ยืมเพื่อลงทุน','การขายชอร์ต'],x:'Asset Allocation คือการตัดสินใจว่าจะแบ่งเงินไปสินทรัพย์ชนิดใดเท่าไร'},
 {q:'พอร์ตมีหุ้น 90% ทองคำ 10% ถ้าหุ้นราคาตกหนัก พอร์ตจะเป็นอย่างไร?',o:['ได้รับผลกระทบมาก เพราะหุ้นเป็นสัดส่วนใหญ่','ไม่ได้รับผลกระทบเลย','ขาดทุนน้อยกว่าทองคำเสมอ','กลับมาเท่าเดิมทันที'],x:'สัดส่วนหุ้นสูงจึงกำหนดทิศทางพอร์ตเป็นส่วนใหญ่ การกระจายต้องดูที่สัดส่วนจริง ไม่ใช่แค่จำนวนชนิด'},
 {q:'ใน Wallet ของ MeeCash ดูการกระจายความเสี่ยงได้จากอะไร?',o:['แถบสัดส่วนพอร์ตและเปอร์เซ็นต์ของแต่ละสินทรัพย์','ปุ่ม Reset','เฉพาะยอดเงินคงเหลือ','ประวัติการซื้อขายล่าสุดเท่านั้น'],x:'หน้า Wallet แสดงสัดส่วนของเงินสดและสินทรัพย์แต่ละตัวเทียบกับมูลค่าพอร์ตรวม'}
 ]},
{id:'l5',sec:'วางแผน',title:'ลงทุนระยะยาวและ DCA',sub:'ทยอยลงทุนและพลังของดอกเบี้ยทบต้น',icon:'repeat',col:5,
 pts:['ดอกเบี้ยทบต้นทำให้ผลตอบแทนงอกเงยบนผลตอบแทนเดิม ยิ่งลงทุนนานยิ่งเห็นผลชัด',
      'DCA คือการทยอยลงทุนจำนวนเท่าๆ กันเป็นงวดๆ แทนการลงก้อนเดียว ช่วยลดความเสี่ยงจากการเลือกจังหวะซื้อผิด',
      'การจับจังหวะซื้อต่ำสุดและขายสูงสุดทำได้ยากมาก การลงทุนต่อเนื่องจึงเป็นทางเลือกที่ใช้ได้จริงกว่า'],
 qs:[
 {q:'DCA (Dollar-Cost Averaging) คืออะไร?',o:['ทยอยลงทุนจำนวนเท่าๆ กันเป็นงวดๆ ตามกำหนด','ซื้อทั้งหมดตอนราคาต่ำสุดเท่านั้น','ขายทั้งหมดเมื่อราคาตก','ลงทุนเฉพาะวันที่มีข่าวดี'],x:'DCA คือการลงเงินจำนวนเท่าเดิมเป็นระยะ ไม่ว่าราคาจะสูงหรือต่ำ'},
 {q:'ข้อดีหลักของ DCA คือ?',o:['ลดความเสี่ยงจากการซื้อก้อนใหญ่ตอนราคาแพง','รับประกันกำไร','ไม่มีค่าธรรมเนียมใดๆ','ทำให้ราคาสินทรัพย์ถูกลง'],x:'การทยอยซื้อกระจายจังหวะซื้อ จึงไม่ต้องเดาว่าตอนนี้เป็นจุดต่ำหรือสูง แต่ก็ไม่ได้การันตีกำไร'},
 {q:'DCA ลงเดือนละ 1,000 บาท ถ้าเดือนนี้ราคาตก จะได้จำนวนหน่วยอย่างไร?',o:['ได้จำนวนหน่วยมากกว่าตอนราคาสูง','ได้จำนวนหน่วยเท่าเดิมเสมอ','ได้น้อยลง','ไม่ได้หน่วยเลย'],x:'เงินเท่าเดิมซื้อได้มากขึ้นเมื่อราคาถูกลง ต้นทุนเฉลี่ยจึงถูกถ่วงลง'},
 {q:'ดอกเบี้ยทบต้นหมายถึง?',o:['ผลตอบแทนที่งอกเงยจากทั้งเงินต้นและผลตอบแทนสะสม','ดอกเบี้ยที่คิดจากเงินต้นอย่างเดียวตลอด','ค่าธรรมเนียมที่ทบทุกปี','เงินต้นที่ลดลงทุกปี'],x:'ผลตอบแทนปีก่อนถูกนำไปสร้างผลตอบแทนต่อในปีถัดไป'},
 {q:'เงินต้น 10,000 โตปีละ 10% แบบทบต้น หลัง 2 ปีประมาณเท่าไร?',o:['12,100','12,000','11,000','10,200'],x:'ปีแรกได้ 11,000 ปีที่สองคิดจาก 11,000 อีก 10% จึงเป็น 12,100'},
 {q:'ทำไมการจับจังหวะซื้อต่ำสุดขายสูงสุดจึงทำได้ยาก?',o:['ไม่มีใครคาดเดาจุดสูงสุด-ต่ำสุดได้แม่นยำสม่ำเสมอ','เพราะตลาดปิดทุกวัน','เพราะราคาไม่เคยเปลี่ยน','เพราะกฎหมายห้าม'],x:'ราคาถูกขับเคลื่อนด้วยปัจจัยมากมายที่คาดเดายาก แม้แต่ผู้เชี่ยวชาญก็พลาดได้'}
 ]},
{id:'l6',sec:'วางแผน',title:'อ่านกราฟและต้นทุนเฉลี่ย',sub:'ใช้ความรู้กับหน้า Trading และ Wallet',icon:'sim',col:6,
 pts:['กราฟเส้นเชื่อมราคาปิดแต่ละช่วง ดูแนวโน้มง่าย ส่วนแท่งเทียนแสดงราคาเปิด สูงสุด ต่ำสุด และปิดของแต่ละช่วง',
      'ต้นทุนเฉลี่ยคือเงินที่จ่ายไปทั้งหมดหารด้วยจำนวนหน่วยที่ถือ กำไรขาดทุนที่ยังไม่รับรู้คือราคาปัจจุบันเทียบกับต้นทุนนี้',
      'ก่อนกด Buy หรือ Sell ควรเช็กจำนวนหน่วยและมูลค่ารวม เพราะราคาตลาดเปลี่ยนได้ทุกวินาที'],
 qs:[
 {q:'แท่งเทียนหนึ่งแท่งบอกข้อมูลอะไรบ้าง?',o:['ราคาเปิด สูงสุด ต่ำสุด และปิดของช่วงเวลานั้น','เฉพาะราคาปิด','เฉพาะปริมาณซื้อขาย','เฉพาะชื่อสินทรัพย์'],x:'แท่งเทียนสรุปความเคลื่อนไหวของราคาในช่วงเวลาเดียวด้วยตัวเลข 4 ค่า'},
 {q:'ซื้อ 10 หน่วยที่ราคา 50 และอีก 10 หน่วยที่ราคา 70 ต้นทุนเฉลี่ยต่อหน่วยคือเท่าไร?',o:['60','50','70','120'],x:'จ่ายรวม 500 + 700 = 1,200 สำหรับ 20 หน่วย เฉลี่ยหน่วยละ 60'},
 {q:'ต้นทุนเฉลี่ย 60 ราคาตลาดตอนนี้ 66 สถานะเป็นอย่างไร?',o:['กำไรที่ยังไม่รับรู้ 10%','ขาดทุน 10%','เท่าทุน','กำไรที่รับรู้แล้ว 10%'],x:'66 มากกว่า 60 อยู่ 6 คิดเป็น 10% ของต้นทุน และยังไม่ได้ขาย จึงยังไม่รับรู้'},
 {q:'กำไรหรือขาดทุนจะ "รับรู้" เมื่อใด?',o:['เมื่อขายสินทรัพย์นั้นออกไป','เมื่อราคาเปลี่ยน','เมื่อเปิดดูกราฟ','เมื่อซื้อเพิ่ม'],x:'ตราบที่ยังถืออยู่ ตัวเลขกำไรขาดทุนยังเปลี่ยนตามราคา จะล็อกผลเมื่อขาย'},
 {q:'ทำไมควรเช็กมูลค่ารวมก่อนยืนยันคำสั่งซื้อ?',o:['ราคาเปลี่ยนได้ตลอด และมูลค่าต้องไม่เกินเงินสดที่มี','เพราะมูลค่าไม่เคยเปลี่ยน','เพราะระบบไม่ตรวจเงินสดให้','เพราะราคาถูกกำหนดล่วงหน้า'],x:'ราคาที่ใช้จริงคือราคา ณ ตอนกดยืนยัน จึงควรดูยอดรวมให้แน่ใจก่อน'},
 {q:'กราฟเส้นเหมาะกับการดูอะไรมากที่สุด?',o:['แนวโน้มภาพรวมของราคา','ราคาสูงสุดต่ำสุดในแต่ละช่วงอย่างละเอียด','งบการเงินของบริษัท','จำนวนคนติดตามสินทรัพย์'],x:'กราฟเส้นตัดรายละเอียดออก ทำให้เห็นทิศทางรวมได้ชัด ส่วนรายละเอียดในแต่ละช่วงให้ดูแท่งเทียน'}
 ]}
];
var BYID={};LESSONS.forEach(function(l){BYID[l.id]=l});

/* ---------- helpers ---------- */
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function p2(n){return String(n).padStart(2,'0')}
function fmt(ms){var s=Math.ceil(ms/1000);return p2(Math.floor(s/60))+':'+p2(s%60)}
function limitOf(l){return l.qs.length*PER_Q*1000}
function minutesOf(l){return Math.max(1,Math.round(limitOf(l)/60000))}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}

/* ---------- progress storage ---------- */
function loadP(){
  try{var raw=localStorage.getItem(LKEY);if(raw){var d=JSON.parse(raw);if(d&&d.p&&typeof d.p==='object')return d}}catch(e){}
  return {v:1,p:{}};
}
var P=loadP();
function saveP(){try{localStorage.setItem(LKEY,JSON.stringify(P))}catch(e){}}
function passed(id){return !!(P.p[id]&&P.p[id].passed)}

/* ---------- layers ---------- */
function openL(el,focusEl){el._ret=document.activeElement;el.hidden=false;document.documentElement.style.overflow='hidden';requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.add('show')})});if(focusEl)focusEl.focus({preventScroll:true})}
function closeL(el){if(el.hidden)return;el.classList.remove('show');document.documentElement.style.overflow='';setTimeout(function(){el.hidden=true},220);if(el._ret&&el._ret.focus)el._ret.focus({preventScroll:true})}

/* ---------- views ---------- */
var VIEWS={home:'#lHome',lesson:'#lLesson',count:'#lCount',quiz:'#lQuiz',result:'#lResult'},view='home',curLesson=null,Q=null,cdT=0,bnT=0,quitOn=false;
function setView(v){
  view=v;
  Object.keys(VIEWS).forEach(function(k){$(VIEWS[k]).hidden=(k!==v)});
  document.body.setAttribute('data-learn',v);
  window.scrollTo(0,0);
}

/* ---------- home ---------- */
function nextLesson(){
  var i;for(i=0;i<LESSONS.length;i++)if(!passed(LESSONS[i].id))return LESSONS[i];
  var low=LESSONS[0];
  LESSONS.forEach(function(l){if((P.p[l.id].best||0)<(P.p[low.id].best||0))low=l});
  return low;
}
function statusHtml(l){
  var p=P.p[l.id];
  if(p&&p.passed)return '<span class="lc-s ok">'+ic('check')+'เรียนจบ · '+p.best+'%</span>';
  if(p&&p.tries)return '<span class="lc-s">ลองอีกครั้ง · ดีที่สุด '+p.best+'%</span>';
  return '<span class="lc-s">ยังไม่เริ่ม</span>';
}
function renderHome(){
  var n=LESSONS.length,done=LESSONS.filter(function(l){return passed(l.id)}).length;
  $('#lhSub').innerHTML='เรียนจบแล้ว <b>'+done+'</b> จาก '+n+' บทเรียน';
  var pr=$('#lhProg');pr.setAttribute('aria-valuemax',n);pr.setAttribute('aria-valuenow',done);
  pr.firstElementChild.style.width=(done/n*100)+'%';
  var nx=nextLesson();
  $('#lhNext').textContent=(done===n?'ทบทวนอีกครั้ง: ':'ต่อไป: ')+nx.title;
  var secs=[],map={};
  LESSONS.forEach(function(l){if(!map[l.sec]){map[l.sec]=[];secs.push(l.sec)}map[l.sec].push(l)});
  var h='';
  secs.forEach(function(s){
    h+='<section class="ls" aria-label="'+esc(s)+'"><h2 class="ls-h">'+esc(s)+'</h2><div class="ls-grid">';
    map[s].forEach(function(l){
      h+='<button type="button" class="lc" data-l="'+l.id+'"><span class="cover" style="--cc:var(--c'+l.col+')">'+ic(l.icon)+'</span>'+
        '<span class="lc-t">'+esc(l.title)+'</span><span class="lc-m">'+l.qs.length+' ข้อ · '+minutesOf(l)+' นาที</span>'+statusHtml(l)+'</button>';
    });
    h+='</div></section>';
  });
  $('#lhList').innerHTML=h;
}

/* ---------- lesson detail ---------- */
function openLesson(id){
  var l=BYID[id];if(!l)return;
  curLesson=l;
  var c=$('#ldCover');c.style.setProperty('--cc','var(--c'+l.col+')');c.innerHTML=ic(l.icon);
  $('#ldTitle').textContent=l.title;
  $('#ldSub').textContent=l.sub;
  $('#ldPoints').innerHTML=l.pts.map(function(t,i){return '<li><span>'+(i+1)+'</span><div>'+esc(t)+'</div></li>'}).join('');
  $('#ldQ').textContent=l.qs.length+' ข้อ';
  $('#ldMin').textContent=minutesOf(l)+' นาที';
  var p=P.p[l.id];$('#ldBest').textContent=p&&p.tries?p.best+'%':'-';
  setView('lesson');
}

/* ---------- countdown ---------- */
function startLesson(l){
  curLesson=l;
  Q={lesson:l,qs:shuffle(l.qs).map(function(q){
      var idx=shuffle([0,1,2,3]);
      return {q:q.q,x:q.x,opts:idx.map(function(i){return q.o[i]}),ans:idx.indexOf(0)};
    }),
    idx:0,correct:0,streak:0,best:0,res:[],limit:limitOf(l),elapsed:0,running:false,lastTs:0,iv:0,locked:false,finished:false,reason:''};
  setView('count');
  var n=3;$('#cdNum').textContent=n;
  (function loop(){
    cdT=setTimeout(function(){
      n--;
      if(n>0){var el=$('#cdNum');el.textContent=n;el.style.animation='none';void el.offsetWidth;el.style.animation='';loop()}
      else beginQuiz();
    },900);
  })();
}

/* ---------- quiz ---------- */
function updTime(){
  var left=Math.max(0,Q.limit-Q.elapsed);
  $('#qTime').textContent=fmt(left);
  $('#qTimeBox').classList.toggle('low',left<=10000);
}
function tickQ(){
  if(!Q||!Q.running)return;
  var n=Date.now();Q.elapsed+=n-Q.lastTs;Q.lastTs=n;
  if(Q.elapsed>=Q.limit){Q.elapsed=Q.limit;updTime();finish('timeout');return}
  updTime();
}
function syncTimer(){
  if(!Q||Q.finished||view!=='quiz')return;
  var want=!Q.locked&&!document.hidden&&!quitOn;
  if(want&&!Q.running){Q.running=true;Q.lastTs=Date.now();if(!Q.iv)Q.iv=setInterval(tickQ,250)}
  else if(!want&&Q.running){tickQ();if(Q&&!Q.finished)Q.running=false}
}
function beginQuiz(){
  setView('quiz');
  Q.idx=0;renderQ();
  Q.locked=false;updTime();syncTimer();
}
function renderQ(){
  var cq=Q.qs[Q.idx],total=Q.qs.length;
  $('#qN').textContent='ข้อที่ '+(Q.idx+1)+' จาก '+total;
  $('#qText').textContent=cq.q;
  $('#qCnt').textContent=Q.idx+'/'+total;
  $('#qCnt').setAttribute('aria-label','ตอบแล้ว '+Q.idx+' จาก '+total+' ข้อ');
  $('#qStreak').textContent=Q.streak;
  $('#qStreakBox').setAttribute('aria-label','ตอบถูกติดต่อกัน '+Q.streak+' ข้อ');
  var segs='';
  for(var i=0;i<total;i++){var r=Q.res[i];segs+='<i class="'+(r?(r.ok?'ok':'no'):(i===Q.idx?'cur':''))+'"></i>'}
  $('#qSegs').innerHTML=segs;
  $('#qOpts').innerHTML=cq.opts.map(function(o,k){
    return '<button type="button" class="qo" data-k="'+k+'"><span class="lt">'+'ABCD'.charAt(k)+'</span><span class="ot">'+esc(o)+'</span><span class="st2"></span></button>';
  }).join('');
  $('#qFb').hidden=true;
  Q.locked=false;
}
function answer(k){
  if(!Q||Q.locked||Q.finished||view!=='quiz')return;
  Q.locked=true;
  syncTimer();
  if(Q.finished)return;
  var cq=Q.qs[Q.idx],ok=k===cq.ans;
  Q.res[Q.idx]={pick:k,ok:ok};
  if(ok){Q.correct++;Q.streak++;if(Q.streak>Q.best)Q.best=Q.streak}else Q.streak=0;
  document.querySelectorAll('#qOpts .qo').forEach(function(b,i){
    b.disabled=true;
    var st=b.querySelector('.st2');
    if(i===cq.ans){b.classList.add('right');st.innerHTML=ic('check');b.querySelector('.ot').insertAdjacentHTML('beforeend','<span class="sr"> (คำตอบที่ถูกต้อง)</span>')}
    else if(i===k){b.classList.add('wrong');st.innerHTML=ic('close');b.querySelector('.ot').insertAdjacentHTML('beforeend','<span class="sr"> (คำตอบที่คุณเลือก ไม่ถูกต้อง)</span>')}
    else b.classList.add('dim');
  });
  $('#qStreak').textContent=Q.streak;
  $('#qCnt').textContent=(Q.idx+1)+'/'+Q.qs.length;
  var segs=$('#qSegs').children;if(segs[Q.idx])segs[Q.idx].className=ok?'ok':'no';
  var h=$('#qFbH');
  h.className='fb-h '+(ok?'ok':'no');
  h.innerHTML=ic(ok?'check':'close')+'<span>'+(ok?'ถูกต้อง!':'ยังไม่ถูก คำตอบที่ถูกคือข้อ '+'ABCD'.charAt(cq.ans))+'</span>';
  $('#qFbX').textContent=cq.x;
  $('#qNext').textContent=Q.idx+1>=Q.qs.length?'ดูผลลัพธ์':'ข้อถัดไป';
  $('#qFb').hidden=false;
  $('#qNext').focus({preventScroll:true});
  $('#qFb').scrollIntoView({block:'nearest'});
}
function nextQ(){
  if(!Q||!Q.locked||Q.finished)return;
  Q.idx++;
  if(Q.idx>=Q.qs.length){finish('done');return}
  renderQ();syncTimer();
  window.scrollTo(0,0);
}

/* ---------- finish + result ---------- */
function finish(reason){
  if(!Q||Q.finished)return;
  Q.finished=true;Q.reason=reason;Q.running=false;
  clearInterval(Q.iv);Q.iv=0;
  var total=Q.qs.length,acc=Math.round(Q.correct/total*100),id=Q.lesson.id;
  var p=P.p[id]||{best:0,passed:false,tries:0,streak:0};
  Q.wasPassed=p.passed;
  p.tries++;p.best=Math.max(p.best,acc);p.streak=Math.max(p.streak||0,Q.best);
  if(acc>=PASS)p.passed=true;
  P.p[id]=p;saveP();
  Q.acc=acc;
  var done=reason==='done';
  $('#qBannerT').textContent=done?'Finish!':'Time out!';
  $('#qBannerS').textContent=done?'ทำครบทุกข้อแล้ว':'หมดเวลา ข้อที่ยังไม่ได้ตอบนับเป็นผิด';
  $('#qBanner').hidden=false;
  clearTimeout(bnT);bnT=setTimeout(toResult,1500);
}
function toResult(){
  clearTimeout(bnT);
  $('#qBanner').hidden=true;
  if(!Q||!Q.finished||view==='result')return;
  var total=Q.qs.length,acc=Q.acc,answered=Q.res.filter(Boolean).length;
  $('#rsCorrect').textContent=Q.correct;
  $('#rsTotal').textContent=total;
  $('#rsAcc').textContent=acc+'%';
  var pr=$('#rsProg');pr.setAttribute('aria-valuenow',acc);pr.firstElementChild.style.width='0';
  requestAnimationFrame(function(){requestAnimationFrame(function(){pr.firstElementChild.style.width=acc+'%'})});
  $('#rsQ').textContent=total+' ข้อ';
  $('#rsTime').textContent=fmt(Q.elapsed);
  $('#rsStreak').textContent=Q.best;
  var ok=acc>=PASS,msg;
  if(ok)msg=(Q.wasPassed?'ผ่านเกณฑ์ '+PASS+'% อีกครั้ง':'ยอดเยี่ยม! บทเรียนนี้นับว่าเรียนจบแล้ว');
  else msg='ยังไม่ถึงเกณฑ์ '+PASS+'% ทบทวนข้อที่ผิดด้านล่างแล้วลองอีกครั้งได้เลย';
  if(Q.reason==='timeout')msg='หมดเวลา ตอบไปแล้ว '+answered+' จาก '+total+' ข้อ · '+msg;
  var m=$('#rsMsg');m.className='rs-msg '+(ok?'ok':'no');m.innerHTML=ic(ok?'check':'close')+'<span>'+esc(msg)+'</span>';
  var wrong='';
  Q.qs.forEach(function(q,i){
    var r=Q.res[i];if(r&&r.ok)return;
    wrong+='<div class="rv-i"><b>'+esc(q.q)+'</b><span class="a">คำตอบที่ถูก: '+esc(q.opts[q.ans])+'</span>'+
      (r?'':'<span class="x">ยังไม่ได้ตอบ</span>')+'<span class="x">'+esc(q.x)+'</span></div>';
  });
  var rv=$('#rsReview');
  if(wrong){rv.innerHTML='<h2>ทบทวนข้อที่ยังไม่ถูก</h2>'+wrong;rv.hidden=false}else rv.hidden=true;
  setView('result');
}

/* ---------- leave / abandon ---------- */
function abandon(){
  if(Q){clearInterval(Q.iv)}
  Q=null;clearTimeout(cdT);clearTimeout(bnT);
  $('#qBanner').hidden=true;
  quitOn=false;
  if(!$('#quitLayer').hidden){$('#quitLayer').hidden=true;$('#quitLayer').classList.remove('show');document.documentElement.style.overflow=''}
  renderHome();setView('home');
}

/* ---------- events ---------- */
$('#lhList').addEventListener('click',function(e){var b=e.target.closest('[data-l]');if(b)openLesson(b.getAttribute('data-l'))});
$('#lhStart').addEventListener('click',function(){startLesson(nextLesson())});
$('#ldBack').addEventListener('click',function(){renderHome();setView('home')});
$('#ldStart').addEventListener('click',function(){startLesson(curLesson)});
$('#qOpts').addEventListener('click',function(e){var b=e.target.closest('.qo');if(b)answer(+b.getAttribute('data-k'))});
$('#qNext').addEventListener('click',nextQ);
$('#qBanner').addEventListener('click',toResult);
$('#rsFinish').addEventListener('click',function(){Q=null;renderHome();setView('home')});
$('#rsRetry').addEventListener('click',function(){startLesson(curLesson)});

var quit=$('#quitLayer');
function openQuit(){quitOn=true;openL(quit,$('#quitStay'));syncTimer()}
function stayQuiz(){quitOn=false;closeL(quit);syncTimer()}
$('#qExit').addEventListener('click',openQuit);
$('#quitStay').addEventListener('click',stayQuiz);
$('#quitGo').addEventListener('click',function(){quitOn=false;closeL(quit);abandon()});
quit.addEventListener('mousedown',function(e){if(e.target===quit)stayQuiz()});

document.addEventListener('keydown',function(e){
  if(view!=='quiz'||!Q||Q.finished)return;
  if(e.key==='Escape'){
    if(quitOn)stayQuiz();else openQuit();
    return;
  }
  if(quitOn)return;
  if(e.key>='1'&&e.key<='4'&&!Q.locked)answer(+e.key-1);
});
document.addEventListener('visibilitychange',syncTimer);
document.addEventListener('mc:route',function(e){
  if(e.detail!=='learning')abandon();
  else if(view==='home')renderHome();
});

/* ---------- init ---------- */
renderHome();
setView('home');
})();
