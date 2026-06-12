const API = window.APP_CONFIG.API_URL;
let state = { lang: 'ka', positions: [], products: [], cart: [] };
const t = {
  ka: {
    all:'ყველა პოზიცია', add:'კალათაში დამატება', sold:'ამოიწურა', choose:'აირჩიეთ ზომა', ordered:'შეკვეთა გაიგზავნა', wish:'შეტყობინება გაიგზავნა', added:'დაემატა კალათაში', notFound:'პროდუქცია ვერ მოიძებნა',
    heroTitle:'შეუკვეთე პროდუქცია ნომერში', heroText:'აირჩიე სასურველი პროდუქტი, ზომა და მიღების დრო.', search:'ძებნა კოდით ან სახელით', cart:'კალათა', emptyCart:'კალათა ცარიელია', total:'ჯამი', fullName:'სახელი გვარი *', phone:'ტელეფონი *', roomOptional:'ოთახის ნომერი თუ ჩვენთან ისვენებთ', note:'შენიშვნა', checkout:'გამოწერა', wishTitle:'რა პროდუქციას ისურვებდით?', name:'სახელი', phoneShort:'ტელეფონი', room:'ოთახი', wishMessage:'დაწერეთ რა გსურთ', send:'გაგზავნა', piece:'ც.', remove:'წაშლა'
  },
  en: {
    all:'All positions', add:'Add to cart', sold:'Sold out', choose:'Choose size', ordered:'Order sent', wish:'Request sent', added:'Added to cart', notFound:'No products found',
    heroTitle:'Order products to your room', heroText:'Choose a product, size and preferred delivery time.', search:'Search by code or name', cart:'Cart', emptyCart:'Your cart is empty', total:'Total', fullName:'Full name *', phone:'Phone *', roomOptional:'Room number if you are staying with us', note:'Note', checkout:'Order', wishTitle:'What product would you like?', name:'Name', phoneShort:'Phone', room:'Room', wishMessage:'Write what you would like', send:'Send', piece:'pcs.', remove:'Remove'
  },
  ru: {
    all:'Все позиции', add:'В корзину', sold:'Нет в наличии', choose:'Выберите размер', ordered:'Заказ отправлен', wish:'Запрос отправлен', added:'Добавлено в корзину', notFound:'Товары не найдены',
    heroTitle:'Закажите товар в номер', heroText:'Выберите товар, размер и удобное время доставки.', search:'Поиск по коду или названию', cart:'Корзина', emptyCart:'Корзина пуста', total:'Итого', fullName:'Имя и фамилия *', phone:'Телефон *', roomOptional:'Номер комнаты, если вы у нас отдыхаете', note:'Комментарий', checkout:'Оформить', wishTitle:'Какой товар вы бы хотели?', name:'Имя', phoneShort:'Телефон', room:'Комната', wishMessage:'Напишите, что вы хотите', send:'Отправить', piece:'шт.', remove:'Удалить'
  }
};

async function api(action, data, method='GET'){
  if(!API || API.includes('PASTE_')) throw new Error('API URL is not configured');
  if(method === 'GET') return fetch(`${API}?action=${action}`).then(r=>r.json());
  return fetch(API, { method:'POST', body:JSON.stringify({ action, ...data }) }).then(r=>r.json());
}
function tr(key){ return t[state.lang][key] || t.ka[key] || key; }
function nameOf(obj){ const l=state.lang.toUpperCase(); return obj['Name'+l] || obj.NameKA || obj.NameEN || obj.NameRU || ''; }
function money(v){ return `${Number(v||0).toFixed(0)}₾`; }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }
function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function normalizeImage(url){
  if(!url) return '';
  const u=String(url).trim();
  let id='';
  const m1=u.match(/[?&]id=([^&]+)/);
  const m2=u.match(/\/d\/([^/?]+)/);
  const m3=u.match(/file\/d\/([^/]+)/);
  if(m1) id=m1[1];
  else if(m2) id=m2[1];
  else if(m3) id=m3[1];
  if(id) return `https://lh3.googleusercontent.com/d/${id}=w1200`;
  return u;
}

async function load(){
  try{
    const res = await api('catalog');
    if(!res.ok) throw new Error(res.error);
    state.positions = res.positions || [];
    state.products = (res.products || []).map(p=>{
      const imgs=(p.images&&p.images.length?p.images:(p.Images?safeJson(p.Images):[])).filter(Boolean).map(normalizeImage);
      p.images=imgs;
      p.MainImage=normalizeImage(p.MainImage || imgs[0] || '');
      return p;
    });
    applyLang(); renderFilters(); renderProducts(); renderCart();
  }catch(e){ toast(e.message); }
}
function safeJson(v){try{return JSON.parse(v||'[]')}catch(e){return []}}
function applyLang(){
  document.documentElement.lang=state.lang;
  const heroTitle=document.querySelector('.hero h1'); if(heroTitle) heroTitle.textContent=tr('heroTitle');
  const heroText=document.querySelector('.hero > div p:last-child'); if(heroText) heroText.textContent=tr('heroText');
  const search=document.getElementById('searchInput'); if(search) search.placeholder=tr('search');
  const cartTitle=document.querySelector('.cart-panel h2'); if(cartTitle) cartTitle.textContent=tr('cart');
  const totalLabel=document.querySelector('.cart-total span'); if(totalLabel) totalLabel.textContent=tr('total');
  const orderForm=document.getElementById('orderForm');
  if(orderForm){
    orderForm.customerName.placeholder=tr('fullName');
    orderForm.phone.placeholder=tr('phone');
    orderForm.roomNumber.placeholder=tr('roomOptional');
    orderForm.note.placeholder=tr('note');
    orderForm.querySelector('button[type="submit"]').textContent=tr('checkout');
  }
  const wishTitle=document.querySelector('.wish-box h3'); if(wishTitle) wishTitle.textContent=tr('wishTitle');
  const wishForm=document.getElementById('wishForm');
  if(wishForm){
    wishForm.customerName.placeholder=tr('name');
    wishForm.phone.placeholder=tr('phoneShort');
    wishForm.roomNumber.placeholder=tr('room');
    wishForm.message.placeholder=tr('wishMessage');
    wishForm.querySelector('button[type="submit"]').textContent=tr('send');
  }
}
function renderFilters(){
  const sel=document.getElementById('positionFilter');
  const old=sel.value;
  sel.innerHTML = `<option value="">${tr('all')}</option>` + state.positions.map(p=>`<option value="${p.PositionID}">${esc(nameOf(p))}</option>`).join('');
  sel.value=old;
}
function renderProducts(){
  const q=document.getElementById('searchInput').value.toLowerCase();
  const pos=document.getElementById('positionFilter').value;
  const list=state.products.filter(p=>(!pos||p.PositionID===pos) && (`${p.Code} ${nameOf(p)}`.toLowerCase().includes(q)));
  document.getElementById('products').innerHTML=list.map(p=>card(p)).join('') || `<p>${tr('notFound')}</p>`;
}
function card(p){
  const sizes=(p.sizes||[]).map(s=>`<button class="size ${s.disabled?'disabled':''}" ${s.disabled?'disabled':''} onclick="selectSize('${p.ProductID}','${esc(s.size)}',this)">${esc(s.size)}</button>`).join('');
  const imgs=(p.images&&p.images.length?p.images:[p.MainImage]).filter(Boolean).map(normalizeImage);
  const main=normalizeImage(p.MainImage || imgs[0] || '');
  const gallery=imgs.map(url=>`<img src="${url}" onerror="this.style.display='none'" onclick="openLightbox('${url}')">`).join('');
  const available=(p.sizes||[]).some(s=>!s.disabled);
  return `<article class="product" data-id="${p.ProductID}">
    <div class="photo-wrap"><img src="${main}" onerror="this.closest('.photo-wrap').classList.add('no-photo')" onclick="openLightbox('${main}')"><span class="badge">${esc(p.Code)}</span></div>
    <div class="p-body">
      <h3>${esc(nameOf(p))}</h3><div class="code">${p.position?esc(nameOf(p.position)):''}</div>
      <div class="price">${p.OldPrice?`<span class="old">${money(p.OldPrice)}</span>`:''}<span class="new">${money(p.Price)}</span></div>
      <div class="size-row">${sizes}</div><div class="gallery">${gallery}</div>
      <button ${available?'':'disabled'} onclick="addToCart('${p.ProductID}')">${available?tr('add'):tr('sold')}</button>
    </div>
  </article>`;
}
function selectSize(pid,size,btn){ document.querySelectorAll(`[data-id="${pid}"] .size`).forEach(b=>b.classList.remove('active')); btn.classList.add('active'); btn.closest('.product').dataset.size=size; }
function addToCart(pid){
  const p=state.products.find(x=>x.ProductID===pid); const card=document.querySelector(`[data-id="${pid}"]`); const size=card.dataset.size;
  if(!size){ toast(tr('choose')); return; }
  const found=state.cart.find(x=>x.productId===pid&&x.size===size);
  if(found) found.qty++; else state.cart.push({ productId:pid, code:p.Code, nameKA:p.NameKA, name:nameOf(p), size, qty:1, price:Number(p.Price), mainImage:p.MainImage });
  renderCart(); toast(tr('added'));
}
function renderCart(){
  const box=document.getElementById('cartItems');
  if(!state.cart.length){ box.className='cart-items empty'; box.textContent=tr('emptyCart'); document.getElementById('cartTotal').textContent='0₾'; return; }
  box.className='cart-items';
  box.innerHTML=state.cart.map((i,ix)=>`<div class="cart-line"><div><b>${esc(i.name)}</b><br><small>${esc(i.code)} / ${esc(i.size)} / ${i.qty} ${tr('piece')}</small></div><div><b>${money(i.price*i.qty)}</b><br><button class="secondary" onclick="removeCart(${ix})">${tr('remove')}</button></div></div>`).join('');
  document.getElementById('cartTotal').textContent=money(state.cart.reduce((s,i)=>s+i.price*i.qty,0));
}
function removeCart(ix){ state.cart.splice(ix,1); renderCart(); }
async function submitOrder(e){
  e.preventDefault(); if(!state.cart.length) return toast(tr('emptyCart'));
  const fd=Object.fromEntries(new FormData(e.target).entries());
  const res=await api('createOrder',{order:{...fd,items:state.cart}},'POST');
  if(!res.ok) return toast(res.error);
  state.cart=[]; e.target.reset(); renderCart(); await load(); toast(tr('ordered'));
}
async function submitWish(e){
  e.preventDefault(); const fd=Object.fromEntries(new FormData(e.target).entries());
  const res=await api('createWish',{request:fd},'POST');
  if(!res.ok) return toast(res.error); e.target.reset(); toast(tr('wish'));
}
function openLightbox(url){ url=normalizeImage(url); if(!url) return; document.getElementById('lightboxImg').src=url; document.getElementById('lightbox').classList.remove('hidden'); }

document.getElementById('searchInput').addEventListener('input',renderProducts);
document.getElementById('positionFilter').addEventListener('change',renderProducts);
document.querySelectorAll('.lang button').forEach(b=>b.onclick=()=>{state.lang=b.dataset.lang;document.querySelectorAll('.lang button').forEach(x=>x.classList.remove('active'));b.classList.add('active');applyLang();renderFilters();renderProducts();renderCart();});
document.getElementById('orderForm').addEventListener('submit',submitOrder);
document.getElementById('wishForm').addEventListener('submit',submitWish);
document.getElementById('closeLightbox').onclick=()=>document.getElementById('lightbox').classList.add('hidden');
load();