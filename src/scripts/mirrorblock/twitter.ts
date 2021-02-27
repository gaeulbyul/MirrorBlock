import { detectOnCurrentTwitter } from './mirrorblock-mobile'
import { handleDarkMode } from '미러블락/scripts/nightmode'

import * as Options from '미러블락/extoption'

function initialize() {
  browser.storage.onChanged.addListener(changes => {
    const option = changes.option.newValue
    document.documentElement.classList.toggle('mob-enable-outline', option.outlineBlockUser)
  })

  Options.load().then(option => {
    document.documentElement.classList.toggle('mob-enable-outline', option.outlineBlockUser)
  })

  const reactRoot = document.getElementById('react-root')
  if (reactRoot) {
    detectOnCurrentTwitter(reactRoot)
    handleDarkMode()
  } else {
    throw new Error('legacy twitter not supported')
  }
}

initialize()
