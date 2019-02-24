const enum FollowType {
  followers = 'followers',
  following = 'following',
}

const enum Action {
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

namespace MirrorBlock.Utils {
  export function sleep(time: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, time))
  }

  export function injectScript(path: string): Promise<void> {
    return new Promise(resolve => {
      const script = document.createElement('script')
      script.addEventListener('load', () => {
        resolve()
      })
      script.src = browser.runtime.getURL(path)
      const appendTarget = document.head || document.documentElement
      appendTarget!.appendChild(script)
    })
  }

  export function copyFrozenObject<T extends object>(obj: T): Readonly<T> {
    return Object.freeze(Object.assign({}, obj))
  }

  export function deepFreeze<T>(obj: T): Readonly<T> {
    Object.freeze(obj)

    const propNames = Object.getOwnPropertyNames(obj) as (keyof T)[]
    propNames.forEach(prop => {
      if (
        obj.hasOwnProperty(prop) &&
        obj[prop] !== null &&
        (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') &&
        !Object.isFrozen(obj[prop])
      ) {
        deepFreeze(obj[prop])
      }
    })

    return obj
  }

  export function* getAddedElementsFromMutations(
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

  export function filterElements<T extends HTMLElement>(
    elems: Iterable<T> | ArrayLike<T>
  ): T[] {
    return Array.from(elems)
      .filter(elem => !elem.classList.contains('mob-checked'))
      .map(elem => {
        elem.classList.add('mob-checked')
        return elem
      })
  }

  // naive check given object is TwitterUser
  export function isTwitterUser(obj: any): obj is TwitterUser {
    if (typeof obj !== 'object' || obj === null) {
      return false
    }
    if (typeof obj.id_str !== 'string') {
      return false
    }
    if (typeof obj.screen_name !== 'string') {
      return false
    }
    if (typeof obj.blocked_by !== 'boolean') {
      return false
    }
    return true
  }
}
