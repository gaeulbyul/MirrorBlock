import * as Detector from './twitter-inject/detector'
import * as ReduxDispatcher from './twitter-inject/redux-dispatcher'
import * as ReduxFetcher from './twitter-inject/redux-fetchter'

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
function findReduxStore(reactRoot: HTMLElement): ReduxStore {
  const rEventHandler = getReactEventHandler(reactRoot.children[0]!)
  const reduxStore = rEventHandler.children.props.children.props.store
  if (!isReduxStore(reduxStore)) {
    throw new Error('fail to find redux store')
  }
  return reduxStore
}

function inject(reactRoot: HTMLElement): void {
  const reduxStore = findReduxStore(reactRoot)
  ReduxDispatcher.listenEvent(reduxStore)
  ReduxFetcher.listenEvent(reduxStore)
  Detector.observe(reactRoot, reduxStore)
}

function isReactLoaded(elem: HTMLElement) {
  return Object.keys(elem).find(k => k.startsWith('_reactListening'))
}

export function initialize() {
  const reactRoot = document.getElementById('react-root')!
  if (reactRoot && isReactLoaded(reactRoot)) {
    inject(reactRoot)
  } else {
    setTimeout(initialize, 500)
  }
}

requestIdleCallback(initialize, {
  timeout: 10000,
})
