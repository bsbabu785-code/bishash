/**
 * Google Apps Script — Bishash Halua order email notifier
 *
 * Deploy:
 *   1. https://script.google.com → New project → paste this file
 *   2. Deploy → New deployment → Type: Web app
 *      - Execute as: Me (bsbabu785@gmail.com)
 *      - Who has access: Anyone
 *   3. Copy the /exec URL → set APPS_SCRIPT_URL in backend .env / Render
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const to = data.to || 'bsbabu785@gmail.com';
    const o = data.order || {};

    const subject = `🛒 নতুন অর্ডার — ${o.orderId || ''} — ${o.customerName || ''}`;
    const html = `
      <h2 style="color:#a8501a">নতুন অর্ডার এসেছে</h2>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;font-family:Arial;font-size:14px">
        <tr><td><b>Order ID</b></td><td>${o.orderId || ''}</td></tr>
        <tr><td><b>Customer</b></td><td>${o.customerName || ''}</td></tr>
        <tr><td><b>Phone</b></td><td>${o.phone || ''}</td></tr>
        <tr><td><b>Address</b></td><td>${o.address || ''}</td></tr>
        <tr><td><b>Product</b></td><td>${o.product || ''} (${o.weight || ''}) × ${o.quantity || 1}</td></tr>
        <tr><td><b>Product Price</b></td><td>৳ ${o.productPrice || 0}</td></tr>
        <tr><td><b>Delivery</b></td><td>৳ ${o.deliveryCharge || 0}</td></tr>
        <tr><td><b>Discount</b></td><td>৳ ${o.discount || 0} ${o.couponCode ? '('+o.couponCode+')' : ''}</td></tr>
        <tr><td><b>Total</b></td><td><b>৳ ${o.totalAmount || 0}</b></td></tr>
        <tr><td><b>Payment</b></td><td>${o.paymentMethod || ''}</td></tr>
        <tr><td><b>Sender No</b></td><td>${o.senderNumber || ''}</td></tr>
        <tr><td><b>Trx ID</b></td><td>${o.transactionId || ''}</td></tr>
        <tr><td><b>Status</b></td><td>${o.status || 'pending'}</td></tr>
      </table>
      <p style="color:#666;font-size:12px">Bishash Halua Admin</p>
    `;
    MailApp.sendEmail({ to, subject, htmlBody: html });
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('Bishash Halua mailer OK');
}
