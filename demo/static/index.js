var cid
var price = document.getElementById('price')
var img = document.getElementById('img')
var statusSpan = document.getElementById('status')

function create() {
  var xhr = new XMLHttpRequest()
  xhr.open('get', '/qr?price=' + price.value)
  xhr.responseType = 'json'
  xhr.addEventListener('readystatechange', function() {
    if (xhr.readyState === 4) {
      console.log(xhr.response)
      cid = xhr.response.qr_id
      img.src = xhr.response.qr_code
      statusSpan.textContent = '用户未扫码'
      stopLoop()
      startLoop()
    }
  })
  xhr.send()
}

function query() {
  if (!cid) return
  var xhr = new XMLHttpRequest()
  xhr.open('get', '/qr/' + cid + '/paid')
  xhr.responseType = 'json'
  xhr.addEventListener('readystatechange', function() {
    if (xhr.readyState === 4) {
      alert(xhr.response ? '是' : '否')
    }
  })
  xhr.send()
}

var timeid
function startLoop() {
  timeid = setTimeout(function() {
    var xhr = new XMLHttpRequest()
    xhr.open('get', '/qr/' + cid + '/status')
    xhr.addEventListener('readystatechange', function() {
      if (xhr.readyState === 4) {
        if (xhr.responseText === 'TRADE_SUCCESS') {
          statusSpan.textContent = '用户已支付'
        } else {
          if (xhr.responseText === 'WAIT_BUYER_PAY') {
            statusSpan.textContent = '用户已扫码，等待用户支付'
          }
          startLoop()
        }
      }
    })
    xhr.send()
  }, 500)
}

function stopLoop() {
  clearTimeout(timeid)
}
