import browser from 'webextension-polyfill'

export function injectScript(path: string): Promise<void> {
  return new Promise(resolve => {
    const script = document.createElement('script')
    script.addEventListener('load', () => {
      script.remove()
      resolve()
    })
    script.src = browser.runtime.getURL(path)
    const appendTarget = document.head || document.documentElement
    appendTarget!.appendChild(script)
  })
}

export function sendBrowserTabMessage<T>(tabId: number, message: T) {
  return browser.tabs.sendMessage(tabId, message)
}
