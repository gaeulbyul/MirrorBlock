enum FollowType {
  followers = 'followers',
  following = 'following'
}

enum Action {
  StartChainBlock = 'MirrorOfBlock/Start',
  StopChainBlock = 'MirrorOfBlock/Stop',
  ConfirmedChainBlock = 'MirrorOfBlock/Confirmed'
}

interface MOBStartChainBlockMessage {
  action: Action.StartChainBlock,
  userName: string,
  followType: FollowType
}

interface MOBStopChainBlockMessage {
  action: Action.StopChainBlock
}

interface MOBConfirmedChainBlockMessage {
  action: Action.ConfirmedChainBlock
}

type Message = MOBStartChainBlockMessage
  | MOBStopChainBlockMessage
  | MOBConfirmedChainBlockMessage

interface TwitterAPIUser {
  id_str: string,
  screen_name: string,
  name: string,
  blocked_by: boolean,
  blocking: boolean,
  muting: boolean,
  friends_count: number,
  followers_count: number,
  description: string
}

interface EventStore {
  [eventName: string]: Function[]
}

abstract class EventEmitter {
  protected events: EventStore = {}
  on<T> (eventName: string, handler: (t: T) => any) {
    if (!(eventName in this.events)) {
      this.events[eventName] = []
    }
    this.events[eventName].push(handler)
    return this
  }
  emit<T> (eventName: string, eventHandlerParameter?: T) {
    const handlers = this.events[eventName] || []
    handlers.forEach(handler => handler(eventHandlerParameter))
    return this
  }
}

function sleep (time: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, time))
}

function injectScript (path: string) {
  const script = document.createElement('script')
  script.src = browser.runtime.getURL(path)
  const appendTarget = document.head || document.documentElement
  appendTarget!.appendChild(script)
}

// 내가 차단한 사용자의 프로필에 "차단됨" 표시
function changeButtonToBlocked (profile: Element) {
  const actions = profile.querySelector('.user-actions')
  if (actions) {
    actions.classList.remove('not-following')
    actions.classList.add('blocked')
  }
}
