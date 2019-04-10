namespace MirrorBlock.Mobile.Redux {
  const userMapByName = new Map<string, TwitterUser>()
  export namespace StoreRetriever {
    export function getUserByName(userName: string): TwitterUser | null {
      return userMapByName.get(userName) || null
    }
    export function subcribeEvent() {
      document.addEventListener('MirrorBlock<-subscribe', event => {
        const customEvent = event as CustomEvent
        if (!customEvent.detail) {
          return
        }
        const users = customEvent.detail.users as TwitterUserEntities
        for (const user of Object.values(users)) {
          userMapByName.set(user.screen_name, user)
        }
      })
    }
  }
  export namespace StoreUpdater {
    // 파이어폭스에서 CustomEvent의 detail 개체 전달용
    function cloneDetail<T>(detail: T): T {
      if (typeof detail !== 'object') {
        return detail
      }
      if (typeof cloneInto === 'function') {
        return cloneInto(detail, document.defaultView)
      } else {
        return detail
      }
    }
    function triggerPageEvent(eventName: string, eventDetail?: object): void {
      const detail = cloneDetail(eventDetail)
      const requestEvent = new CustomEvent(`MirrorBlock->${eventName}`, {
        detail,
      })
      document.dispatchEvent(requestEvent)
    }
    export async function insertUserIntoStore(
      user: TwitterUser
    ): Promise<void> {
      userMapByName.set(user.screen_name, user)
      triggerPageEvent('insertUserIntoStore', {
        user,
      })
    }
    export async function afterBlockUser(user: TwitterUser): Promise<void> {
      triggerPageEvent('afterBlockUser', {
        user,
      })
      const clonedUser = Object.assign({}, user)
      clonedUser.blocking = true
      insertUserIntoStore(clonedUser)
    }
    export async function toastMessage(text: string): Promise<void> {
      triggerPageEvent('toastMessage', {
        text,
      })
    }
  }
}
