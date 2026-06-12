const SPREADSHEET_ID = '1ywLFQQMY9634VEBOBALidE4XTD-6zw6YZxGQGw2ZOcg';
const DRIVE_FOLDER_NAME = 'MLApartClothes Product Photos';

const SHEETS = {
  settings: ['Key', 'Value'],
  positions: ['PositionID', 'NameKA', 'NameEN', 'NameRU', 'Status', 'CreatedAt'],
  products: ['ProductID', 'Code', 'PositionID', 'NameKA', 'NameEN', 'NameRU', 'OldPrice', 'Price', 'DescriptionKA', 'DescriptionEN', 'DescriptionRU', 'MainImage', 'Images', 'Status', 'CreatedAt', 'UpdatedAt'],
  stock: ['StockID', 'ProductID', 'Code', 'Size', 'Qty', 'ReservedQty', 'SoldQty', 'Status', 'UpdatedAt'],
  orders: ['OrderID', 'Date', 'CustomerName', 'Phone', 'RoomNumber', 'DeliveryTime', 'Total', 'Status', 'Note'],
  orderItems: ['OrderItemID', 'OrderID', 'ProductID', 'Code', 'NameKA', 'Size', 'Qty', 'Price', 'Total'],
  wishRequests: ['RequestID', 'Date', 'CustomerName', 'Phone', 'RoomNumber', 'Message', 'Status'],
  sales: ['SaleID', 'Date', 'Cashier', 'Total', 'CashAmount', 'CardAmount', 'DiscountAmount', 'Status', 'ClosedDayID'],
  saleItems: ['SaleItemID', 'SaleID', 'ProductID', 'Code', 'NameKA', 'Size', 'Qty', 'Price', 'Discount', 'FinalPrice', 'Total'],
  dayClose: ['CloseID', 'Date', 'Cashier', 'TotalSales', 'CashTotal', 'CardTotal', 'DiscountTotal', 'ClosedAt', 'Note']
};

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  try {
    if (action === 'setup') return json(setupSheets());
    if (action === 'catalog') return json(getCatalog());
    if (action === 'adminData') return json(getAdminData());
    if (action === 'analytics') return json(getAnalytics());
    return json({ ok: true, message: 'MLApartClothes API is running' });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

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

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#111827').setFontColor('#ffffff');
    sh.autoResizeColumns(1, headers.length);
  });
  seedPositions();
  return { ok: true, message: 'Sheets created/updated successfully' };
}

function seedPositions() {
  const defaults = [
    ['POS-' + Utilities.getUuid(), 'მაისური', 'T-shirt', 'Футболка', 'active', now()],
    ['POS-' + Utilities.getUuid(), 'შარვალი', 'Pants', 'Брюки', 'active', now()],
    ['POS-' + Utilities.getUuid(), 'კაბა', 'Dress', 'Платье', 'active', now()],
    ['POS-' + Utilities.getUuid(), 'ფეხსაცმელი', 'Shoes', 'Обувь', 'active', now()],
    ['POS-' + Utilities.getUuid(), 'ჩანთა', 'Bag', 'Сумка', 'active', now()],
    ['POS-' + Utilities.getUuid(), 'აქსესუარი', 'Accessory', 'Аксессуар', 'active', now()]
  ];
  const sh = sheet('positions');
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, defaults.length, defaults[0].length).setValues(defaults);
}

function getCatalog() {
  const positions = rows('positions').filter(x => x.Status === 'active');
  const products = rows('products').filter(x => x.Status === 'active');
  const stock = rows('stock').filter(x => x.Status === 'active');
  products.forEach(p => {
    p.images = parseImages(p.Images).map(normalizeDriveUrl);
    p.MainImage = normalizeDriveUrl(p.MainImage || (p.images[0] || ''));
    p.position = positions.find(pos => pos.PositionID === p.PositionID) || null;
    p.sizes = stock.filter(s => s.ProductID === p.ProductID).map(s => ({
      size: s.Size,
      qty: Number(s.Qty || 0),
      reserved: Number(s.ReservedQty || 0),
      available: Number(s.Qty || 0) - Number(s.ReservedQty || 0),
      disabled: (Number(s.Qty || 0) - Number(s.ReservedQty || 0)) <= 0
    }));
  });
  return { ok: true, positions, products };
}

function getAdminData() {
  return {
    ok: true,
    positions: rows('positions'),
    products: rows('products'),
    stock: rows('stock'),
    orders: rows('orders').reverse(),
    orderItems: rows('orderItems'),
    wishRequests: rows('wishRequests').reverse(),
    analytics: getAnalytics().data
  };
}

function uploadImage(body) {
  if (!body.fileName || !body.mimeType || !body.base64) throw new Error('Missing image data');
  const folder = getOrCreateFolder();
  const bytes = Utilities.base64Decode(body.base64.replace(/^data:.+;base64,/, ''));
  const blob = Utilities.newBlob(bytes, body.mimeType, body.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const id = file.getId();
  return { ok: true, id, url: 'https://lh3.googleusercontent.com/d/' + id + '=w1200' };
}

function savePosition(position) {
  if (!position.NameKA) throw new Error('Position name is required');
  const sh = sheet('positions');
  const id = position.PositionID || 'POS-' + Utilities.getUuid();
  sh.appendRow([id, position.NameKA || '', position.NameEN || '', position.NameRU || '', 'active', now()]);
  return { ok: true, id };
}

function updatePosition(position) {
  if (!position || !position.PositionID) throw new Error('PositionID is required');
  if (!position.NameKA) throw new Error('Position name is required');
  const sh = sheet('positions');
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idIx = headers.indexOf('PositionID');
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idIx]) === String(position.PositionID)) {
      setCell(sh, headers, r + 1, 'NameKA', position.NameKA || '');
      setCell(sh, headers, r + 1, 'NameEN', position.NameEN || '');
      setCell(sh, headers, r + 1, 'NameRU', position.NameRU || '');
      return { ok: true };
    }
  }
  throw new Error('Position not found');
}

function saveProduct(p) {
  if (!p.Code) throw new Error('Code is required');
  if (!p.PositionID) throw new Error('Position is required');
  if (!p.NameKA) throw new Error('Name is required');
  if (!p.Price) throw new Error('Price is required');
  if (!p.sizes || !p.sizes.length) throw new Error('At least one size is required');
  assertUniqueCode(p.Code, '');
  const productId = 'PR-' + Utilities.getUuid();
  const images = (p.images || []).map(normalizeDriveUrl);
  sheet('products').appendRow([
    productId, cleanCode(p.Code), p.PositionID, p.NameKA || '', p.NameEN || '', p.NameRU || '',
    p.OldPrice || '', p.Price || '', p.DescriptionKA || '', p.DescriptionEN || '', p.DescriptionRU || '',
    images[0] || '', JSON.stringify(images), 'active', now(), now()
  ]);
  const stockRows = p.sizes.map(s => ['ST-' + Utilities.getUuid(), productId, cleanCode(p.Code), s.size, Number(s.qty || 0), 0, 0, 'active', now()]);
  if (stockRows.length) sheet('stock').getRange(sheet('stock').getLastRow() + 1, 1, stockRows.length, stockRows[0].length).setValues(stockRows);
  return { ok: true, productId };
}

function updateProduct(p, stockRows) {
  if (!p.ProductID) throw new Error('ProductID is required');
  if (!p.PositionID) throw new Error('Position is required');
  if (!p.NameKA) throw new Error('Name is required');
  if (!p.Price) throw new Error('Price is required');
  const product = findProductById(p.ProductID);
  if (!product) throw new Error('Product not found');
  const code = cleanCode(product.Code);
  const sh = sheet('products');
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const rowNumber = product.__row;
  setCell(sh, headers, rowNumber, 'PositionID', p.PositionID);
  setCell(sh, headers, rowNumber, 'NameKA', p.NameKA || '');
  setCell(sh, headers, rowNumber, 'NameEN', p.NameEN || '');
  setCell(sh, headers, rowNumber, 'NameRU', p.NameRU || '');
  setCell(sh, headers, rowNumber, 'OldPrice', p.OldPrice || '');
  setCell(sh, headers, rowNumber, 'Price', p.Price || '');
  setCell(sh, headers, rowNumber, 'DescriptionKA', p.DescriptionKA || '');
  setCell(sh, headers, rowNumber, 'UpdatedAt', now());
  updateStockRows(p.ProductID, code, stockRows || []);
  return { ok: true };
}

function updateStockRows(productId, code, stockRows) {
  const sh = sheet('stock');
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const stockIdIx = headers.indexOf('StockID');
  const productIx = headers.indexOf('ProductID');
  const sizeIx = headers.indexOf('Size');
  const qtyIx = headers.indexOf('Qty');
  const statusIx = headers.indexOf('Status');
  const updatedIx = headers.indexOf('UpdatedAt');
  const existing = {};
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][productIx]) === String(productId)) {
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
    order.items.forEach(item => reserveStock(item.code, item.size, Number(item.qty || 1)));
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

function createWish(r) {
  if (!r.message) throw new Error('Message is required');
  const id = 'REQ-' + Utilities.getUuid();
  sheet('wishRequests').appendRow([id, now(), r.customerName || '', r.phone || '', r.roomNumber || '', r.message, 'new']);
  return { ok: true, id };
}

function createSale(sale) {
  if (!sale.items || !sale.items.length) throw new Error('Sale is empty');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sale.items.forEach(item => sellStock(item.code, item.size, Number(item.qty || 1)));
    const saleId = 'SALE-' + Utilities.getUuid();
    const discount = sale.items.reduce((sum, item) => sum + Number(item.discount || 0) * Number(item.qty || 1), 0);
    const total = sale.items.reduce((sum, item) => sum + Number(item.finalPrice || item.price || 0) * Number(item.qty || 1), 0);
    sheet('sales').appendRow([saleId, now(), sale.cashier || '', total, Number(sale.cashAmount || 0), Number(sale.cardAmount || 0), discount, 'completed', '']);
    const rowsToAdd = sale.items.map(item => ['SI-' + Utilities.getUuid(), saleId, item.productId, item.code, item.nameKA, item.size, Number(item.qty || 1), Number(item.price || 0), Number(item.discount || 0), Number(item.finalPrice || item.price || 0), Number(item.finalPrice || item.price || 0) * Number(item.qty || 1)]);
    sheet('saleItems').getRange(sheet('saleItems').getLastRow() + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    return { ok: true, saleId, total };
  } finally {
    lock.releaseLock();
  }
}

function closeDay(c) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const sales = rows('sales').filter(s => String(s.Date).startsWith(today) && s.Status === 'completed');
  const total = sales.reduce((sum, s) => sum + Number(s.Total || 0), 0);
  const cash = sales.reduce((sum, s) => sum + Number(s.CashAmount || 0), 0);
  const card = sales.reduce((sum, s) => sum + Number(s.CardAmount || 0), 0);
  const discount = sales.reduce((sum, s) => sum + Number(s.DiscountAmount || 0), 0);
  const id = 'CLOSE-' + Utilities.getUuid();
  sheet('dayClose').appendRow([id, today, c.cashier || '', total, cash, card, discount, now(), c.note || '']);
  return { ok: true, id, total, cash, card, discount };
}

function getAnalytics() {
  const stockRows = rows('stock');
  const items = rows('saleItems');
  const products = rows('products');
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

function reserveStock(code, size, qty) { changeStock(code, size, qty, 'reserve'); }
function sellStock(code, size, qty) { changeStock(code, size, qty, 'sell'); }

function changeStock(code, size, qty, mode) {
  const sh = sheet('stock');
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const codeIx = headers.indexOf('Code');
  const sizeIx = headers.indexOf('Size');
  const qtyIx = headers.indexOf('Qty');
  const resIx = headers.indexOf('ReservedQty');
  const soldIx = headers.indexOf('SoldQty');
  const updatedIx = headers.indexOf('UpdatedAt');
  for (let r = 1; r < data.length; r++) {
    if (cleanCode(data[r][codeIx]) === cleanCode(code) && String(data[r][sizeIx]) === String(size)) {
      const available = Number(data[r][qtyIx] || 0) - Number(data[r][resIx] || 0);
      if (available < qty) throw new Error('Not enough stock for ' + code + ' size ' + size);
      if (mode === 'reserve') sh.getRange(r + 1, resIx + 1).setValue(Number(data[r][resIx] || 0) + qty);
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

function updateStatus(sheetName, idCol, id, status) {
  const sh = sheet(sheetName);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idIx = headers.indexOf(idCol);
  const statusIx = headers.indexOf('Status');
  for (let r = 1; r < data.length; r++) {
    if (data[r][idIx] === id) {
      sh.getRange(r + 1, statusIx + 1).setValue(status);
      return { ok: true };
    }
  }
  throw new Error('Record not found');
}

function assertUniqueCode(code, allowProductId) {
  const clean = cleanCode(code);
  const products = rowsWithRow('products');
  const duplicateProduct = products.find(p => cleanCode(p.Code) === clean && (!allowProductId || p.ProductID !== allowProductId));
  if (duplicateProduct) throw new Error('ეს კოდი უკვე არსებობს სტოკში: ' + clean);
  const stockRows = rows('stock');
  const duplicateStock = stockRows.find(s => cleanCode(s.Code) === clean && (!allowProductId || s.ProductID !== allowProductId));
  if (duplicateStock) throw new Error('ეს კოდი უკვე არსებობს სტოკში: ' + clean);
}
function cleanCode(code) { return String(code || '').trim(); }
function findProductById(productId) { return rowsWithRow('products').find(p => p.ProductID === productId); }
function setCell(sh, headers, rowNumber, header, value) {
  const ix = headers.indexOf(header);
  if (ix >= 0) sh.getRange(rowNumber, ix + 1).setValue(value);
}
function normalizeDriveUrl(url) {
  if (!url) return '';
  const value = String(url).trim();
  let id = '';
  const m1 = value.match(/[?&]id=([^&]+)/);
  const m2 = value.match(/\/d\/([^/?=]+)/);
  const m3 = value.match(/file\/d\/([^/]+)/);
  if (m1) id = m1[1];
  else if (m2) id = m2[1];
  else if (m3) id = m3[1];
  return id ? 'https://lh3.googleusercontent.com/d/' + id + '=w1200' : value;
}
function sheet(key) { return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(key); }
function rows(key) {
  const sh = sheet(key);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  return values.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
}
function rowsWithRow(key) {
  const sh = sheet(key);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  return values.map((row, i) => {
    const obj = Object.fromEntries(headers.map((h, ix) => [h, row[ix]]));
    obj.__row = i + 2;
    return obj;
  });
}
function parseImages(value) { try { return value ? JSON.parse(value) : []; } catch (e) { return []; } }
function now() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'); }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
}