# Checkstand

写给 Node.js 应用的有赞二维码支付工具，关于有赞二维码支付的详细介绍请阅读[个人网站即时到账收款解决方案](https://blog.xu42.cn/2017/11/26/person-website-instant-payment-solution/)。

## 安装

```
yarn add yz-checkstand
```

## 使用

首先实例化一个对象：

```js
const Checkstand = require('yz-checkstand')
const checkstand = new Checkstand({
  client_id: '应用的 client_id',
  client_secret: '应用的 client_secret',
  kdt_id: '应用的授权店铺 id'
})
```

接下来，你可以调用 `createQR()` 方法创建一个动态二维码：

```js
const qr = await checkstand.createQR({
  price: 100, // 金额，单位：元
  name: '测试有赞接口' // 收款理由
})
```

上面的 `qr` 就是 [youzan.pay.qrcode.create](https://www.youzanyun.com/apilist/detail/group_trade/pay_qrcode/youzan.pay.qrcode.create) 的响应参数。

创建二维码之后，你可以使用 `isPaid()` 方法主动检查用户是否已经付款：

```js
const paid = await checkstand.isPaid(qr.qr_id)
if (paid) {
  console.log('已支付')
} else {
  console.log('未支付')
}
```

或者，你可以通过将有赞的消息推送数据传给 `getPushStatus()` 方法获取此次推送的二维码信息：

```js
const KoaRouter = require('koa-router')
const bodyParser = require('koa-bodyparser')
const router = new KoaRouter()

router.post('/youzan-push', bodyParser(), async (ctx, next) => {
  ctx.body = { code: 0, msg: 'success' }
  next()

  const orderInfo = await checkstand.getPushStatus(ctx.request.body)
  if (orderInfo) {
    // ...
  }
})
```

`orderInfo` 是下面的对象：

```js
{
  "qr_id": "12321", // 此次交易信息关联的二维码 id
  "status": "TRADE_SUCCESS", // 交易状态
  "raw": { ... } // youzan.trade.get 接口的响应参数
}
```

`getPushStatus()` 方法只会处理[订单状态事件](https://www.youzanyun.com/docs/guide/3401/3455)中的 `WAIT_BUYER_PAY`（买家已扫码，等待付款）和 `TRADE_SUCCESS`（买家已付款）状态。如果你只关心 `TRADE_SUCCESS` 状态，可以在调用方法时给第二个参数传一个 `true`：`checkstand.getPushStatus(ctx.request.body, true)`。

其余情况下，`orderInfo` 会是 `undefined`。

### 其它方法

除了上面介绍的常用方法，`checkstand` 还有这些方法：

#### checkstand.ensureToken()

返回一个 Promise，值是下面的一个对象：

```js
{
  "access_token": "2df2df2232df32", // 用于调用有赞接口的 token
  "expires_in": 3213123322000, // token 过期时间，单位：毫秒
  "create_at": 231232323123000, // token 创建时间
  "scope": "trade order ..." // token 作用域
}
```

Checkstand 会在 token 过期时自动更新 token，所以无需担心内部细节。

#### checkstand.callAPI(options)

调用有赞接口的便捷方法。例如，如果要调用 [youzan.trade.get](https://www.youzanyun.com/apilist/detail/group_trade/trade/youzan.trade.get) 接口，可以这样写：

```js
checkstand.callAPI({
  name: 'youzan.trade',
  method: 'get',
  params: {
    tid: '123123'
  }
}).then(response => ...)
```

调用接口时，`callAPI()` 方法会自动带上 access_token。

## 在本地测试有赞接口

如果你有一个有赞应用，你可以在本地运行 [demo](demo/index.ts) 测试是否能正常支付：

1. Clone 项目到本地
2. 安装依赖：`yarn` 或 `npm i`
3. 修改 [demo/index.ts](demo/index.ts) 中的有赞应用信息
4. 启动应用：`yarn start` 或 `npm start`
5. 启动反向代理：`yarn rp` 或 `npm run rp`，并将有赞应用的消息推送网址设为反代服务器的地址
6. 打开 http://localhost:2727

## 许可

MIT
