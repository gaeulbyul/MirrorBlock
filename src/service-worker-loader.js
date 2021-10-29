// Chrome 93미만에선 service worker가 root에 있어야 한다는 제약이 있더라.
// Whale 브라우저 등 Chromium 엔진 업데이트가 늦는 브라우저를 감안하여
// 별도의 loader를 만드는 식으로 해결해보자.
// https://stackoverflow.com/a/66408379

try {
  importScripts('vendor/browser-polyfill.min.js')
  importScripts('bundled/background.bun.js')
} catch (err) {
  console.error(err)
}
