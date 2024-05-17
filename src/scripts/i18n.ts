import browser from 'webextension-polyfill'
import type * as EnglishMessages from '../_locales/en/messages.json'
import type * as KoreanMessages from '../_locales/ko/messages.json'

export function applyI18NOnHtml() {
  const i18nTextElements = document.querySelectorAll('[data-i18n-text]')
  for (const elem of i18nTextElements) {
    const messageName = elem.getAttribute('data-i18n-text')!
    const message = browser.i18n.getMessage(messageName)
    // console.debug('%o .textContent = %s [from %s]', elem, message, messageName)
    elem.textContent = message
  }
  const i18nAttrsElements = document.querySelectorAll('[data-i18n-attrs]')
  for (const elem of i18nAttrsElements) {
    // example:
    // <span data-i18n-attrs="title=popup_title&alt=popup_alt"></span>
    const attrsToNameSerialized = elem.getAttribute('data-i18n-attrs')!
    const attrsToNameParsed = new URLSearchParams(attrsToNameSerialized)
    attrsToNameParsed.forEach((value, key) => {
      const message = browser.i18n.getMessage(value)
      elem.setAttribute(key, message)
    })
  }
}

function checkMissingTranslations(
  // ko/messages.json 엔 있고 en/messages.json 엔 없는 키가 있으면
  // TypeScript 컴파일러가 타입에러를 일으킨다.
  // tsconfig.json의 resolveJsonModule 옵션을 켜야 함
  keys:
    | Exclude<keyof typeof KoreanMessages, keyof typeof EnglishMessages>
    | Exclude<keyof typeof EnglishMessages, keyof typeof KoreanMessages>,
  find: (_keys: never) => void,
  _check = find(keys),
) {}
checkMissingTranslations
