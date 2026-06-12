function orderItemsFor(orderId){
  return (data.orderItems||[]).filter(i=>String(i.OrderID)===String(orderId));
}

function orderItemsTotal(items){
  return items.reduce((sum,i)=>sum+Number(i.Total||0),0);
}

function orderDetailsHtml(orderId){
  const items=orderItemsFor(orderId);
  if(!items.length) return '<div class="empty">ამ შეკვეთაზე ნივთები ვერ მოიძებნა</div>';
  return `<div class="order-detail-box"><h3>ორდერის შემადგენლობა</h3>${table(['კოდი','პროდუქტი','ზომა','რაოდენობა','ფასი','ჯამი'],items.map(i=>[
    esc(i.Code),
    esc(i.NameKA),
    esc(i.Size),
    Number(i.Qty||0),
    money(i.Price),
    money(i.Total)
  ]))}<div class="cart-total"><span>ორდერის ჯამი</span><b>${money(orderItemsTotal(items))}</b></div></div>`;
}

function toggleOrderDetails(orderId){
  const row=document.getElementById('orderDetails_'+String(orderId).replace(/[^a-zA-Z0-9_-]/g,'_'));
  if(!row) return;
  row.hidden=!row.hidden;
}

renderOrders=function(){
  const rows=[];
  (data.orders||[]).forEach(o=>{
    const safeId=String(o.OrderID).replace(/[^a-zA-Z0-9_-]/g,'_');
    rows.push([
      esc(o.Date),
      esc(o.CustomerName),
      esc(o.Phone),
      esc(o.RoomNumber),
      esc(o.DeliveryTime),
      money(o.Total),
      `<button type="button" class="secondary" onclick="toggleOrderDetails('${o.OrderID}')">ორდერის ნახვა</button>`,
      statusSelect('orders',o.OrderID,o.Status)
    ]);
    rows.push([`<div id="orderDetails_${safeId}" hidden>${orderDetailsHtml(o.OrderID)}</div>`,'','','','','','','']);
  });
  document.getElementById('ordersTable').innerHTML=table(['თარიღი','კლიენტი','ტელეფონი','ოთახი','დრო','ჯამი','ორდერი','სტატუსი'],rows);
};

if(window.data){
  renderOrders();
}
