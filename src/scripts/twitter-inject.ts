interface ReduxStore {
  getState(): any
  dispatch(payload: any): any
  subscribe(callback: () => void): void
  // replaceReducer(): any
}
{
  function isReduxStore(something: any): something is ReduxStore {
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
      const reactRoot1 = document.getElementById('react-root') as any
      const store1 =
        reactRoot1._reactRootContainer._internalRoot.current.memoizedState
          .element.props.store
      if (isReduxStore(store1)) {
        return store1
      }
    }
    // 2019-04-08: store 위치 바뀐 듯
    // do-while: 유사 GOTO문
    // $.__reactEventHandlers$???????????.children.props.store
    do {
      const reactRoot2 = document.querySelector('[data-reactroot]')!.children[0]
      const ehkey = Object.keys(reactRoot2)
        .filter((k: string) => k.startsWith('__reactEventHandlers'))
        .pop()
      if (!ehkey) {
        break
      }
      console.debug('ehkey: "%s"', ehkey)
      const rEventHandlers = (reactRoot2 as any)[ehkey]
      const store2 = rEventHandlers.children.props.store
      if (isReduxStore(store2)) {
        return store2
      }
    } while (0)
    console.warn(
      '[Mirror Block] WARNING: failed to find redux store! Block-reflection on new UI is disabled!'
    )
    return null
  }
  function addEvent(name: string, callback: (event: CustomEvent) => any): void {
    document.addEventListener(`MirrorBlock->${name}`, event => {
      const customEvent = event as CustomEvent
      const nonce = customEvent.detail.nonce
      const detail = callback(customEvent)
      const responseEvent = new CustomEvent(`MirrorBlock<-${name}.${nonce}`, {
        detail,
      })
      document.dispatchEvent(responseEvent)
    })
  }
  function inject() {
    const reduxStore = findReduxStore()
    if (!reduxStore) {
      return
    }
    addEvent('getUserByName', event => {
      const userNameToGet = event.detail.userName as string
      const loweredUserNameToGet = userNameToGet.toLowerCase()
      const state = reduxStore.getState()
      // 주의:
      // entities에 저장된 사용자 정보엔 일부 값이 빠질 수 있음
      // 특히, blocked_by , blocking 같은 정보!
      const users = Object.values<IncompleteTwitterUser>(
        state.entities.users.entities
      )
      for (const user of users) {
        const lowered = user.screen_name.toLowerCase()
        if (lowered === loweredUserNameToGet) {
          return user
        }
      }
      return null
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
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initialize, {
      timeout: 3000,
    })
  } else {
    console.warn('requestIdleCallback not found. fallback')
    initialize()
  }
}
