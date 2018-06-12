import Koa = require('koa')
import KoaRouter = require('koa-router')
import koaStatic = require('koa-static')
import bodyParser = require('koa-bodyparser')
import Checkstand = require('../src')

const api = new Checkstand({
  client_id: '填入你的 client_id',
  client_secret: '填入你的 client_secret',
  kdt_id: '填入你的 kdt_id'
})

const app = new Koa()

app.use(koaStatic(__dirname + '/static'))

const router = new KoaRouter()

const orders: {
  [qid: string]: any
} = {}

// 创建动态收款二维码
router.get('/qr', async (ctx, next) => {
  const qrInfo = await api.createQR({
    price: Number(ctx.query.price),
    name: '测试有赞收银台'
  })

  orders[qrInfo.qr_id] = qrInfo

  ctx.body = qrInfo

  return next()
})

// 获取二维码的支付状态
router.get('/qr/:id/status', async (ctx, next) => {
  const order = orders[ctx.params.id]
  if (order) {
    ctx.body = order.status
  } else {
    ctx.status = 404
  }
  return next()
})

// 判断某个 qr 是否已经被支付了
router.get('/qr/:id/paid', async (ctx, next) => {
  ctx.body = await api.isPaid(ctx.params.id)
  return next()
})

// 通过有赞的推送接口更新订单的状态
router.post('/', bodyParser(), async (ctx, next) => {
  ctx.body = { code: 0, msg: 'success' }
  next()
  console.log(ctx.request.body)
  const orderInfo = await api.getPushStatus(ctx.request.body)
  if (orderInfo) {
    orders[orderInfo.qr_id].status = orderInfo.status
  }
})

app.use(router.routes())

app.listen(2727)
