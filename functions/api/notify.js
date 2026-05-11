// Cloudflare Pages Function - 飞书订单通知
// 使用飞书 API 发送带图片的卡片消息到指定群

const APP_ID = 'cli_a96d2a7b7fb85cdb';
const APP_SECRET = 'M2WltwlGbPLNvDppZ1wG8gujxWGuLPcJ';
const CHAT_ID = 'oc_5c593909bec52ce8c5f287f83b77581d';

// 获取 tenant_access_token
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

// 上传图片到飞书
async function uploadImage(token, base64Data) {
  // base64Data 格式: data:image/png;base64,xxxx
  // 需要去掉前缀
  const commaIdx = base64Data.indexOf(',');
  const rawBase64 = commaIdx > -1 ? base64Data.substring(commaIdx + 1) : base64Data;
  
  // 飞书上传图片 API 接受 multipart/form-data
  // 由于 Pages Function 环境限制，用 base64 直接上传
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

// 发消息到群
async function sendMessage(token, chatId, content) {
  const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(content)
    })
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error('sendMessage failed: ' + data.msg);
  return data;
}

export async function onRequest(context) {
  const { request } = context;

  // CORS preflight
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

    // 获取 token
    const token = await getToken();

    // 构建卡片内容（不含图片）
    const cardElements = [
      { tag: 'div', text: { tag: 'lark_md', content: '**\u260e\ufe0f \u65b0\u8ba2\u5355\u901a\u77e5**' } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: '**\u8ba2\u5355\u7f16\u53f7\uff1a** ' + orderId } },
      { tag: 'div', text: { tag: 'lark_md', content: '**\u5546\u54c1\uff1a** ' + (productName || '') } },
      { tag: 'div', text: { tag: 'lark_md', content: '**\u91d1\u989d\uff1a** \u00a5' + (total || 0).toFixed(2) } },
      { tag: 'hr' },
      { tag: 'div', text: { tag: 'lark_md', content: '**\u6536\u8d27\u4eba\uff1a** ' + (customer ? customer.name : '') } },
      { tag: 'div', text: { tag: 'lark_md', content: '**\u624b\u673a\u53f7\uff1a** ' + (customer ? customer.phone : '') } },
      { tag: 'div', text: { tag: 'lark_md', content: '**\u5730\u5740\uff1a** ' + (customer ? customer.address : '') } },
    ];

    if (customer && customer.note) {
      cardElements.push({ tag: 'div', text: { tag: 'lark_md', content: '**\u5907\u6ce8\uff1a** ' + customer.note } });
    }

    // 如果有支付截图，上传到飞书并插入图片
    if (voucherB64 && voucherB64.length > 100) {
      try {
        const imageKey = await uploadImage(token, voucherB64);
        cardElements.push({ tag: 'hr' });
        cardElements.push({ tag: 'div', text: { tag: 'lark_md', content: '**\u652f\u4ed8\u51ed\u8bc1\uff1a**' } });
        cardElements.push({
          tag: 'img',
          img_key: imageKey,
          alt: { tag: 'plain_text', content: '\u652f\u4ed8\u51ed\u8bc1' }
        });
      } catch (e) {
        // 图片上传失败不影响订单通知
        cardElements.push({ tag: 'hr' });
        cardElements.push({ tag: 'div', text: { tag: 'lark_md', content: '\u652f\u4ed8\u51ed\u8bc1\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u8054\u7cfb\u4e70\u5bb6' } });
      }
    }

    const card = {
      header: {
        title: { tag: 'plain_text', content: '\ud83d\uded2 \u65b0\u8ba2\u5355\u901a\u77e5' },
        template: 'red'
      },
      elements: cardElements
    };

    await sendMessage(token, CHAT_ID, card);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
