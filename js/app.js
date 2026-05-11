/**
 * 主应用逻辑 - 纯静态版
 * v2 - 支付码嵌入下单页 + 上传支付截图 + 飞书通知
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
const payAmountDisplay = $("pay-amount-display");
const payVoucher = $("pay-voucher");
const voucherPreview = $("voucher-preview");
const voucherImg = $("voucher-img");
const removeVoucher = $("remove-voucher");
const successModal = $("success-modal");
const orderIdDisplay = $("order-id-display");
const continueBtn = $("continue-shopping-btn");

// ========== 飞书 Webhook ==========
function getWebhookUrl() {
  try {
    const cfg = JSON.parse(localStorage.getItem("shop_config") || "{}");
    return cfg.feishuWebhook || "";
  } catch(e) { return ""; }
}

// ========== 工具函数 ==========
function formatPrice(p) { return "\u00a5" + p.toFixed(2); }
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
    const ph = typeof dp === "string" ? "\u00a5" + dp : formatPrice(dp);
    return `<div class="product-card" data-id="${item.id}">
      <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%2523e2e8f0%22 width=%22400%22 height=%22300%22/><text x=%22150%22 y=%22150%22 fill=%22%252364748b%22 font-size=%2216%22>\u6682\u65e0\u56fe\u7247</text></svg>'">
      <div class="product-info">
        <h3>${item.name}</h3>
        <p class="product-desc">${(item.description||"").replace(/\n/g," ").substring(0,80)}${item.description&&item.description.length>80?"...":""}</p>
        <div class="product-meta">
          <span class="product-price">${ph}</span>
          <span class="product-stock">${item.stock>0?`<span class="in-stock">\u5e93\u5b58 ${item.stock}</span>`:`<span class="out-of-stock">\u5df2\u552e\u7f44</span>`}</span>
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
  if (!product) return alert("\u5546\u54c1\u4e0d\u5b58\u5728");
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
    orderSpec.innerHTML = `<h4>\u9009\u62e9\u89c4\u683c</h4><div class="spec-options">${
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
      `<div class="product-features"><h4>\u5546\u54c1\u7279\u70b9</h4><ul>${
        product.features.map(f => `<li>${f}</li>`).join("")
      }</ul></div>`);
  }

  orderQty.value = 1;
  orderName.value = orderPhone.value = orderAddress.value = orderNote.value = "";
  // 清除支付凭证
  if (payVoucher) payVoucher.value = "";
  if (voucherPreview) voucherPreview.classList.add("hidden");
  updateDisplay();
  window.scrollTo({top:0,behavior:"smooth"});
}

function updateDisplay() {
  const p = getPrice();
  const el = document.querySelector("#order-product-info .price");
  if (el) el.textContent = formatPrice(p);
  orderTotalPrice.textContent = formatPrice(getTotal());
  if (payAmountDisplay) payAmountDisplay.textContent = formatPrice(getTotal());
}

orderQty.addEventListener("input", updateDisplay);
backBtn.addEventListener("click", () => {
  orderSection.classList.add("hidden");
  productsSection.classList.remove("hidden");
  currentProduct = null; selectedSpec = null;
  window.scrollTo({top:0,behavior:"smooth"});
});

// ========== 文件上传预览 ==========
payVoucher.addEventListener("change", function() {
  if (this.files && this.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      voucherImg.src = e.target.result;
      voucherPreview.classList.remove("hidden");
    };
    reader.readAsDataURL(this.files[0]);
  }
});

removeVoucher.addEventListener("click", function() {
  payVoucher.value = "";
  voucherPreview.classList.add("hidden");
  voucherImg.src = "";
});

// ========== 提交订单 ==========
submitOrderBtn.addEventListener("click", async () => {
  const name = orderName.value.trim(), phone = orderPhone.value.trim(), address = orderAddress.value.trim();
  if (!name||!phone||!address) return alert("\u8bf7\u586b\u5199\u5b8c\u6574\u7684\u6536\u8d27\u4fe1\u606f\uff08\u59d3\u540d\u3001\u624b\u673a\u53f7\u3001\u5730\u5740\uff09");
  if (!/^1[0-9]{10}$/.test(phone)) return alert("\u8bf7\u8f93\u5165\u6b63\u786e\u7684\u624b\u673a\u53f7\uff0811\u4f4d\u6570\u5b57\uff09");

  // \u68c0\u67e5\u662f\u5426\u4e0a\u4f20\u4e86\u652f\u4ed8\u51ed\u8bc1
  if (!payVoucher.files || !payVoucher.files[0]) {
    return alert("\u8bf7\u5148\u4e0a\u4f20\u652f\u4ed8\u51ed\u8bc1\uff08\u622a\u56fe\uff09");
  }

  const total = getTotal();
  const specName = selectedSpec ? selectedSpec.name : "";
  const orderId = genOrderId();

  submitOrderBtn.disabled = true;
  submitOrderBtn.textContent = "\u63d0\u4ea4\u4e2d...";

  // \u5b58\u672c\u5730
  const orderData = {
    orderId,
    productName: currentProduct.name + (specName ? " (" + specName + ")" : ""),
    total,
    customer: { name, phone, address, note: orderNote.value.trim() },
    payMethod: "wechat",
    createdAt: new Date().toISOString()
  };
  try {
    const orders = JSON.parse(localStorage.getItem("shop_orders")||"[]");
    orders.unshift(orderData);
    localStorage.setItem("shop_orders", JSON.stringify(orders));
  } catch(e) {}

  // \u8bfb\u53d6\u652f\u4ed8\u51ed\u8bc1\u56fe\u7247\uff08base64\uff09
  let voucherB64 = "";
  try {
    voucherB64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(payVoucher.files[0]);
    });
  } catch(e) { voucherB64 = ""; }

  try {
    await fetch("/api/notify", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        orderId: orderId,
        productName: orderData.productName,
        total: total,
        customer: orderData.customer,
        voucherB64: voucherB64
      })
    });
  } catch(e) { /* notify error, non-blocking */ }

  // \u663e\u793a\u6210\u529f\u5f39\u7a97
  orderIdDisplay.textContent = orderId;
  orderSection.classList.add("hidden");
  successModal.classList.remove("hidden");
  currentProduct = null; selectedSpec = null;
  submitOrderBtn.disabled = false;
  submitOrderBtn.textContent = "\u63d0\u4ea4\u8ba2\u5355";
});

// ========== \u5f39\u7a97 ==========
successModal.addEventListener("click", e => { if (e.target === successModal) successModal.classList.add("hidden"); });
continueBtn.addEventListener("click", () => {
  successModal.classList.add("hidden");
  productsSection.classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
});

// ========== \u521d\u59cb\u5316 ==========
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await Products.load();
    renderProductGrid(data.items);
  } catch(e) {
    productGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light);"><p>\u26a0\ufe0f \u52a0\u8f7d\u5546\u54c1\u6570\u636e\u5931\u8d25</p></div>`;
  }
  try {
    const orders = JSON.parse(localStorage.getItem("shop_orders")||"[]");
    if (orders.length > 0) console.log("\ud83d\udce6 \u672c\u5730\u8ba2\u5355:", orders.length);
  } catch(e) {}
});
