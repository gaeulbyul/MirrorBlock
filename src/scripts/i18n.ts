type I18NMessages = typeof import('../_locales/ko/messages.json')
type SubstItem = number | string
type Substitutions = SubstItem | SubstItem[] | undefined
export type I18NMessageKeys = keyof I18NMessages

export function getMessage(key: string & I18NMessageKeys, substs: Substitutions = undefined) {
  if (Array.isArray(substs)) {
    return browser.i18n.getMessage(
      key,
      substs.map(s => s.toLocaleString())
    )
  } else if (typeof substs === 'number') {
    return browser.i18n.getMessage(key, substs.toLocaleString())
  } else {
    return browser.i18n.getMessage(key, substs)
  }
}

function tryGetMessage(messageName: string) {
  const message = getMessage(messageName as any)
  if (!message) {
    throw new Error(`invalid messageName? "${messageName}"`)
  }
  return message
}

export function applyI18nOnHtml() {
  const i18nTextElements = document.querySelectorAll('[data-i18n-text]')
  for (const elem of i18nTextElements) {
    const messageName = elem.getAttribute('data-i18n-text')!
    const message = tryGetMessage(messageName)
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
      // console.debug('|attr| key:"%s", value:"%s"', key, value)
      const message = tryGetMessage(value)
      elem.setAttribute(key, message)
    })
  }
}

//function checkMissingTranslations(
//  // ko/messages.json 엔 있고 en/messages.json 엔 없는 키가 있으면
//  // TypeScript 컴파일러가 타입에러를 일으킨다.
//  // tsconfig.json의 resolveJsonModule 옵션을 켜야 함
//  keys:
//    | Exclude<keyof typeof import('../_locales/ko/messages.json'), keyof typeof import('../_locales/en/messages.json')>
//    | Exclude<keyof typeof import('../_locales/en/messages.json'), keyof typeof import('../_locales/ko/messages.json')>,
//  find: (_keys: never) => void,
//  _check = find(keys)
//) {}
//checkMissingTranslations
