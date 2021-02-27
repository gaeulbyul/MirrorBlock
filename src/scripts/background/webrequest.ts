type HttpHeaders = browser.webRequest.HttpHeaders

const extraInfoSpec: any = ['requestHeaders', 'blocking']
try {
  // @ts-ignore
  const requireExtraHeadersSpec = browser.webRequest.OnBeforeSendHeadersOptions.hasOwnProperty(
    'EXTRA_HEADERS'
  )
  if (requireExtraHeadersSpec) {
    extraInfoSpec.push('extraHeaders')
  }
} catch (e) {}

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

function initializeTwitterAPIRequestHeaderModifier() {
  const reqFilters = {
    urls: [
      // 'https://api.twitter.com/*',
      'https://twitter.com/i/api/*',
      'https://mobile.twitter.com/i/api/*',
    ],
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      const headers = details.requestHeaders!
      stripOrigin(headers)
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
