import type { TwitterUser } from '미러블락/scripts/api/twitter-api'
export type BlockResultsMap = Map<TwitterUser, BlockResult>

export type BlockResult = 'notYet' | 'pending' | 'blockSuccess' | 'blockFailed'
export type UserState = 'shouldBlock' | 'alreadyBlocked' | 'muteSkip'

export interface FoundUser {
  user: TwitterUser
  state: UserState
}

export interface ChainMirrorBlockProgress {
  scraped: number
  foundUsers: FoundUser[]
}
