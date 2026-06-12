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
function driveId(url){
  if(!url) return '';
  const u=String(url).trim();
  const m1=u.match(/[?&]id=([^&]+)/);
  const m2=u.match(/file\/d\/([^/]+)/);
  const m3=u.match(/googleusercontent\.com\/d\/([^/?#=]+)/);
  const m4=u.match(/\/d\/([^/?#=]+)/);
  let id=(m1&&m1[1])||(m2&&m2[1])||(m3&&m3[1])||(m4&&m4[1])||'';
  id=decodeURIComponent(String(id)).split(/[=&#?]/)[0];
  return id;
}
function imageCandidates(url){
  if(!url) return [];
  const original=String(url).trim();
  const id=driveId(original);
  const list=[original];
  if(id){
    list.push(`https://lh3.googleusercontent.com/d/${id}`);
    list.push(`https://drive.google.com/thumbnail?id=${id}&sz=w1200`);
    list.push(`https://drive.google.com/uc?export=view&id=${id}`);
  }
  return [...new Set(list.filter(Boolean))];
}
function firstImage(url){ return imageCandidates(url)[0] || ''; }
function imgAltAttr(url){ return esc(imageCandidates(url).join('|||')); }
function nextImage(img){
  const list=String(img.dataset.alt||'').split('|||').filter(Boolean);
  const ix=Number(img.dataset.ix||0)+1;
  if(ix<list.length){ img.dataset.ix=String(ix); img.src=list[ix]; return; }
  img.closest('.photo-wrap')?.classList.add('no-photo');
  img.style.display='none';
}

async function load(){
  try{
    const res = await api('catalog');
    if(!res.ok) throw new Error(res.error);
    state.positions = res.positions || [];
    state.products = (res.products || []).map(p=>{
      const imgs=(p.images&&p.images.length?p.images:(p.Images?safeJson(p.Images):[])).filter(Boolean);
      p.images=imgs;
      p.MainImage=p.MainImage || imgs[0] || '';
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
  const imgs=(p.images&&p.images.length?p.images:[p.MainImage]).filter(Boolean);
  const main=p.MainImage || imgs[0] || '';
  const gallery=imgs.map(url=>`<img src="${firstImage(url)}" data-alt="${imgAltAttr(url)}" data-ix="0" onerror="nextImage(this)" onclick="openLightbox('${esc(url)}')">`).join('');
  const available=(p.sizes||[]).some(s=>!s.disabled);
  return `<article class="product" data-id="${p.ProductID}">
    <div class="photo-wrap"><img src="${firstImage(main)}" data-alt="${imgAltAttr(main)}" data-ix="0" onerror="nextImage(this)" onclick="openLightbox('${esc(main)}')"><span class="badge">${esc(p.Code)}</span></div>
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
function openLightbox(url){ const src=firstImage(url); if(!src) return; document.getElementById('lightboxImg').src=src; document.getElementById('lightboxImg').dataset.alt=imgAltAttr(url); document.getElementById('lightboxImg').dataset.ix='0'; document.getElementById('lightboxImg').onerror=function(){nextImage(this)}; document.getElementById('lightbox').classList.remove('hidden'); }

document.getElementById('searchInput').addEventListener('input',renderProducts);
document.getElementById('positionFilter').addEventListener('change',renderProducts);
document.querySelectorAll('.lang button').forEach(b=>b.onclick=()=>{state.lang=b.dataset.lang;document.querySelectorAll('.lang button').forEach(x=>x.classList.remove('active'));b.classList.add('active');applyLang();renderFilters();renderProducts();renderCart();});
document.getElementById('orderForm').addEventListener('submit',submitOrder);
document.getElementById('wishForm').addEventListener('submit',submitWish);
document.getElementById('closeLightbox').onclick=()=>document.getElementById('lightbox').classList.add('hidden');
load();