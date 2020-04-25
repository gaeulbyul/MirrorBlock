type HttpHeaders = browser.webRequest.HttpHeaders

const isFirefox = browser.runtime.getURL('/').startsWith('moz-extension://')
const extraInfoSpec: any = ['requestHeaders', 'blocking']
if (!isFirefox) {
  extraInfoSpec.push('extraHeaders')
}

function stripOrigin(headers: HttpHeaders) {
  for (let i = 0; i < headers.length; i++) {
    const name = headers[i].name.toLowerCase()
    switch (name) {
      case 'origin':
        headers[i].value = 'https://twitter.com'
        break
    }
  }
  return headers
}

function filterInvalidHeaders(headers: HttpHeaders): HttpHeaders {
  return headers.filter(({ name }) => name.length > 0)
}

function changeActor(cookies: string, _actAsUserId: string, actAsUserToken: string): string {
  const authTokenPattern = /\bauth_token=([0-9a-f]+)\b/
  const authTokenMatch = authTokenPattern.exec(cookies)
  authTokenPattern.lastIndex = 0
  if (!authTokenMatch) {
    return cookies
  }
  const newCookie = cookies.replace(
    new RegExp(authTokenPattern, 'g'),
    `auth_token=${actAsUserToken}`
  )
  return newCookie
}

function initializeTwitterAPIRequestHeaderModifier() {
  const reqFilters = {
    urls: ['https://api.twitter.com/*'],
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      // console.debug('block_all api', details)
      const headers = details.requestHeaders!
      stripOrigin(headers)
      const actAsUserId = headers
        .filter(({ name }) => name === 'x-act-as-user-id')
        .map(({ value }) => value)
        .pop()
      const actAsUserToken = headers
        .filter(({ name }) => name === 'x-act-as-user-token')
        .map(({ value }) => value)
        .pop()
      if (actAsUserId && actAsUserToken) {
        for (let i = 0; i < headers.length; i++) {
          const name = headers[i].name.toLowerCase()
          const value = headers[i].value!
          switch (name) {
            case 'x-act-as-user-id':
            case 'x-act-as-user-token':
              headers[i].name = ''
              break
            case 'cookie':
              headers[i].value = changeActor(value, actAsUserId, actAsUserToken)
              break
          }
        }
      }
      return {
        requestHeaders: filterInvalidHeaders(headers),
      }
    },
    reqFilters,
    extraInfoSpec
  )
}

export function initializeWebRequests() {
  initializeTwitterAPIRequestHeaderModifier()
}
