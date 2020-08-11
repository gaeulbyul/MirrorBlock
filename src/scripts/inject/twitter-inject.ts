import * as ReduxDispatcher from './twitter-inject/redux-dispatcher'
import * as ReduxFetcher from './twitter-inject/redux-fetchter'
import * as Detector from './twitter-inject/detector'

import { getReactEventHandler } from './twitter-inject/inject-common'

function isReduxStore(something: any): something is ReduxStore {
  if (!something) {
    return false
  }
  if (typeof something !== 'object') {
    return false
  }
  if (typeof something.getState !== 'function') {
    return false
  }
  if (typeof something.dispatch !== 'function') {
    return false
  }
  if (typeof something.subscribe !== 'function') {
    return false
  }
  return true
}
function findReduxStore(): ReduxStore {
  const reactRoot = document.getElementById('react-root')!.children[0]
  const rEventHandler = getReactEventHandler(reactRoot)
  const reduxStore = rEventHandler.children.props.children.props.store
  if (!isReduxStore(reduxStore)) {
    throw new Error('fail to find redux store')
  }
  return reduxStore
}
function inject(): void {
  const reactRoot = document.getElementById('react-root')!
  const reduxStore = findReduxStore()
  ReduxDispatcher.listenEvent(reduxStore)
  ReduxFetcher.listenEvent(reduxStore)
  Detector.observe(reactRoot, reduxStore)
}
export function initialize() {
  const reactRoot = document.getElementById('react-root')!
  if ('_reactRootContainer' in reactRoot) {
    console.debug('inject!!!')
    inject()
  } else {
    console.debug('waiting...')
    setTimeout(initialize, 500)
  }
}

requestIdleCallback(initialize, {
  timeout: 10000,
})
