/**
 * 主应用逻辑 - 纯静态版
 * 订单通过飞书 Webhook 通知
 */

let currentProduct = null;
let selectedSpec = null;

const $ = id => document.getElementById(id);
const productGrid = $("product-grid");
const productsSection = $("products-section");
const orderSection = $("order-section");
const orderProductInfo = $("order-product-info");
const orderProductGallery = $("order-product-gallery");
const orderSpec = $("order-spec");
const orderQty = $("order-qty");
const orderTotalPrice = $("order-total-price");
const orderName = $("order-name");
const orderPhone = $("order-phone");
const orderAddress = $("order-address");
const orderNote = $("order-note");
const backBtn = $("back-btn");
const submitOrderBtn = $("submit-order-btn");
const paymentModal = $("payment-modal");
const payAmount = $("pay-amount");
const qrContainer = $("qrcode-container");
const payName = $("pay-name");
const payPhone = $("pay-phone");
const payAddress = $("pay-address");
const payNote = $("pay-note");
const confirmPayBtn = $("confirm-pay-btn");
const successModal = $("success-modal");
const continueBtn = $("continue-shopping-btn");
const modalClose = document.querySelector(".modal-close");

// ========== 飞书 Webhook ==========
// 后台设置后自动从 localStorage 读取
function getWebhookUrl() {
  try {
    const cfg = JSON.parse(localStorage.getItem("shop_config") || "{}");
    return cfg.feishuWebhook || "";
  } catch(e) { return ""; }
}

// ========== 工具函数 ==========
function formatPrice(p) { return "¥" + p.toFixed(2); }
function genOrderId() {
  const n = new Date();
  return "ORD" + n.getFullYear()
    + String(n.getMonth()+1).padStart(2,"0")
    + String(n.getDate()).padStart(2,"0")
    + String(n.getHours()).padStart(2,"0")
    + String(n.getMinutes()).padStart(2,"0")
    + String(n.getSeconds()).padStart(2,"0")
    + Math.floor(Math.random()*10000).toString().padStart(4,"0");
}
function getPrice() {
  if (!currentProduct) return 0;
  if (currentProduct.specs && selectedSpec) return selectedSpec.price;
  return currentProduct.price || 0;
}
function getTotal() { return getPrice() * (parseInt(orderQty.value) || 1); }

// ========== 渲染商品 ==========
function renderProductGrid(items) {
  productGrid.innerHTML = items.map(item => {
    let dp = item.price;
    if (item.specs && item.specs.length > 0) {
      const ps = item.specs.map(s => s.price).sort((a,b)=>a-b);
      dp = ps.length > 1 ? ps[0] + " ~ " + ps[ps.length-1] : ps[0];
    }
    const ph = typeof dp === "string" ? "¥" + dp : formatPrice(dp);
    return `<div class="product-card" data-id="${item.id}">
      <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%23e2e8f0%22 width=%22400%22 height=%22300%22/><text x=%22150%22 y=%22150%22 fill=%22%2364748b%22 font-size=%2216%22>暂无图片</text></svg>'">
      <div class="product-info">
        <h3>${item.name}</h3>
        <p class="product-desc">${(item.description||"").replace(/\n/g," ").substring(0,80)}${item.description&&item.description.length>80?"...":""}</p>
        <div class="product-meta">
          <span class="product-price">${ph}</span>
          <span class="product-stock">${item.stock>0?`<span class="in-stock">库存 ${item.stock}</span>`:`<span class="out-of-stock">已售罄</span>`}</span>
        </div>
      </div>
    </div>`;
  }).join("");
  document.querySelectorAll(".product-card").forEach(c => {
    c.addEventListener("click", () => showOrderPage(parseInt(c.dataset.id)));
  });
}

// ========== 下单页面 ==========
function showOrderPage(id) {
  const product = Products.getItem(id);
  if (!product) return alert("商品不存在");
  currentProduct = product;
  selectedSpec = product.specs ? product.specs[product.defaultSpec||0] : null;
  productsSection.classList.add("hidden");
  orderSection.classList.remove("hidden");

  orderProductInfo.innerHTML = `<div class="info"><h3>${product.name}</h3><p class="price">${formatPrice(getPrice())}</p><div class="desc">${(product.description||"").replace(/\n/g,"<br>")}</div></div>`;

  if (product.images && product.images.length > 0) {
    orderProductGallery.innerHTML = product.images.map(img =>
      `<img src="${img}" alt="" loading="lazy" onerror="this.style.display='none'">`
    ).join("");
    orderProductGallery.classList.remove("hidden");
  } else { orderProductGallery.classList.add("hidden"); }

  if (product.specs && product.specs.length > 0) {
    orderSpec.classList.remove("hidden");
    orderSpec.innerHTML = `<h4>选择规格</h4><div class="spec-options">${
      product.specs.map((s,i) =>
        `<button class="spec-btn ${i===(product.defaultSpec||0)?"active":""}" data-index="${i}">
          <span class="spec-name">${s.name}</span>
          <span class="spec-price">${formatPrice(s.price)}</span>
        </button>`
      ).join("")
    }</div>`;
    document.querySelectorAll(".spec-btn").forEach(b => {
      b.addEventListener("click", () => {
        document.querySelectorAll(".spec-btn").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        selectedSpec = product.specs[parseInt(b.dataset.index)];
        updateDisplay();
      });
    });
  } else { orderSpec.classList.add("hidden"); }

  const ef = document.querySelector(".product-features");
  if (ef) ef.remove();
  if (product.features && product.features.length > 0) {
    document.querySelector(".order-form").insertAdjacentHTML("beforebegin",
      `<div class="product-features"><h4>商品特点</h4><ul>${
        product.features.map(f => `<li>${f}</li>`).join("")
      }</ul></div>`);
  }

  orderQty.value = 1;
  orderName.value = orderPhone.value = orderAddress.value = orderNote.value = "";
  updateDisplay();
  window.scrollTo({top:0,behavior:"smooth"});
}

function updateDisplay() {
  const p = getPrice();
  const el = document.querySelector("#order-product-info .price");
  if (el) el.textContent = formatPrice(p);
  orderTotalPrice.textContent = formatPrice(getTotal());
}

orderQty.addEventListener("input", updateDisplay);
backBtn.addEventListener("click", () => {
  orderSection.classList.add("hidden");
  productsSection.classList.remove("hidden");
  currentProduct = null; selectedSpec = null;
  window.scrollTo({top:0,behavior:"smooth"});
});

// ========== 提交订单 ==========
submitOrderBtn.addEventListener("click", () => {
  const name = orderName.value.trim(), phone = orderPhone.value.trim(), address = orderAddress.value.trim();
  if (!name||!phone||!address) return alert("请填写完整的收货信息（姓名、手机号、地址）");
  if (!/^1\d{10}$/.test(phone)) return alert("请输入正确的手机号（11位数字）");

  const total = getTotal();
  payAmount.textContent = formatPrice(total);
  payName.value = name; payPhone.value = phone; payAddress.value = address; payNote.value = orderNote.value.trim();

  const img = document.createElement("img");
  img.src = "qrcodes/wechat.png";
  img.alt = "支付二维码";
  img.style.width = "260px"; img.style.height = "260px";
  img.onerror = function() {
    this.style.display = "none";
    const h = document.createElement("div");
    h.className = "payment-hint"; h.style.color = "#ef4444";
    h.textContent = "⚠️ 收款码加载失败，请联系店主";
    qrContainer.appendChild(h);
  };
  qrContainer.innerHTML = ""; qrContainer.appendChild(img);
  paymentModal.classList.remove("hidden");
});

confirmPayBtn.addEventListener("click", async () => {
  const name = payName.value.trim(), phone = payPhone.value.trim(), address = payAddress.value.trim();
  if (!name||!phone||!address) return alert("请填写完整的收货信息");
  if (!/^1\d{10}$/.test(phone)) return alert("请输入正确的手机号");

  const total = getTotal();
  const specName = selectedSpec ? selectedSpec.name : "";
  const orderId = genOrderId();

  confirmPayBtn.disabled = true; confirmPayBtn.textContent = "提交中...";

  // 存本地
  const orderData = {
    orderId,
    productName: currentProduct.name + (specName ? " (" + specName + ")" : ""),
    total,
    customer: { name, phone, address, note: payNote.value.trim() },
    payMethod: "wechat",
    createdAt: new Date().toISOString()
  };
  try {
    const orders = JSON.parse(localStorage.getItem("shop_orders")||"[]");
    orders.unshift(orderData);
    localStorage.setItem("shop_orders", JSON.stringify(orders));
  } catch(e) {}

  // 飞书通知
  const webhook = getWebhookUrl();
  if (webhook) {
    try {
      await fetch(webhook, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          msg_type:"interactive",
          card: {
            header: { title: { tag:"plain_text", content:"🛒 新订单通知" }, template:"red" },
            elements: [
              { tag:"div", text:{ tag:"lark_md", content:`**订单编号：** ${orderId}` }},
              { tag:"div", text:{ tag:"lark_md", content:`**商品：** ${orderData.productName}` }},
              { tag:"div", text:{ tag:"lark_md", content:`**金额：** ¥${total.toFixed(2)}` }},
              { tag:"hr" },
              { tag:"div", text:{ tag:"lark_md", content:`**收货人：** ${name}` }},
              { tag:"div", text:{ tag:"lark_md", content:`**手机号：** ${phone}` }},
              { tag:"div", text:{ tag:"lark_md", content:`**地址：** ${address}` }},
              ...(payNote.value.trim() ? [{ tag:"div", text:{ tag:"lark_md", content:`**备注：** ${payNote.value.trim()}` }}] : []),
            ]
          }
        })
      });
    } catch(e) { console.error("飞书通知失败", e); }
  }

  paymentModal.classList.add("hidden");
  confirmPayBtn.disabled = false; confirmPayBtn.textContent = "我已支付，提交订单";
  orderSection.classList.add("hidden");
  productsSection.classList.remove("hidden");
  currentProduct = null; selectedSpec = null;
  successModal.classList.remove("hidden");
});

// ========== 弹窗 ==========
modalClose.addEventListener("click", () => paymentModal.classList.add("hidden"));
paymentModal.addEventListener("click", e => { if (e.target === paymentModal) paymentModal.classList.add("hidden"); });
successModal.addEventListener("click", e => { if (e.target === successModal) successModal.classList.add("hidden"); });
continueBtn.addEventListener("click", () => { successModal.classList.add("hidden"); window.scrollTo({top:0,behavior:"smooth"}); });

// ========== 初始化 ==========
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await Products.load();
    renderProductGrid(data.items);
  } catch(e) {
    productGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light);"><p>⚠️ 加载商品数据失败</p></div>`;
  }
  // 显示已存订单数
  try {
    const orders = JSON.parse(localStorage.getItem("shop_orders")||"[]");
    if (orders.length > 0) console.log("📦 本地订单:", orders.length);
  } catch(e) {}
});
