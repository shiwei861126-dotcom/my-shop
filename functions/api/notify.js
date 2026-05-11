// Cloudflare Pages Function - 飞书订单通知 + 邮件通知
const APP_ID = 'cli_a96d2a7b7fb85cdb';
const APP_SECRET = 'M2WltwlGbPLNvDppZ1wG8gujxWGuLPcJ';
const CHAT_ID = 'oc_5c593909bec52ce8c5f287f83b77581d';
const NOTIFY_EMAIL = 'shiwei861126@gmail.com';

async function getToken() {
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error('getToken failed: ' + data.msg);
  return data.tenant_access_token;
}

async function uploadImage(token, base64Data) {
  const commaIdx = base64Data.indexOf(',');
  const rawBase64 = commaIdx > -1 ? base64Data.substring(commaIdx + 1) : base64Data;
  const binaryStr = atob(rawBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const formData = new FormData();
  const blob = new Blob([bytes], { type: 'image/png' });
  formData.append('image_type', 'message');
  formData.append('image', blob, 'voucher.png');
  const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/images', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error('uploadImage failed: ' + data.msg);
  return data.data.image_key;
}

async function sendFeishuMessage(token, chatId, content) {
  const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(content) })
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error('sendFeishuMessage failed: ' + data.msg);
  return data;
}

async function sendEmail(orderId, productName, total, customer) {
  const { name, phone, address, note } = customer;
  const subject = '[RSD] 新订单 ' + orderId;
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;max-width:600px;margin:0 auto;">'
    + '<h2 style="color:#e53e3e;">☁ 新订单通知</h2>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + '<tr><td style="padding:8px;font-weight:bold;">订单编号</td><td style="padding:8px;">' + orderId + '</td></tr>'
    + '<tr style="background:#f7fafc;"><td style="padding:8px;font-weight:bold;">商品</td><td style="padding:8px;">' + productName + '</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold;">金额</td><td style="padding:8px;font-size:18px;font-weight:bold;color:#e53e3e;">¥' + (total || 0).toFixed(2) + '</td></tr>'
    + '<tr style="background:#f7fafc;"><td style="padding:8px;font-weight:bold;">收货人</td><td style="padding:8px;">' + (name || '') + '</td></tr>'
    + '<tr><td style="padding:8px;font-weight:bold;">手机号</td><td style="padding:8px;">' + (phone || '') + '</td></tr>'
    + '<tr style="background:#f7fafc;"><td style="padding:8px;font-weight:bold;">地址</td><td style="padding:8px;">' + (address || '') + '</td></tr>'
    + (note ? '<tr><td style="padding:8px;font-weight:bold;">备注</td><td style="padding:8px;">' + note + '</td></tr>' : '')
    + '</table>'
    + '<p style="color:#718096;font-size:12px;margin-top:24px;">请登录管理后台确认付款并安排发货：<a href="https://rsdgun-shop.pages.dev/admin/">https://rsdgun-shop.pages.dev/admin/</a></p>'
    + '</body></html>';

  const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: NOTIFY_EMAIL }] }],
      from: { email: 'orders@rsdgun-shop.pages.dev', name: 'RSD订单通知' },
      subject,
      content: [{ type: 'text/html', value: html }],
    })
  });

  if (resp.status >= 400) {
    const text = await resp.text();
    throw new Error('sendEmail failed: ' + resp.status + ' ' + text);
  }
  return resp;
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const body = await request.json();
    const { orderId, productName, total, customer, voucherB64 } = body;

    // 1. 发邮件
    let emailOk = false;
    try {
      await sendEmail(orderId, productName, total, customer);
      emailOk = true;
    } catch (e) { console.error('Email send failed:', e.message); }

    // 2. 发飞书
    const feishuToken = await getToken();
    const cardElements = [
      { tag: 'div', text: { tag: 'lark_md', content: '**☎️ 新订单通知**' } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: '**订单编号：** ' + orderId } },
      { tag: 'div', text: { tag: 'lark_md', content: '**商品：** ' + (productName || '') } },
      { tag: 'div', text: { tag: 'lark_md', content: '**金额：** \u00a5' + (total || 0).toFixed(2) } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: '**收货人：** ' + (customer ? customer.name : '') } },
      { tag: 'div', text: { tag: 'lark_md', content: '**手机号：** ' + (customer ? customer.phone : '') } },
      { tag: 'div', text: { tag: 'lark_md', content: '**地址：** ' + (customer ? customer.address : '') } },
    ];
    if (customer && customer.note) {
      cardElements.push({ tag: 'div', text: { tag: 'lark_md', content: '**备注：** ' + customer.note } });
    }
    if (voucherB64 && voucherB64.length > 100) {
      try {
        const imageKey = await uploadImage(feishuToken, voucherB64);
        cardElements.push({ tag: 'hr' });
        cardElements.push({ tag: 'div', text: { tag: 'lark_md', content: '**支付凭证：**' } });
        cardElements.push({ tag: 'img', img_key: imageKey, alt: { tag: 'plain_text', content: '支付凭证' } });
      } catch (e) { /* image upload failed */ }
    }
    await sendFeishuMessage(feishuToken, CHAT_ID, {
      header: { title: { tag: 'plain_text', content: '🛒 新订单通知' }, template: 'red' },
      elements: cardElements
    });

    return new Response(JSON.stringify({ success: true, email_sent: emailOk }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
