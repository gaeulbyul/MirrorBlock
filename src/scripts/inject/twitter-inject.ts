namespace MirrorBlockInject.API {
  const { requestAPI } = MirrorBlock.APICommon

  export async function handleMessage({
    method,
    path,
    params,
    nonce,
  }: Messaging.RequestAPIMessage) {
    const response = await requestAPI(method, path, params)
    const detail = { response }
    const customEvent = new CustomEvent(`TwitterAPI->[nonce:${nonce}]`, {
      detail,
    })
    document.dispatchEvent(customEvent)
  }
}

namespace MirrorBlockInject.Messaging {
  export interface RequestAPIMessage {
    '>_< mirrorblock': 'requestAPI'
    method: HTTPMethods
    path: string
    params: URLParamsObj
    nonce: string
  }
  function isRequestAPIMessage(msg: any): msg is RequestAPIMessage {
    if (!(msg && typeof msg === 'object')) {
      return false
    }
    return msg['>_< mirrorblock'] === 'requestAPI'
  }
  export function initialize(): void {
    window.addEventListener('message', async event => {
      const message = event.data
      if (!isRequestAPIMessage(message)) {
        return
      }
      MirrorBlockInject.API.handleMessage(message)
    })
  }
}

if (location.hostname !== 'twitter.com') {
  console.info(
    '[Mirror Block] using dom-event-proxy mechanism for avoid CORB problem'
  )
  MirrorBlockInject.Messaging.initialize()
}
