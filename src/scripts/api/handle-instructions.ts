import type { TwitterUser, Tweet } from './twitter-api'
export function extractCursorsFromInstructions(instructions: Instruction[]) {
  let cursorTop: string | null = null
  let cursorBottom: string | null = null
  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries') {
      continue
    }
    for (const { content } of instruction.entries) {
      if (content.entryType !== 'TimelineTimelineCursor') {
        continue
      }
      if (content.cursorType === 'Top') {
        cursorTop = content.value
      }
      if (content.cursorType === 'Bottom') {
        cursorBottom = content.value
      }
    }
  }
  return { cursorTop, cursorBottom }
}

export function extractTwitterUsersFromInstructions(instructions: Instruction[]) {
  const users: TwitterUser[] = []
  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries') {
      continue
    }
    for (const { content } of instruction.entries) {
      if (content.entryType !== 'TimelineTimelineItem') {
        continue
      }
      const { itemContent } = content
      if (itemContent.itemType !== 'TimelineUser') {
        continue
      }
      const user = getUserFromResult(itemContent.user_results.result)
      users.push(user)
    }
  }
  return users
}

export function extractTweetsFromInstructions(instructions: Instruction[]) {
  const tweets: Tweet[] = []
  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries') {
      continue
    }
    for (const { content } of instruction.entries) {
      if (content.entryType !== 'TimelineTimelineItem') {
        continue
      }
      const { itemContent } = content
      if (itemContent.itemType !== 'TimelineTweet') {
        continue
      }
      const tweet = getTweetFromResult(itemContent.tweet_results.result)
      tweets.push(tweet)
    }
  }
  return tweets
}

export function getUserFromResult(itemResult: UserEntryResult): TwitterUser {
  const user: TwitterUser = {
    id_str: itemResult.rest_id,
    ...itemResult.legacy,
  }
  return user
}

export function getTweetFromResult(itemResult: TweetEntryResult | TweetWithVisibilityResultsEntryResult): Tweet {
  if (itemResult.__typename === 'TweetWithVisibilityResults') {
    const innerResult: TweetEntryResult = {
      __typename: 'Tweet',
      ...itemResult.tweet,
    }
    return getTweetFromResult(innerResult)
  }
  const tweet: Tweet = {
    id_str: itemResult.rest_id,
    ...itemResult.legacy,
  }
  tweet.user = getUserFromResult(itemResult.core.user_results.result)
  return tweet
}

export type Instruction = AddEntries | TerminateTimeline | ClearCache

interface AddEntries {
  type: 'TimelineAddEntries'
  entries: Entry[]
}

interface TerminateTimeline {
  type: 'TimelineTerminateTimeline'
  direction: 'Top' | 'Bottom'
}

interface ClearCache {
  type: 'TimelineClearCache'
}

interface Entry {
  entryId: string
  content: EntryItem | EntryCursor | EntryModule
}

interface EntryItem {
  __typename: 'TimelineTimelineItem'
  entryType: 'TimelineTimelineItem'
  itemContent: ItemContent
}

interface EntryCursor {
  __typename: 'TimelineTimelineCursor'
  entryType: 'TimelineTimelineCursor'
  cursorType: 'Top' | 'Bottom'
  value: string
  stopOnEmptyResponse?: boolean
}

type EntryModule = EntryModuleVerticalConversation

interface EntryModuleVerticalConversation {
  __typename: 'TimelineTimelineModule'
  entryType: 'TimelineTimelineModule'
  entryId: string
  items: EntryModuleVerticalConversationItem[]
  displayType: 'VerticalConversation'
}

type EntryModuleVerticalConversationItem =
  | EntryModuleVerticalConversationTweetItem
  | EntryModuleVerticalConversationCursorItem

interface EntryModuleVerticalConversationTweetItem {
  item: {
    itemContent: TweetEntryItemContent
  }
}

interface EntryModuleVerticalConversationCursorItemContent {
  __typename: 'TimelineTimelineCursor'
  itemType: 'TimelineTimelineCursor'
  value: string
  cursorType: 'ShowMore'
}

interface EntryModuleVerticalConversationCursorItem {
  item: {
    itemContent: EntryModuleVerticalConversationCursorItemContent
  }
}

type ItemContent = TweetEntryItemContent | UserEntryItemContent

interface TweetEntryItemContent {
  __typename: 'TimelineTweet'
  itemType: 'TimelineTweet'
  hasModeratedReplies: boolean
  tweetDisplayType: string // (TODO) 'SelfThread'
  tweet_results: {
    result: TweetEntryResult | TweetWithVisibilityResultsEntryResult
  }
}

interface TweetEntryResult {
  __typename: 'Tweet'
  core: {
    user_results: {
      result: UserEntryResult
    }
  }
  // edit_control
  has_birdwatch_notes: boolean
  legacy: Omit<Tweet, 'id_str'>
  // quoted_status_result:
  rest_id: string
  source: string
  // unmention_data
  // views: { count: number, state: string }
}

interface TweetWithVisibilityResultsEntryResult {
  __typename: 'TweetWithVisibilityResults'
  tweet: Omit<TweetEntryResult, '__typename'>
  // limitedActionResults
}

interface UserEntryItemContent {
  __typename: 'TimelineUser'
  itemType: 'TimelineUser'
  userDisplayType: string // (TODO) 'User'
  user_results: {
    result: UserEntryResult
  }
}

interface UserEntryResult {
  __typename: 'User'
  is_blue_verified: boolean
  legacy: Omit<TwitterUser, 'id_str'>
  profile_image_shape: 'Circle'
  rest_id: string
}
