import { get, request } from 'https'
import { IncomingMessage } from 'http'
import { stringify } from 'querystring'

interface AuthParams {
  client_id: string
  client_secret: string
  kdt_id: string
}

interface AccessData {
  access_token: string
  expires_in: number
  craete_at: number
}

interface QRData {
  qr_id: string
  qr_url: string
  qr_code: string
}

// https://www.youzanyun.com/docs/guide/3401/3455
interface YouZanBody {
  /**
   * 是否健康检查
   */
  test: boolean
  /**
   * 交易消息的类型
   */
  type: string
  /**
   * 交易信息，可以通过 JOSN.parse 解析为 YouZanTradeMsg 类型
   */
  msg: string
}

interface YouZanTradeMsg {
  /**
   * 订单号
   */
  tid: string
  /**
   * 订单状态
   */
  status: string
}

function isTokenExpired(token: AccessData) {
  return Date.now() - token.craete_at >= token.expires_in
}

function response2Data(res: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = ''
    res.setEncoding('utf8')
    res.on('error', reject)
    res.on('data', chunk => {
      data += chunk
    })
    res.on('end', () => {
      resolve(JSON.parse(data))
    })
  })
}

const TradeStatus = ['WAIT_BUYER_PAY', 'TRADE_SUCCESS']

export = class Checkstand {
  private _auth: AuthParams
  private _token: AccessData | null
  constructor(options: AuthParams) {
    this._auth = options
    this._token = null
  }

  // https://www.youzanyun.com/docs/guide/3399/3414
  private _getToken() {
    return new Promise<AccessData>((resolve, reject) => {
      const createAt = Date.now()
      const req = request(
        {
          hostname: 'open.youzan.com',
          path: '/oauth/token',
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        },
        res => {
          response2Data(res).then((accessData: AccessData) => {
            accessData.craete_at = createAt
            // 统一转换为毫秒
            accessData.expires_in = accessData.expires_in * 1000
            this._token = accessData
            resolve(accessData)
          }, reject)
        }
      )

      req.on('error', reject)

      req.end(stringify(Object.assign({ grant_type: 'silent' }, this._auth)))
    })
  }

  ensureToken() {
    const { _token } = this
    if (!_token || isTokenExpired(_token)) {
      this._token = null
      return this._getToken()
    }
    return Promise.resolve(_token)
  }

  /**
   * 调用有赞 API
   */
  callAPI(api: string, params?: object | null, version = '3.0.0') {
    return this.ensureToken().then(token => {
      const lastDotIndex = api.lastIndexOf('.')
      const apiName = api.slice(0, lastDotIndex)
      const apiMethod = api.slice(lastDotIndex + 1)
      return new Promise<any>((resolve, reject) => {
        const req = get(
          `https://open.youzan.com/api/oauthentry/${apiName}/${version}/${apiMethod}?${stringify(
            Object.assign(
              {
                access_token: token.access_token
              },
              params
            )
          )}`,
          res => {
            response2Data(res).then(data => resolve(data.response), reject)
          }
        )
        req.on('error', reject)
      })
    })
  }

  /**
   * 创建动态付款二维码
   * @see https://www.youzanyun.com/apilist/detail/group_trade/pay_qrcode/youzan.pay.qrcode.create
   */
  createQR(price: number, reason?: string): Promise<QRData> {
    return this.callAPI('youzan.pay.qrcode.create', {
      qr_price: price * 100,
      qr_name: reason || `收款 ${price} 元`,
      qr_type: 'QR_TYPE_DYNAMIC'
    })
  }

  /**
   * 根据 qr id 判断扫描此二维码的用户是否已付款
   * @see https://www.youzanyun.com/apilist/detail/group_trade/pay_qrcode/youzan.trades.qr.get
   */
  isPaid(qrId: string | number) {
    return this.callAPI('youzan.trades.qr.get', {
      qr_id: qrId,
      status: 'TRADE_RECEIVED'
    }).then(data => data.total_results > 0)
  }

  /**
   * 根据有赞的推送消息获取此订单的二维码付款状态
   */
  getPushStatus(orderData: YouZanBody, successOnly?: boolean) {
    if (orderData.test || orderData.type !== 'TRADE_ORDER_STATE') {
      return Promise.resolve()
    }
    const tradeMsg: YouZanTradeMsg = JSON.parse(
      decodeURIComponent(orderData.msg)
    )
    if (
      successOnly
        ? tradeMsg.status !== TradeStatus[1]
        : TradeStatus.indexOf(tradeMsg.status) < 0
    ) {
      return Promise.resolve()
    }

    return this.callAPI('youzan.trade.get', {
      tid: tradeMsg.tid
    }).then(data => ({
      qr_id: data.trade.qr_id as number,
      status: tradeMsg.status,
      raw: data.trade
    }))
  }
}
