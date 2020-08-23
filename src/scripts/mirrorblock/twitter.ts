import { detectOnCurrentTwitter } from './mirrorblock-mobile'
import { handleDarkMode } from '../nightmode'

import * as Options from '../../extoption'

function initialize() {
  browser.storage.onChanged.addListener(changes => {
    const option = changes.option.newValue
    document.documentElement.classList.toggle('mob-enable-outline', option.outlineBlockUser)
  })

  Options.load().then(option => {
    document.documentElement.classList.toggle('mob-enable-outline', option.outlineBlockUser)
  })

  const reactRoot = document.getElementById('react-root')!
  detectOnCurrentTwitter(reactRoot)

  handleDarkMode()
}

initialize()
