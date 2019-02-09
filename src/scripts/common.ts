enum FollowType {
  followers = 'followers',
  following = 'following',
}

enum Action {
  StartChainBlock = 'MirrorBlock/Start',
  StopChainBlock = 'MirrorBlock/Stop',
}

abstract class EventEmitter {
  protected events: EventStore = {}
  on<T>(eventName: string, handler: (t: T) => any) {
    console.debug('handle %s event', eventName)
    if (!(eventName in this.events)) {
      this.events[eventName] = []
    }
    this.events[eventName].push(handler)
    return this
  }
  emit<T>(eventName: string, eventHandlerParameter?: T) {
    console.debug('emit %s event with %o', eventName, eventHandlerParameter)
    const handlers = this.events[eventName] || []
    handlers.forEach(handler => handler(eventHandlerParameter))
    return this
  }
}

function sleep(time: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, time))
}

function injectScript(path: string) {
  const script = document.createElement('script')
  script.src = browser.runtime.getURL(path)
  const appendTarget = document.head || document.documentElement
  appendTarget!.appendChild(script)
}

function copyFrozenObject<T extends object>(obj: T): Readonly<T> {
  return Object.freeze(Object.assign({}, obj))
}

function* getAddedElementsFromMutations(
  mutations: MutationRecord[]
): IterableIterator<HTMLElement> {
  for (const mut of mutations) {
    for (const node of mut.addedNodes) {
      if (node instanceof HTMLElement) {
        yield node
      }
    }
  }
}
