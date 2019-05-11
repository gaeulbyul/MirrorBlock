namespace MirrorBlock.APICommon {
  const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

  export class APIError<T = any> extends Error {
    constructor(public readonly response: APIResponse<T>) {
      super('Received non-OK response from Twitter API')
      Object.setPrototypeOf(this, new.target.prototype)
    }
  }
  export class RateLimitError extends APIError {}

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

  export async function requestAPI<T>(
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
    const headers = Array.from(response.headers).reduce(
      (obj, [name, value]) => ((obj[name] = value), obj),
      {} as { [name: string]: string }
    )
    const apiResponse = {
      ok: response.ok,
      headers,
      body: (await response.json()) as T,
    }
    if (response.status === 429) {
      throw new APIError(apiResponse)
    }
    return apiResponse
  }
}
