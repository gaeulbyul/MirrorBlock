import browser from 'webextension-polyfill'
import { handleDarkMode } from '미러블락/scripts/nightmode'
import { detectOnCurrentTweetDeck, detectOnCurrentTwitter } from './mirrorblock-mobile'

import * as Options from '미러블락/extoption'

function initialize() {
  const reactRoot = document.getElementById('react-root')
  if (!reactRoot) {
    // 구 트윗덱은 #react-root이 없음
    return
  }
  browser.storage.onChanged.addListener(changes => {
    const optionChange = changes.option
    if (!optionChange) {
      return
    }
    const option = optionChange.newValue
    document.documentElement.classList.toggle('mob-enable-outline', option.outlineBlockUser)
  })

  Options.load().then(option => {
    document.documentElement.classList.toggle('mob-enable-outline', option.outlineBlockUser)
  })

  if (location.hostname === 'tweetdeck.twitter.com') {
    detectOnCurrentTweetDeck(reactRoot)
  } else {
    detectOnCurrentTwitter(reactRoot)
  }
  handleDarkMode()
}

initialize()
