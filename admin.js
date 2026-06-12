const API=window.APP_CONFIG.API_URL;
let data={positions:[],products:[],stock:[],orders:[],orderItems:[],wishRequests:[],analytics:{}};
let uploaded=[];
let sale=[];

async function api(action,payload={},method='GET'){
  if(!API||API.includes('PASTE_')) throw new Error('API URL is not configured');
  if(method==='GET') return fetch(`${API}?action=${action}`).then(r=>r.json());
  return fetch(API,{method:'POST',body:JSON.stringify({action,...payload})}).then(r=>r.json());
}
function toast(m){const e=document.getElementById('toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function money(v){return `${Number(v||0).toFixed(0)}₾`}

async function load(){
  try{
    const r=await api('adminData');
    if(!r.ok) throw new Error(r.error);
    data=r;
    render();
  }catch(e){toast(e.message)}
}

function render(){
  const activePositions=data.positions.filter(p=>p.Status==='active');
  const positionSelect=document.getElementById('adminPosition');
  positionSelect.innerHTML='<option value="" selected disabled>აირჩიე პოზიცია *</option>'+activePositions.map(p=>`<option value="${p.PositionID}">${p.NameKA}</option>`).join('');
  positionSelect.value='';
  document.getElementById('productSelect').innerHTML='<option value="">ან აირჩიე პროდუქტი</option>'+data.products.filter(p=>p.Status==='active').map(p=>`<option value="${p.Code}">${p.Code} — ${p.NameKA}</option>`).join('');
  renderPositions();
  renderProducts();
  renderOrders();
  renderWish();
  renderAnalytics();
  renderSale();
}
function renderPositions(){
  document.getElementById('positionsTable').innerHTML=table(['ქართული','English','Русский','სტატუსი'],data.positions.map(p=>[p.NameKA,p.NameEN,p.NameRU,p.Status]));
}
function renderProducts(){
  document.getElementById('productsTable').innerHTML=table(['კოდი','პოზიცია','პროდუქტის სახელი','ფასი','ზომები'],data.products.map(p=>{
    const pos=data.positions.find(x=>x.PositionID===p.PositionID)||{};
    const sizes=data.stock.filter(s=>s.ProductID===p.ProductID).map(s=>`${s.Size}: ${s.Qty}`).join(', ');
    return [p.Code,pos.NameKA||'',p.NameKA,money(p.Price),sizes];
  }));
}
function renderOrders(){
  document.getElementById('ordersTable').innerHTML=table(['თარიღი','კლიენტი','ტელეფონი','ოთახი','დრო','ჯამი','სტატუსი'],data.orders.map(o=>[o.Date,o.CustomerName,o.Phone,o.RoomNumber,o.DeliveryTime,money(o.Total),statusSelect('orders',o.OrderID,o.Status)]));
}
function renderWish(){
  document.getElementById('wishTable').innerHTML=table(['თარიღი','კლიენტი','ტელეფონი','ოთახი','შეტყობინება','სტატუსი'],data.wishRequests.map(w=>[w.Date,w.CustomerName,w.Phone,w.RoomNumber,w.Message,statusSelect('wish',w.RequestID,w.Status)]));
}
function renderAnalytics(){
  const a=data.analytics||{};
  document.getElementById('analyticsBox').innerHTML=`<div class="metric-grid"><div class="metric"><span>პროდუქტები</span><br><b>${data.products.length}</b></div><div class="metric"><span>შეკვეთები</span><br><b>${data.orders.length}</b></div><div class="metric"><span>სურვილები</span><br><b>${data.wishRequests.length}</b></div><div class="metric"><span>დაბალი ნაშთი</span><br><b>${(a.lowStock||[]).length}</b></div></div><h3>ყველაზე გაყიდვადი</h3>${table(['კოდი','სახელი','გაყიდულია'],(a.bestSellers||[]).map(x=>[x.code,x.name,x.sold]))}<h3>დაბალი ნაშთი</h3>${table(['კოდი','ზომა','ხელმისაწვდომი'],(a.lowStock||[]).map(x=>[x.code,x.size,x.available]))}`;
}
function table(headers,rows){
  return `<table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function statusSelect(type,id,status){
  return `<select onchange="changeStatus('${type}','${id}',this.value)"><option ${status==='new'?'selected':''} value="new">ახალი</option><option ${status==='confirmed'?'selected':''} value="confirmed">დადასტურებული</option><option ${status==='delivered'?'selected':''} value="delivered">მიტანილია</option><option ${status==='done'?'selected':''} value="done">დასრულებული</option><option ${status==='cancelled'?'selected':''} value="cancelled">გაუქმებული</option></select>`;
}
async function changeStatus(type,id,status){
  const action=type==='wish'?'updateWishStatus':'updateOrderStatus';
  const r=await api(action,{id,status},'POST');
  if(!r.ok) return toast(r.error);
  toast('სტატუსი შეიცვალა');
  load();
}

function addSize(){
  const d=document.createElement('div');
  d.className='split size-input';
  d.innerHTML='<input placeholder="ზომა" required><input type="number" placeholder="რაოდენობა" required>';
  document.getElementById('sizesBox').appendChild(d);
}
async function uploadFiles(files){
  uploaded=[];
  document.getElementById('photoPreview').innerHTML='იტვირთება...';
  for(const f of files){
    const base64=await fileToBase64(f);
    const r=await api('uploadImage',{fileName:f.name,mimeType:f.type,base64},'POST');
    if(!r.ok) throw new Error(r.error);
    uploaded.push(r.url);
  }
  document.getElementById('photoPreview').innerHTML=uploaded.map((u,i)=>`<span class="chip">ფოტო ${i+1}${i===0?' მთავარი':''}</span>`).join('');
}
function fileToBase64(file){
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(file)});
}

function selectedProduct(){
  const code=document.getElementById('codeInput').value.trim()||document.getElementById('productSelect').value;
  return data.products.find(p=>String(p.Code)===String(code));
}
function renderSizes(){
  const p=selectedProduct();
  const sel=document.getElementById('sizeSelect');
  if(!p){sel.innerHTML='<option value="">ზომა</option>';return}
  const sizes=data.stock.filter(s=>s.ProductID===p.ProductID).map(s=>{
    const available=Number(s.Qty||0)-Number(s.ReservedQty||0);
    return `<option value="${s.Size}" ${available<=0?'disabled':''}>${s.Size} — ${available} ც.</option>`;
  }).join('');
  sel.innerHTML='<option value="">ზომა</option>'+sizes;
}
function addSaleItem(){
  const p=selectedProduct();
  if(!p) return toast('პროდუქტი ვერ მოიძებნა');
  const size=document.getElementById('sizeSelect').value;
  if(!size) return toast('აირჩიე ზომა');
  const qty=Number(document.getElementById('qtyInput').value||1);
  const stockRow=data.stock.find(s=>s.ProductID===p.ProductID && String(s.Size)===String(size));
  const available=stockRow?Number(stockRow.Qty||0)-Number(stockRow.ReservedQty||0):0;
  if(qty>available) return toast('ამ ზომაზე საკმარისი რაოდენობა არ არის');
  const discount=Number(document.getElementById('discountInput').value||0);
  const price=Number(p.Price||0);
  const finalPrice=Math.max(price-discount,0);
  sale.push({productId:p.ProductID,code:p.Code,nameKA:p.NameKA,size,qty,price,discount,finalPrice});
  renderSale();
}
function renderSale(){
  const box=document.getElementById('saleItems');
  if(!box) return;
  if(!sale.length){
    box.className='cart-items empty';
    box.textContent='ჯერ არაფერი დამატებულა';
    document.getElementById('saleTotal').textContent='0₾';
    return;
  }
  box.className='cart-items';
  box.innerHTML=sale.map((i,ix)=>`<div class="cart-line"><div><b>${i.nameKA}</b><br><small>${i.code} / ${i.size} / ${i.qty} ც. / ფასდაკლება ${money(i.discount)}</small></div><div><b>${money(i.finalPrice*i.qty)}</b><br><button class="secondary" onclick="removeSaleItem(${ix})">წაშლა</button></div></div>`).join('');
  document.getElementById('saleTotal').textContent=money(saleTotal());
}
function removeSaleItem(ix){sale.splice(ix,1);renderSale()}
function saleTotal(){return sale.reduce((s,i)=>s+i.finalPrice*i.qty,0)}
async function completeSale(){
  if(!sale.length) return toast('გატარება ცარიელია');
  const cash=Number(document.getElementById('cashAmount').value||0);
  const card=Number(document.getElementById('cardAmount').value||0);
  if(cash+card!==saleTotal()) return toast('ქეში + ტერმინალი უნდა უდრიდეს ჯამს');
  const r=await api('createSale',{sale:{cashier:document.getElementById('cashierName').value,cashAmount:cash,cardAmount:card,items:sale}},'POST');
  if(!r.ok) return toast(r.error);
  sale=[];
  document.getElementById('cashAmount').value='';
  document.getElementById('cardAmount').value='';
  toast('გაყიდვა დასრულდა');
  await load();
}
async function closeDay(){
  const r=await api('closeDay',{close:{cashier:document.getElementById('cashierName').value}},'POST');
  if(!r.ok) return toast(r.error);
  toast(`დღე დაიხურა: ${money(r.total)} | ქეში ${money(r.cash)} | ტერმინალი ${money(r.card)}`);
}

document.getElementById('positionForm').onsubmit=async e=>{
  e.preventDefault();
  const position=Object.fromEntries(new FormData(e.target).entries());
  const r=await api('savePosition',{position},'POST');
  if(!r.ok) return toast(r.error);
  e.target.reset();
  toast('პოზიცია დაემატა');
  load();
};
document.getElementById('photoInput').onchange=e=>uploadFiles(e.target.files).catch(err=>toast(err.message));
document.getElementById('addSizeBtn').onclick=addSize;
addSize();

document.getElementById('productForm').onsubmit=async e=>{
  e.preventDefault();
  if(!document.getElementById('adminPosition').value){ toast('აირჩიე პოზიცია'); return; }
  const fd=Object.fromEntries(new FormData(e.target).entries());
  const sizes=[...document.querySelectorAll('.size-input')].map(d=>({size:d.children[0].value,qty:d.children[1].value})).filter(x=>x.size&&x.qty);
  const r=await api('saveProduct',{product:{...fd,images:uploaded,sizes}},'POST');
  if(!r.ok) return toast(r.error);
  e.target.reset();
  uploaded=[];
  document.getElementById('photoPreview').innerHTML='';
  document.getElementById('sizesBox').innerHTML='';
  addSize();
  toast('პროდუქტი შეინახა');
  load();
};

document.getElementById('codeInput').addEventListener('input',renderSizes);
document.getElementById('productSelect').addEventListener('change',()=>{
  document.getElementById('codeInput').value=document.getElementById('productSelect').value;
  renderSizes();
});
document.getElementById('addSaleItem').onclick=addSaleItem;
document.getElementById('completeSale').onclick=completeSale;
document.getElementById('closeDay').onclick=closeDay;

document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>t.hidden=true);
  document.getElementById(b.dataset.tab).hidden=false;
  location.hash=b.dataset.tab;
});
if(location.hash){
  const target=document.querySelector(`.nav button[data-tab="${location.hash.replace('#','')}"]`);
  if(target) target.click();
}
load();