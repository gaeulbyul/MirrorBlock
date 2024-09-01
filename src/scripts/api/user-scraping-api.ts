import chunk from 'lodash-es/chunk'
import { sleep, wrapEitherRight, type Either } from '미러블락/scripts/common'
import { TwClient } from './twitter-api'
import type { TwitterUser, FollowKind } from './twitter-api'

const DELAY = 100

export class UserScrapingAPIClient {
  public constructor(private twClient: TwClient) {}

  public async *getAllFollowsIds(
    followKind: FollowKind,
    user: TwitterUser,
  ): ScrapedUserIdsIterator {
    let cursor = '-1'
    while (cursor !== '0') {
      try {
        const json = await this.twClient.getFollowsIds(followKind, user, cursor)
        cursor = json.next_cursor_str
        yield wrapEitherRight(json)
        await sleep(DELAY)
      } catch (error: any) {
        yield {
          ok: false,
          error,
        }
      }
    }
  }

  public async *getAllFollowsUserList(
    followKind: Exclude<FollowKind, 'mutual-followers'>,
    user: TwitterUser,
  ): ScrapedUsersIterator {
    let cursor: string | null = null
    while (true) {
      try {
        const users: TwitterUser[] = []
        if (followKind === 'followers') {
          const response = await this.twClient.getFollowers(user, cursor)
          users.push(...response.users)
          cursor = response.cursorBottom
        } else if (followKind === 'following') {
          const response = await this.twClient.getFollowing(user, cursor)
          users.push(...response.users)
          cursor = response.cursorBottom
        }
        if (users.length <= 0) {
          break
        }
        yield wrapEitherRight({ users })
        await sleep(DELAY)
      } catch (error: any) {
        yield {
          ok: false,
          error,
        }
      }
    }
  }

  public async *lookupUsersByIds(userIds: string[]): ScrapedUsersIterator {
    const chunks = chunk(userIds, 100)
    for (const chunk of chunks) {
      const users = await this.twClient.getMultipleUsers({ user_id: chunk })
      yield wrapEitherRight({ users })
    }
  }

  public async *lookupUsersByNames(userNames: string[]): ScrapedUsersIterator {
    const chunks = chunk(userNames, 100)
    for (const chunk of chunks) {
      try {
        const users = await this.twClient.getMultipleUsers({ screen_name: chunk })
        yield wrapEitherRight({ users })
      } catch (error: any) {
        yield {
          ok: false,
          error,
        }
      }
    }
  }
}

interface UsersObject {
  users: TwitterUser[]
}

interface UserIdsObject {
  ids: string[]
}

export type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, UsersObject>>
export type ScrapedUserIdsIterator = AsyncIterableIterator<Either<Error, UserIdsObject>>
