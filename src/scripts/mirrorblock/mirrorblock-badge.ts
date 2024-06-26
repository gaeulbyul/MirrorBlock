import browser from 'webextension-polyfill'

export default class Badge {
  private readonly badgedAttr = 'data-mirrorblock-badged'
  private readonly baseElem = document.createElement('span')
  constructor(private user: TwitterUser) {
    const userName = user.screen_name
    this.baseElem.className = 'mob-badge'
    this.baseElem.style.whiteSpace = 'initial'
    this.baseElem.innerHTML = `\
<span class="badge-wrapper">
  <span class="badge blocks-you">
    ${browser.i18n.getMessage('blocks_you')}
    <span hidden class="badge-username"></span>
  </span>
  <span hidden class="badge block-reflected">
    ${browser.i18n.getMessage('block_reflected')}
  </span>
</span>`
    this.baseElem
      .querySelector('.badge.blocks-you')!
      .setAttribute('title', browser.i18n.getMessage('blocks_you_description', userName))
    this.baseElem
      .querySelector('.badge.block-reflected')!
      .setAttribute('title', browser.i18n.getMessage('block_reflected_description', userName))
  }
  public showUserName() {
    const name = this.user.screen_name
    const userNameElem = this.baseElem.querySelector<HTMLElement>('.badge-username')!
    userNameElem.textContent = `(@${name})`
    userNameElem.hidden = false
  }
  public blockReflected() {
    const brBadge = this.baseElem.querySelector<HTMLElement>('.block-reflected[hidden]')!
    brBadge.hidden = false
  }
  public attachAfter(targetElem: Element): void {
    if (!targetElem.hasAttribute(this.badgedAttr)) {
      targetElem.after(this.baseElem)
      targetElem.setAttribute(this.badgedAttr, '1')
    }
  }
  public appendTo(targetElem: Element): void {
    if (!targetElem.hasAttribute(this.badgedAttr)) {
      targetElem.appendChild(this.baseElem)
      targetElem.setAttribute(this.badgedAttr, '1')
    }
  }
}
