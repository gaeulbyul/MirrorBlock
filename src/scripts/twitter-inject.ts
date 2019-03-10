{
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
  function inject(reactRoot: any) {
    const reactRootContainer = reactRoot._reactRootContainer
    const reduxStore =
      reactRootContainer._internalRoot.current.memoizedState.element.props.store
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
      inject(reactRoot)
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
