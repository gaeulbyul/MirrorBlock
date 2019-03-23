namespace MirrorBlock.BadgeV2 {
  export class Badge {
    private readonly baseElem = document.createElement('span')
    constructor() {
      this.baseElem.className = 'mob-badge mob-badge-v2'
      this.baseElem.style.whiteSpace = 'initial'
      this.baseElem.innerHTML = `\
<span class="badge-wrapper">
  <span class="badge blocks-you" title="나를 차단함: 이 사용자가 나를 차단하고 있습니다.">
    나를 차단함
    <span hidden class="badge-username"></span>
  </span>
  <span hidden class="badge block-reflected" title="차단반사 발동: Mirror Block이 이 사용자를 맞차단했습니다.">
    차단반사 발동!
  </span>
</span>`
    }
    public showUserName(name: string) {
      const userNameElem = this.baseElem.querySelector<HTMLElement>(
        '.badge-username'
      )!
      userNameElem.textContent = `(@${name})`
      userNameElem.hidden = false
    }
    public blockReflected() {
      const brBadge = this.baseElem.querySelector<HTMLElement>(
        '.block-reflected[hidden]'
      )!
      brBadge.hidden = false
    }
    public attachAfter(targetElem: Element): void {
      if (alreadyExists(targetElem)) {
        return
      }
      targetElem.after(this.baseElem)
    }
    public appendTo(targetElem: Element): void {
      if (alreadyExists(targetElem)) {
        return
      }
      targetElem.appendChild(this.baseElem)
    }
  }
  function alreadyExists(elem: Element): boolean {
    if (elem.querySelector('.mob-badge')) {
      return true
    }
    let nelem = elem.nextElementSibling
    let count = 10
    while (nelem) {
      if (--count <= 10) {
        break
      }
      if (nelem.matches('.mob-badge')) {
        return true
      } else {
        nelem = nelem.nextElementSibling
      }
    }
    return false
  }
}
