/// <reference path="./i18n.d.ts" />

import * as KoreanMessages from '../_locales/ko/messages.json'
import * as EnglishMessages from '../_locales/en/messages.json'

// MV3 & Service-worker 에서 못 쓰는거:
// i18n.getMessage
// i18n.getUILanguage

let messages: typeof KoreanMessages
switch (navigator.language) {
  case 'ko-KR':
    messages = KoreanMessages
    break
  default:
    messages = EnglishMessages
    break
}

const i18n: MirrorBlockI18NTranslates = new Proxy(messages, {
  get(obj, name: string, p) {
    const translate = Reflect.get(obj, name, p)
    if (!translate) {
      throw new TypeError(`can't find translation with key '${name}'`)
    }
    return function fn(...substitutes: Array<number | string>) {
      const { message } = translate
      const placeholders = translate.placeholders || {}
      if (Object.keys(placeholders).length !== substitutes.length) {
        console.warn(
          'placeholder length mismatch! name="%s", expected %d, got %d',
          name,
          Object.keys(placeholders).length,
          substitutes.length
        )
      }
      if (substitutes.length > 9) {
        throw new Error('chrome/chromium does not support more-than 9 substitutes')
      }
      return message.replace(/\$(\w+)\$/g, (_match: any, key: string) => {
        return placeholders[key].content.replace(/\$(\d)/g, (_pmatch: any, pn: string) => {
          const n = parseInt(pn, 10) - 1
          const subst = substitutes[n]
          if (typeof subst === 'number') {
            return subst.toLocaleString()
          } else {
            return subst
          }
        })
      })
    }
  },
}) as any

export default i18n

export function applyI18NOnHtml() {
  const i18nTextElements = document.querySelectorAll('[data-i18n-text]')
  for (const elem of i18nTextElements) {
    const messageName = elem.getAttribute('data-i18n-text')!
    // @ts-ignore
    const message = i18n[messageName]()
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
      // @ts-ignore
      const message = i18n[value]()
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
  _check = find(keys)
) {}
checkMissingTranslations
