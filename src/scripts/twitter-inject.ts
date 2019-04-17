interface ReduxStore {
  getState(): any
  dispatch(payload: { type: string; [key: string]: any }): any
  subscribe(callback: () => void): void
  // replaceReducer(): any
}
function dig<T>(obj: () => T): T | null {
  try {
    return obj()
  } catch (err) {
    if (err instanceof TypeError) {
      return null
    } else {
      throw err
    }
  }
}
{
  const reactRoot = document.getElementById('react-root')!
  function getReactEventHandler(target: any): any {
    const key = Object.keys(target)
      .filter((k: string) => k.startsWith('__reactEventHandlers'))
      .pop()
    return key ? target[key] : null
  }
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
  function findReduxStore(): ReduxStore | null {
    {
      const reactRoot1 = reactRoot as any
      const store1 = dig(
        () =>
          reactRoot1._reactRootContainer._internalRoot.current.memoizedState
            .element.props.store
      )
      if (isReduxStore(store1)) {
        return store1
      }
    }
    // 2019-04-08: store 위치 바뀐 듯
    // do-while: 유사 GOTO문
    // $.__reactEventHandlers$???????????.children.props.store
    do {
      const reactRoot2 = document.querySelector('[data-reactroot]')!.children[0]
      const rEventHandler = getReactEventHandler(reactRoot2)
      if (!rEventHandler) {
        break
      }
      const store2 = dig(() => rEventHandler.children.props.store)
      if (isReduxStore(store2)) {
        return store2
      }
    } while (0)
    console.warn(
      '[Mirror Block] WARNING: failed to find redux store! Block-reflection on new UI is disabled!'
    )
    return null
  }
  function sendEntitiesToExtension(state: any) {
    const users = dig(() => state.entities.users.entities)
    const tweets = dig(() => state.entities.tweets.entities)
    if (users && tweets) {
      document.dispatchEvent(
        new CustomEvent('MirrorBlock<-subscribe', {
          detail: {
            users,
            tweets,
          },
        })
      )
    }
  }
  function addEvent(
    name: string,
    callback: (event: CustomEvent) => void
  ): void {
    document.addEventListener(`MirrorBlock->${name}`, event => {
      const customEvent = event as CustomEvent
      callback(customEvent)
    })
  }
  function inject() {
    const reduxStore = findReduxStore()
    if (!reduxStore) {
      return
    }
    reduxStore.subscribe(() => {
      const state = reduxStore.getState()
      sendEntitiesToExtension(state)
    })
    addEvent('insertUserIntoStore', event => {
      const { user: user_ } = event.detail
      if (typeof user_.id_str !== 'string') {
        console.error(user_)
        throw new Error('whats this')
      }
      const user = user_ as TwitterUser
      const userId = user.id_str
      reduxStore.dispatch({
        type: 'rweb/entities/ADD_ENTITIES',
        payload: {
          users: {
            [userId]: user,
          },
        },
      })
    })
    addEvent('afterBlockUser', event => {
      const { user } = event.detail
      const userId = user.id_str
      const uniqId = uuid.v1()
      reduxStore.dispatch({
        type: 'rweb/blockedUsers/BLOCK_REQUEST',
        optimist: {
          id: uniqId,
          type: 'BEGIN',
        },
        meta: {
          userId,
        },
      })
    })
    addEvent('toastMessage', event => {
      const { text } = event.detail
      reduxStore.dispatch({
        type: 'rweb/toasts/ADD_TOAST',
        payload: { text },
      })
    })
    // XXX debug
    Object.assign(window, {
      $$store: reduxStore,
    })
  }
  function initialize() {
    const reactRoot = document.getElementById('react-root')!
    if ('_reactRootContainer' in reactRoot) {
      console.debug('inject!!!')
      inject()
    } else {
      console.debug('waiting...')
      setTimeout(initialize, 500)
    }
    initializeTweetIdHelper()
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initialize, {
      timeout: 3000,
    })
  } else {
    console.warn('requestIdleCallback not found. fallback')
    initialize()
  }
  function sendEntryToExtension() {
    const section = document.querySelector('section[role=region]')
    if (!section) {
      return
    }
    const children = dig(
      () => section.children[1].children[0].children[0].children
    )
    if (!children) {
      return
    }
    const items = Array.from(children, el => el as HTMLElement)
    for (const item of items) {
      if (item.hasAttribute('data-mirrorblock-entryid')) {
        continue
      }
      const rEventHandler = getReactEventHandler(item)!
      const entry = dig<Entry>(
        () => rEventHandler.children.props.children.props.entry
      )
      if (!entry) {
        continue
      }
      // console.debug('%o %o', item, entry)
      item.setAttribute('data-mirrorblock-entryid', entry.entryId)
      const customEvent = new CustomEvent('MirrorBlock<-entry', {
        detail: entry,
      })
      document.dispatchEvent(customEvent)
    }
  }
  // 트윗타래: 연관된 사람
  function sendAsideUserIdsToExtension() {
    // asi.__reactEventHandlers$wyjgb0wrp5s.children[1].props.userIds
    // asi.children[1].__reactEventHandlers$wyjgb0wrp5s.children[{}].props
  }
  function initializeTweetIdHelper(): void {
    new MutationObserver(() => {
      sendEntryToExtension()
      sendAsideUserIdsToExtension()
    }).observe(reactRoot, {
      subtree: true,
      childList: true,
      characterData: true,
    })
  }
}
