import flatten from 'flat'

import enUS from './enUS.json'
import koKR from './koKR.json'

export default {
  en: {
    code: 'en-US',
    message: flatten(enUS),
  },
  ko: {
    code: 'ko-KR',
    message: flatten(koKR),
  },
}
