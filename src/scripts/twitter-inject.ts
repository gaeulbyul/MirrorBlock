// window['react-root']._reactRootContainer._internalRoot.current.memoizedState.element.props.store.getState
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
    addEvent('getWholeState', () => {
      const state = reduxStore.getState()
      return state
    })
    addEvent('getUserByName', event => {
      const { userName } = event.detail
      const state = reduxStore.getState()
      const users = Object.values<TwitterUser>(state.entities.users.entities)
      for (const user of users) {
        if (user.screen_name === userName) {
          return user
        }
      }
      return null
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
      timeout: 5000,
    })
  } else {
    console.warn('requestIdleCallback not found. fallback')
    initialize()
  }
}
