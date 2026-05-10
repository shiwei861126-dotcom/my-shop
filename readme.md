# 我的小店 - 在线商品展示 & 下单网站

## 快速启动

```bash
# 启动本地服务器（在 shop-site 目录下）
python -m http.server 8080
```

打开浏览器访问：http://localhost:8080

## 目录结构

```
shop-site/
├── index.html         # 商店首页
├── admin.html         # 订单管理后台
├── css/
│   └── style.css      # 样式
├── js/
│   ├── products.js    # 商品数据加载
│   └── app.js         # 主逻辑
├── data/
│   └── products.json  # 商品数据（修改这里上架商品）
└── qrcodes/
    ├── wechat.png     # 微信收款码（替换为你的图片）
    └── alipay.png     # 支付宝收款码（替换为你的图片）
```

## 使用指南

### 1️⃣ 上架商品
编辑 `data/products.json`，每个商品包含：
- `id` - 唯一编号
- `name` - 商品名称
- `description` - 商品描述
- `price` - 价格（数字）
- `image` - 商品图片 URL
- `stock` - 库存数量

### 2️⃣ 配置收款码
将你的**微信收款码**和**支付宝收款码**图片分别放到：
- `qrcodes/wechat.png`
- `qrcodes/alipay.png`

### 3️⃣ 配置飞书通知（可选）
编辑 `js/app.js`，找到 `FEISHU_WEBHOOK_URL`，填入你的飞书机器人 webhook 地址：
```js
const FEISHU_WEBHOOK_URL = 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx';
```
这样用户下单后你会立即收到飞书消息通知。

### 4️⃣ 查看订单
访问 `http://localhost:8080/admin.html` 查看所有订单记录。

## 用户下单流程

1. 浏览商品 → 点击商品卡片
2. 填写数量 + 收货信息 → 提交订单
3. 弹出支付二维码 → 扫码付款
4. 填好地址 → 确认提交
5. ✅ 订单完成，你会收到飞书通知
