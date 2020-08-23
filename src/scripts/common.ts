export const enum Action {
  StartChainBlock = 'MirrorBlock/Start',
  Alert = 'MirrorBlock/Alert',
  RequestAPI = 'MirrorBlock/RequestAPI',
  ResponseAPI = 'MirrorBlock/ResponseAPI',
  ExamineChainBlockableActor = 'MirrorBlock/ExamineChainBlockableActor',
  ChainBlockableActorResult = 'MirrorBlock/ChainBlockableActorResult',
}

const USER_NAME_BLACKLIST = Object.freeze([
  '1',
  'about',
  'account',
  'followers',
  'followings',
  'hashtag',
  'home',
  'i',
  'lists',
  'login',
  'oauth',
  'privacy',
  'search',
  'tos',
  'notifications',
  'messages',
  'explore',
])

export class TwitterUserMap extends Map<string, TwitterUser> {
  public addUser(user: TwitterUser) {
    this.set(user.id_str, user)
  }
  public hasUser(user: TwitterUser) {
    return this.has(user.id_str)
  }
  public toUserArray(): TwitterUser[] {
    return Array.from(this.values())
  }
  public toUserObject(): TwitterUserEntities {
    const usersObj: TwitterUserEntities = Object.create(null)
    for (const [userId, user] of this) {
      usersObj[userId] = user
    }
    return usersObj
  }
  public static fromUsersArray(users: TwitterUser[]): TwitterUserMap {
    return new TwitterUserMap(users.map((user): [string, TwitterUser] => [user.id_str, user]))
  }
  public filter(fn: (user: TwitterUser) => boolean): TwitterUserMap {
    return TwitterUserMap.fromUsersArray(this.toUserArray().filter(fn))
  }
}

export abstract class EventEmitter {
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

export function sleep(time: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, time))
}

export function injectScript(path: string): Promise<void> {
  return new Promise(resolve => {
    const script = document.createElement('script')
    script.addEventListener('load', () => {
      script.remove()
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

const touchedElems = new WeakSet<HTMLElement>()
export function* iterateUntouchedElems<T extends HTMLElement>(elems: Iterable<T> | ArrayLike<T>) {
  for (const elem of Array.from(elems)) {
    if (!touchedElems.has(elem)) {
      touchedElems.add(elem)
      yield elem
    }
  }
}

// naive check given object is TwitterUser
export function isTwitterUser(obj: unknown): obj is TwitterUser {
  if (!(obj && typeof obj === 'object')) {
    return false
  }
  const objAsAny = obj as any
  if (typeof objAsAny.id_str !== 'string') {
    return false
  }
  if (typeof objAsAny.screen_name !== 'string') {
    return false
  }
  if (typeof objAsAny.blocking !== 'boolean') {
    return false
  }
  if (typeof objAsAny.blocked_by !== 'boolean') {
    return false
  }
  return true
}

export function isInNameBlacklist(name: string): boolean {
  const lowerCasedName = name.toLowerCase()
  return USER_NAME_BLACKLIST.includes(lowerCasedName)
}

export function validateTwitterUserName(userName: string): boolean {
  if (isInNameBlacklist(userName)) {
    return false
  }
  const pattern = /^[0-9a-z_]{1,15}$/i
  return pattern.test(userName)
}

export function getUserNameFromTweetUrl(
  extractMe: HTMLAnchorElement | URL | Location
): string | null {
  const { hostname, pathname } = extractMe
  const supportingHostname = ['twitter.com', 'mobile.twitter.com']
  if (!supportingHostname.includes(hostname)) {
    return null
  }
  const matches = /^\/([0-9a-z_]{1,15})/i.exec(pathname)
  if (!matches) {
    return null
  }
  const name = matches[1]
  if (validateTwitterUserName(name)) {
    return name
  } else {
    return null
  }
}

export function assertNever(x: never) {
  console.error('assertNever: unreachable! %o', x)
}
