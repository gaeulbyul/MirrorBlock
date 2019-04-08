namespace MirrorBlock.Mobile.Redux {
  declare function cloneInto<T>(detail: T, view: Window | null): T
  export class ReduxedStore {
    // 파이어폭스에서 CustomEvent의 detail 개체 전달용
    private cloneDetail<T>(detail: T): T {
      if (typeof detail !== 'object') {
        return detail
      }
      if (typeof cloneInto === 'function') {
        return cloneInto(detail, document.defaultView)
      } else {
        return detail
      }
    }
    private async triggerPageEvent(
      eventName: string,
      eventDetail?: object
    ): Promise<any> {
      const nonce = Math.random()
      const detail = this.cloneDetail(
        Object.assign({}, eventDetail, {
          nonce,
        })
      )
      const requestEvent = new CustomEvent(`MirrorBlock->${eventName}`, {
        detail,
      })
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject('timeouted!')
        }, 10000)
        document.addEventListener(
          `MirrorBlock<-${eventName}.${nonce}`,
          event => {
            window.clearTimeout(timeout)
            const customEvent = event as CustomEvent
            resolve(customEvent.detail)
          },
          { once: true }
        )
        document.dispatchEvent(requestEvent)
      })
    }
    public async getUserByName(userName: string): Promise<TwitterUser | null> {
      const result = await this.triggerPageEvent('getUserByName', {
        userName,
      })
      if (MirrorBlock.Utils.isTwitterUser(result)) {
        return result
      } else {
        return null
      }
    }
    public async insertUserIntoStore(user: TwitterUser): Promise<void> {
      this.triggerPageEvent('insertUserIntoStore', {
        user,
      })
    }
    public async afterBlockUser(user: TwitterUser): Promise<void> {
      this.triggerPageEvent('afterBlockUser', {
        user,
      })
      const clonedUser = Object.assign({}, user)
      clonedUser.blocking = true
      this.insertUserIntoStore(clonedUser)
    }
  }
}
