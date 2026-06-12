// Paste this block at the END of Apps Script Code.gs, then Deploy a new Web App version.
// It overrides selected functions from the main file.

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    if (action === 'setup') return json(setupSheets());
    if (action === 'uploadImage') return json(uploadImage(body));
    if (action === 'savePosition') return json(savePosition(body.position));
    if (action === 'updatePosition') return json(updatePosition(body.position));
    if (action === 'saveProduct') return json(saveProduct(body.product));
    if (action === 'updateProduct') return json(updateProduct(body.product, body.stock || []));
    if (action === 'archiveProduct') return json(archiveProduct(body.productId));
    if (action === 'createOrder') return json(createOrder(body.order));
    if (action === 'updateOrderStatus') return json(updateStatus('orders', 'OrderID', body.id, body.status));
    if (action === 'createWish') return json(createWish(body.request));
    if (action === 'updateWishStatus') return json(updateStatus('wishRequests', 'RequestID', body.id, body.status));
    if (action === 'createSale') return json(createSale(body.sale));
    if (action === 'closeDay') return json(closeDay(body.close));
    throw new Error('Unknown action: ' + action);
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function updateProduct(p, stockRows) {
  if (!p.ProductID) throw new Error('ProductID is required');
  if (!p.Code) throw new Error('Code is required');
  if (!p.PositionID) throw new Error('Position is required');
  if (!p.NameKA) throw new Error('Name is required');
  if (!p.Price) throw new Error('Price is required');
  const product = findProductById(p.ProductID);
  if (!product) throw new Error('Product not found');
  const newCode = cleanCode(p.Code);
  assertUniqueCode(newCode, p.ProductID);
  const sh = sheet('products');
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const rowNumber = product.__row;
  setCell(sh, headers, rowNumber, 'Code', newCode);
  setCell(sh, headers, rowNumber, 'PositionID', p.PositionID);
  setCell(sh, headers, rowNumber, 'NameKA', p.NameKA || '');
  setCell(sh, headers, rowNumber, 'NameEN', p.NameEN || '');
  setCell(sh, headers, rowNumber, 'NameRU', p.NameRU || '');
  setCell(sh, headers, rowNumber, 'OldPrice', p.OldPrice || '');
  setCell(sh, headers, rowNumber, 'Price', p.Price || '');
  setCell(sh, headers, rowNumber, 'DescriptionKA', p.DescriptionKA || '');
  setCell(sh, headers, rowNumber, 'UpdatedAt', now());
  updateStockRows(p.ProductID, newCode, stockRows || []);
  return { ok: true };
}

function archiveProduct(productId) {
  if (!productId) throw new Error('ProductID is required');
  const product = findProductById(productId);
  if (!product) throw new Error('Product not found');
  const psh = sheet('products');
  const pdata = psh.getDataRange().getValues();
  const pheaders = pdata[0];
  setCell(psh, pheaders, product.__row, 'Status', 'archived');
  setCell(psh, pheaders, product.__row, 'UpdatedAt', now());
  const ssh = sheet('stock');
  const sdata = ssh.getDataRange().getValues();
  const sheaders = sdata[0];
  const productIx = sheaders.indexOf('ProductID');
  const statusIx = sheaders.indexOf('Status');
  const updatedIx = sheaders.indexOf('UpdatedAt');
  for (let r = 1; r < sdata.length; r++) {
    if (String(sdata[r][productIx]) === String(productId)) {
      if (statusIx >= 0) ssh.getRange(r + 1, statusIx + 1).setValue('archived');
      if (updatedIx >= 0) ssh.getRange(r + 1, updatedIx + 1).setValue(now());
    }
  }
  return { ok: true };
}

function updateStockRows(productId, code, stockRows) {
  const sh = sheet('stock');
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const stockIdIx = headers.indexOf('StockID');
  const productIx = headers.indexOf('ProductID');
  const codeIx = headers.indexOf('Code');
  const sizeIx = headers.indexOf('Size');
  const qtyIx = headers.indexOf('Qty');
  const statusIx = headers.indexOf('Status');
  const updatedIx = headers.indexOf('UpdatedAt');
  const existing = {};
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][productIx]) === String(productId)) {
      if (codeIx >= 0) sh.getRange(r + 1, codeIx + 1).setValue(code);
      const key = String(values[r][sizeIx]).trim().toLowerCase();
      existing[key] = { row: r + 1, stockId: values[r][stockIdIx], size: values[r][sizeIx] };
    }
  }
  stockRows.forEach(s => {
    const size = String(s.Size || s.size || '').trim();
    if (!size) return;
    const qty = Math.max(0, Number(s.Qty || s.qty || 0));
    const key = size.toLowerCase();
    if (existing[key]) {
      sh.getRange(existing[key].row, qtyIx + 1).setValue(qty);
      sh.getRange(existing[key].row, statusIx + 1).setValue('active');
      sh.getRange(existing[key].row, updatedIx + 1).setValue(now());
    } else {
      sh.appendRow(['ST-' + Utilities.getUuid(), productId, code, size, qty, 0, 0, 'active', now()]);
    }
  });
}

function createOrder(order) {
  if (!order.customerName || !order.phone || !order.deliveryTime) throw new Error('Customer name, phone and delivery time are required');
  if (!order.items || !order.items.length) throw new Error('Cart is empty');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    order.items.forEach(item => orderStockOut(item.code, item.size, Number(item.qty || 1)));
    const orderId = 'ORD-' + Utilities.getUuid();
    const total = order.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1), 0);
    sheet('orders').appendRow([orderId, now(), order.customerName, order.phone, order.roomNumber || '', order.deliveryTime, total, 'new', order.note || '']);
    const rowsToAdd = order.items.map(item => ['OI-' + Utilities.getUuid(), orderId, item.productId, item.code, item.nameKA, item.size, Number(item.qty || 1), Number(item.price || 0), Number(item.price || 0) * Number(item.qty || 1)]);
    sheet('orderItems').getRange(sheet('orderItems').getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    return { ok: true, orderId };
  } finally {
    lock.releaseLock();
  }
}

function orderStockOut(code, size, qty) { changeStock(code, size, qty, 'order'); }

function changeStock(code, size, qty, mode) {
  const sh = sheet('stock');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const codeIx = headers.indexOf('Code');
  const sizeIx = headers.indexOf('Size');
  const qtyIx = headers.indexOf('Qty');
  const resIx = headers.indexOf('ReservedQty');
  const soldIx = headers.indexOf('SoldQty');
  const statusIx = headers.indexOf('Status');
  const updatedIx = headers.indexOf('UpdatedAt');
  for (let r = 1; r < data.length; r++) {
    if (cleanCode(data[r][codeIx]) === cleanCode(code) && String(data[r][sizeIx]) === String(size) && String(data[r][statusIx] || 'active') === 'active') {
      const available = Number(data[r][qtyIx] || 0) - Number(data[r][resIx] || 0);
      if (available < qty) throw new Error('Not enough stock for ' + code + ' size ' + size);
      if (mode === 'reserve') sh.getRange(r + 1, resIx + 1).setValue(Number(data[r][resIx] || 0) + qty);
      if (mode === 'order') sh.getRange(r + 1, qtyIx + 1).setValue(Number(data[r][qtyIx] || 0) - qty);
      if (mode === 'sell') {
        sh.getRange(r + 1, qtyIx + 1).setValue(Number(data[r][qtyIx] || 0) - qty);
        sh.getRange(r + 1, soldIx + 1).setValue(Number(data[r][soldIx] || 0) + qty);
      }
      if (updatedIx >= 0) sh.getRange(r + 1, updatedIx + 1).setValue(now());
      return;
    }
  }
  throw new Error('Stock item not found: ' + code + ' / ' + size);
}

function getAnalytics() {
  const stockRows = rows('stock').filter(s => s.Status === 'active');
  const items = rows('saleItems');
  const products = rows('products').filter(p => p.Status === 'active');
  const allStock = stockRows
    .map(s => ({ code: s.Code, size: s.Size, qty: Number(s.Qty || 0), reserved: Number(s.ReservedQty || 0), sold: Number(s.SoldQty || 0), available: Number(s.Qty || 0) - Number(s.ReservedQty || 0) }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)) || String(a.size).localeCompare(String(b.size)));
  const lowStock = allStock.filter(x => x.available <= 2).sort((a, b) => a.available - b.available);
  const soldMap = {};
  items.forEach(i => { soldMap[i.Code] = (soldMap[i.Code] || 0) + Number(i.Qty || 0); });
  const bestSellers = Object.keys(soldMap).map(code => {
    const p = products.find(x => x.Code === code) || {};
    return { code, name: p.NameKA || '', sold: soldMap[code] };
  }).sort((a, b) => b.sold - a.sold).slice(0, 10);
  return { ok: true, data: { allStock, lowStock, bestSellers } };
}

function assertUniqueCode(code, allowProductId) {
  const clean = cleanCode(code);
  const products = rowsWithRow('products').filter(p => p.Status === 'active');
  const duplicateProduct = products.find(p => cleanCode(p.Code) === clean && (!allowProductId || p.ProductID !== allowProductId));
  if (duplicateProduct) throw new Error('ეს კოდი უკვე არსებობს სტოკში: ' + clean);
  const stockRows = rows('stock').filter(s => s.Status === 'active');
  const duplicateStock = stockRows.find(s => cleanCode(s.Code) === clean && (!allowProductId || s.ProductID !== allowProductId));
  if (duplicateStock) throw new Error('ეს კოდი უკვე არსებობს სტოკში: ' + clean);
}
