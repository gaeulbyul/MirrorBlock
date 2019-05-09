namespace MirrorBlockInject.API {
  const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

  export class APIError extends Error {
    constructor(public readonly response: any) {
      super('Received non-OK response from Twitter API')
      Object.setPrototypeOf(this, new.target.prototype)
    }
  }

  function generateTwitterAPIOptions(obj?: RequestInit): RequestInit {
    let csrfToken: string
    const match = /\bct0=([0-9a-f]{32})\b/.exec(document.cookie)
    if (match && match[1]) {
      csrfToken = match[1]
    } else {
      throw new Error('Failed to get CSRF token.')
    }
    const headers = new Headers()
    headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
    headers.set('x-csrf-token', csrfToken)
    headers.set('x-twitter-active-user', 'yes')
    headers.set('x-twitter-auth-type', 'OAuth2Session')
    const result: RequestInit = {
      method: 'get',
      mode: 'cors',
      credentials: 'include',
      referrer: location.href,
      headers,
    }
    Object.assign(result, obj)
    return result
  }

  function setDefaultParams(params: URLSearchParams): void {
    params.set('include_profile_interstitial_type', '1')
    params.set('include_blocking', '1')
    params.set('include_blocked_by', '1')
    params.set('include_followed_by', '1')
    params.set('include_want_retweets', '1')
    params.set('include_mute_edge', '1')
    params.set('include_can_dm', '1')
  }

  async function requestAPI<T>(
    method: HTTPMethods,
    path: string,
    paramsObj: URLParamsObj = {}
  ): Promise<APIResponse<T>> {
    const fetchOptions = generateTwitterAPIOptions({
      method,
    })
    const url = new URL('https://api.twitter.com/1.1' + path)
    let params: URLSearchParams
    if (method === 'get') {
      params = url.searchParams
    } else {
      params = new URLSearchParams()
      fetchOptions.body = params
    }
    setDefaultParams(params)
    for (const [key, value] of Object.entries(paramsObj)) {
      params.set(key, value.toString())
    }
    const response = await fetch(url.toString(), fetchOptions)
    if (response.status === 429) {
      throw new APIError(response)
    }
    const headers = Array.from(response.headers).reduce(
      (obj, [name, value]) => ((obj[name] = value), obj),
      {} as { [name: string]: string }
    )
    const apiResponse = {
      ok: response.ok,
      headers,
      body: (await response.json()) as T,
    }
    return apiResponse
    // return response
  }

  export async function handleMessage({
    method,
    path,
    params,
    nonce,
  }: {
    method: HTTPMethods
    path: string
    params: URLParamsObj
    nonce: string
  }) {
    console.debug('got hm %o', {
      method,
      path,
      params,
      nonce,
    })
    const response = await requestAPI(method, path, params)
    const detail = { response }
    const customEvent = new CustomEvent(`TwitterAPI->[nonce:${nonce}]`, {
      detail,
    })
    console.debug('sending twitter api event %o', {
      nonce,
      response,
    })
    document.dispatchEvent(customEvent)
  }
}

namespace MirrorBlockInject.Messaging {
  export interface MirrorBlockMessage {
    '>_< mirrorblock': true
    action: string
    data: any
  }
  function isMirrorBlockMessage(msg: object): msg is MirrorBlockMessage {
    if (!(msg && typeof msg === 'object')) {
      return false
    }
    return '>_< mirrorblock' in msg
  }
  export function initialize(): void {
    window.addEventListener('message', async event => {
      const message = event.data
      if (!isMirrorBlockMessage(message)) {
        return
      }
      if (message.action === 'requestAPI') {
        const data = message.data
        const { nonce, method, path, params } = data as {
          nonce: string
          method: HTTPMethods
          path: string
          params: URLParamsObj
        }
        MirrorBlockInject.API.handleMessage({ nonce, method, path, params })
      }
    })
  }
}

MirrorBlockInject.Messaging.initialize()
