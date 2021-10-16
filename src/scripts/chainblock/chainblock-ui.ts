import { EventEmitter, sleep } from '미러블락/scripts/common'
import * as i18n from '미러블락/scripts/i18n'

// shortcut
function i18m(key: i18n.I18NMessageKeys): string {
  return i18n.getMessage(key)
}

const CHAINBLOCK_UI_HTML = `
  <div class="mobcb-bg modal-container block-dialog" style="display:flex">
    <div class="mobcb-dialog modal modal-content is-autoPosition">
      <div class="mobcb-titlebar">
        <span class="mobcb-title">${i18m('chainblock')}</span>
        <span class="mobcb-title-status">(${i18m('preparing')})</span>
      </div>
      <div class="mobcb-progress">
        <progress class="mobcb-progress-bar"></progress>
        <div class="mobcb-progress-text" hidden>
          (<span class="mobcb-prg-percentage"></span>%)
          ${i18n.getMessage('chainblock_progress', [0, 0, 0])}
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
        <label title="${i18m('chainblock_immediately_block_mode_tooltip')}">
          <input type="checkbox" id="mobcb-block-immediately">${i18m(
            'chainblock_immediately_block_mode_label'
          )}
        </label>
      </div>
      <div class="mobcb-controls">
        <div class="mobcb-message-container">
          <div class="mobcb-bottom-message">
            <span class="mobcb-rate-limited mobcb-rate-limited-msg" hidden>
              ${i18m('chainblock_rate_limited')}
            </span>
          </div>
          <div class="mobcb-rate-limited mobcb-limit-status" hidden>
            ${i18m('chainblock_reset_time_label')}: <span class="resettime"></span>
          </div>
        </div>
        <button class="mobcb-close btn normal-btn">${i18m('close')}</button>
        <button disabled class="mobcb-execute btn caution-btn">${i18m('block')}</button>
      </div>
    </div>
  </div>
`

function getLimitResetTime(limit: Limit): string {
  const uiLanguage = browser.i18n.getUILanguage()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const formatter = new Intl.DateTimeFormat(uiLanguage, {
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
      userPrefix = `[${i18n.getMessage('already_blocked')}]`
    } else if (found.state === 'muteSkip') {
      userPrefix = `[${i18n.getMessage('skipped')}]`
    }
    let tooltip = `${userPrefix} @${user.screen_name} (${user.name})`
    tooltip += `\n${i18n.getMessage('profile')}: ${user.description}`
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
    this.rootElem.querySelector('.mobcb-title-status')!.textContent = `(${i18n.getMessage(
      'scrape_running'
    )})`
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
    this.rootElem.querySelector('.mobcb-title-status')!.textContent = `(${i18n.getMessage(
      'scrape_completed'
    )})`
    const shouldBlocks = progress.foundUsers.filter(user => user.state === 'shouldBlock')
    const executeButton = this.rootElem.querySelector<HTMLButtonElement>('.mobcb-execute')!
    if (shouldBlocks.length > 0) {
      executeButton.disabled = false
    } else {
      executeButton.title = i18n.getMessage('no_blockable_user')
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
        window.alert(i18n.getMessage('nobody_blocks_you'))
        this.emit('ui:close-without-confirm')
      })
    }
  }
  public startMutualBlock() {
    this.rootElem.querySelector('.mobcb-title-status')!.textContent = `(${i18n.getMessage(
      'block_running'
    )})`
    this.rootElem.querySelector<HTMLButtonElement>('.mobcb-execute.btn')!.disabled = true
  }
  public completeMutualBlock() {
    this.rootElem.querySelector('.mobcb-title-status')!.textContent = `(${i18n.getMessage(
      'block_completed'
    )})`
  }
}
