import flatten from 'flat'

import enUS from './enUS.yaml'
import koKR from './koKR.yaml'

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
