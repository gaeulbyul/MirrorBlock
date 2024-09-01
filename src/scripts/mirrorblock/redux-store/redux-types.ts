import type { Tweet, DMData } from '미러블락/scripts/api/twitter-api'

// 트위터의 Redux store에는 일부 속성에 실제 값 대신 id만 들어있음
export type TweetEntity = Tweet & {
  user: string
  quoted_status?: string
}

export interface TweetEntities {
  [tweetId: string]: TweetEntity
}

export interface DMDataWrapped {
  data: DMData
}

export interface DMEntities {
  [convId: string]: DMDataWrapped
}

export interface UserCell {
  displayMode: string
  promotedItemType: string
  userId: string
  withFollowsYou: boolean
}

export type ReduxStoreEventNames =
  | 'insertSingleUserIntoStore'
  | 'insertMultipleUsersIntoStore'
  | 'afterBlockUser'
  | 'toastMessage'
  | 'getMultipleUsersByIds'
  | 'getUserByName'
  | 'getDMData'

export interface ReduxStore {
  getState(): any
  dispatch(payload: { type: string, [key: string]: any }): any
  subscribe(callback: () => void): void
}
