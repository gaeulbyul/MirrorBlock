import { EventEmitter, sleep } from '../common'

const CHAINBLOCK_UI_HTML = `
  <div class="mobcb-bg modal-container block-dialog" style="display:flex">
    <div class="mobcb-dialog modal modal-content is-autoPosition">
      <div class="mobcb-titlebar">
        <span class="mobcb-title">체인맞블락</span>
        <span class="mobcb-title-status">(준비 중)</span>
      </div>
      <div class="mobcb-progress">
        <progress class="mobcb-progress-bar"></progress>
        <div class="mobcb-progress-text" hidden>
          (<span class="mobcb-prg-percentage"></span>%)
          <span class="mobcb-prg-total"></span>명 중
          <span class="mobcb-prg-scraped"></span>명 수집,
          총 <span class="mobcb-prg-found"></span>명 발견
        </div>
      </div>
      <hr class="mobcb-hr">
      <div class="mobcb-users">
        <div class="mobcb-blockedby-users">
          <ul class="mobcb-userlist"></ul>
        </div>
        <div class="mobcb-skipped-users">
          <ul class="mobcb-userlist"></ul>
        </div>
      </div>
      <hr class="mobcb-hr">
      <div class="mobcb-extra-options">
        <label title="맞차단할 사용자를 발견하면 ('차단'버튼을 누르지 않아도) 바로 맞차단합니다.">
          <input type="checkbox" id="mobcb-block-immediately">발견 즉시 바로 맞차단하기
        </label>
      </div>
      <div class="mobcb-controls">
        <div class="mobcb-message-container">
          <div class="mobcb-bottom-message">
            <span class="mobcb-rate-limited mobcb-rate-limited-msg" hidden>
              팔로워를 너무 많이 가져와 일시적인 제한에 걸렸습니다.
            </span>
          </div>
          <div class="mobcb-rate-limited mobcb-limit-status" hidden>
            예상 제한해제 시간 (±5분): <span class="resettime"></span>
          </div>
        </div>
        <button class="mobcb-close btn normal-btn">닫기</button>
        <button disabled class="mobcb-execute btn caution-btn">차단</button>
      </div>
    </div>
  </div>
`

function getLimitResetTime(limit: Limit): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  })
  // 120000 = 1000 * 60 * 2 = 리밋상태에서 체인블락의 delay간격
  const datetime = new Date(limit.reset * 1000 + 120000)
  return formatter.format(datetime)
}

class UserList {
  private readonly items: Map<string, HTMLElement> = new Map()
  constructor(private rootElem: HTMLElement) {}
  public get size(): number {
    return this.items.size
  }
  public add(found: FoundUser): void {
    const user = found.user
    if (this.items.has(user.id_str)) {
      return
    }
    let userPrefix = ''
    if (found.state === 'alreadyBlocked') {
      userPrefix = '[이미 차단함]'
    } else if (found.state === 'muteSkip') {
      userPrefix = '[스킵]'
    }
    let tooltip = `${userPrefix} @${user.screen_name} (${user.name})`
    tooltip += `\n프로필:\n${user.description}`
    const ul = this.rootElem.querySelector('ul')!
    const item = document.createElement('li')
    const link = document.createElement('a')
    item.className = 'mobcb-user'
    link.href = `https://twitter.com/${user.screen_name}`
    if (location.hostname === 'mobile.twitter.com') {
      link.hostname = 'mobile.twitter.com'
    }
    link.setAttribute('rel', 'noreferer noopener')
    link.setAttribute('target', '_blank')
    link.setAttribute('title', tooltip)
    if (found.state === 'shouldBlock') {
      link.style.fontWeight = 'bold'
    }
    link.textContent = `${userPrefix} @${user.screen_name}: ${user.name}`
    item.appendChild(link)
    ul.appendChild(item)
    this.items.set(user.id_str, item)
  }
  public updateBlockResult(user: TwitterUser, success: boolean) {
    const item = this.items.get(user.id_str)
    if (!item) {
      return
    }
    if (success) {
      item.classList.remove('block-failed')
      item.classList.add('block-success')
    } else {
      item.classList.remove('block-success')
      item.classList.add('block-failed')
    }
  }
  public cleanup() {
    this.items.clear()
  }
}

export default class ChainMirrorBlockUI extends EventEmitter {
  private rootElem = document.createElement('div')
  private skippedUserList: UserList
  private blockedbyUserList: UserList
  private total = 0
  constructor() {
    super()
    this.rootElem.innerHTML = CHAINBLOCK_UI_HTML
    this.skippedUserList = new UserList(
      this.rootElem.querySelector<HTMLElement>('.mobcb-skipped-users')!
    )
    this.blockedbyUserList = new UserList(
      this.rootElem.querySelector<HTMLElement>('.mobcb-blockedby-users')!
    )
    document.body.appendChild(this.rootElem)
    this.handleEvents()
  }
  public close() {
    this.cleanupUserList()
    this.rootElem.remove()
  }
  private cleanupUserList() {
    this.skippedUserList.cleanup()
    this.blockedbyUserList.cleanup()
  }
  private handleEvents() {
    this.rootElem.addEventListener('click', event => {
      if (!event.target) {
        return
      }
      const target = event.target as HTMLElement
      if (target.matches('.mobcb-close')) {
        this.emit('ui:close')
      } else if (target.matches('.mobcb-execute')) {
        this.emit('ui:execute-mutual-block')
      }
    })
  }
  public get immediatelyBlockModeChecked() {
    return this.rootElem.querySelector<HTMLInputElement>('#mobcb-block-immediately')!.checked
  }
  public set immediatelyBlockModeChecked(value: boolean) {
    this.rootElem.querySelector<HTMLInputElement>('#mobcb-block-immediately')!.checked = value
  }
  public initProgress(total: number) {
    this.total = total
    const progressBar = this.rootElem.querySelector<HTMLProgressElement>('.mobcb-progress-bar')!
    progressBar.max = total
    this.rootElem.querySelector('.mobcb-prg-total')!.textContent = total.toLocaleString()
  }
  public updateBlockResult(user: TwitterUser, success: boolean) {
    this.blockedbyUserList.updateBlockResult(user, success)
  }
  public rateLimited(limit: Limit) {
    this.rootElem.querySelectorAll<HTMLElement>('.mobcb-rate-limited').forEach(elem => {
      elem.hidden = false
    })
    const resettime = getLimitResetTime(limit)
    this.rootElem.querySelector('.mobcb-limit-status .resettime')!.textContent = resettime
  }
  public rateLimitResetted() {
    this.rootElem.querySelectorAll<HTMLElement>('.mobcb-rate-limited').forEach(elem => {
      elem.hidden = true
    })
  }
  public updateProgress(progress: ChainMirrorBlockProgress) {
    this.rootElem.querySelector('.mobcb-title-status')!.textContent = '(진행 중...)'
    progress.foundUsers
      .filter(found => found.state === 'shouldBlock')
      .forEach(found => this.blockedbyUserList.add(found))
    progress.foundUsers
      .filter(found => found.state === 'muteSkip' || found.state === 'alreadyBlocked')
      .forEach(found => this.skippedUserList.add(found))
    const progressBar = this.rootElem.querySelector<HTMLProgressElement>('.mobcb-progress-bar')!
    progressBar.value = progress.scraped
    const percentage = Math.round((progress.scraped / this.total) * 100)
    this.rootElem.querySelector('.mobcb-prg-percentage')!.textContent = percentage.toString()
    this.rootElem.querySelector(
      '.mobcb-prg-scraped'
    )!.textContent = progress.scraped.toLocaleString()
    this.rootElem.querySelector(
      '.mobcb-prg-found'
    )!.textContent = progress.foundUsers.length.toLocaleString()
    this.rootElem.querySelector<HTMLElement>('.mobcb-progress-text')!.hidden = false
  }
  private completeProgressUI(progress: ChainMirrorBlockProgress) {
    this.rootElem.querySelector('.mobcb-title-status')!.textContent = '(수집 완료)'
    const shouldBlocks = progress.foundUsers.filter(user => user.state === 'shouldBlock')
    const executeButton = this.rootElem.querySelector<HTMLButtonElement>('.mobcb-execute')!
    if (shouldBlocks.length > 0) {
      executeButton.disabled = false
    } else {
      executeButton.title = `맞차단할 사용자가 없습니다.`
    }
    this.rootElem.querySelector<HTMLInputElement>('#mobcb-block-immediately')!.disabled = true
    this.rootElem.querySelector('.mobcb-prg-scraped')!.textContent = this.total.toLocaleString()
    const progressBar = this.rootElem.querySelector<HTMLProgressElement>('.mobcb-progress-bar')!
    progressBar.value = progressBar.max
    this.rootElem.querySelector('.mobcb-prg-percentage')!.textContent = '100'
  }
  public complete(progress: ChainMirrorBlockProgress) {
    this.completeProgressUI(progress)
    if (progress.foundUsers.length <= 0) {
      // sleep: progress가 100%되기 전에 메시지가 뜨며 닫히는 현상 방지
      sleep(100).then(() => {
        window.alert('여기에선 아무도 나를 차단하지 않았습니다.')
        this.emit('ui:close-without-confirm')
      })
    }
  }
  public startMutualBlock() {
    this.rootElem.querySelector('.mobcb-title-status')!.textContent = '(맞차단 진행 중...)'
    this.rootElem.querySelector<HTMLButtonElement>('.mobcb-execute.btn')!.disabled = true
  }
  public completeMutualBlock() {
    this.rootElem.querySelector('.mobcb-title-status')!.textContent = '(맞차단 완료)'
  }
}
