import type { Instruction } from './handle-instructions'

export interface GraphQLQueryData {
  queryId: string
  operationName: string
  operationType: 'query' | 'mutation'
}

const gqlDataMap = new Map<string, GraphQLQueryData>()

async function extractGraphQLQueryData(codeUrl: string) {
  const code = await fetch(codeUrl).then(resp => resp.text())
  const regexp =
    /{queryId:"(?<queryId>[0-9A-Za-z_-]+)",operationName:"(?<operationName>\w+)",operationType:"(?<operationType>\w+)"/g
  let matched = false
  for (const match of code.matchAll(regexp)) {
    matched = true
    const { queryId, operationName, operationType } = match.groups as unknown as GraphQLQueryData
    gqlDataMap.set(operationName, { queryId, operationName, operationType })
  }
  if (!matched) {
    console.error('no queryData matched on this code: "%s"', codeUrl)
  }
}

async function extractGraphQLQueryDataFromComplexCode(codeUrl: string) {
  const code = await fetch(codeUrl).then(resp => resp.text())
  for (const matched of code.matchAll(/params:\{(.+?null)\}/g)) {
    const matchedText = matched[1]
    if (!matchedText) {
      throw new Error('unreachable')
    }
    const queryId = /id:"([0-9A-Za-z_-]+)"/.exec(matchedText)?.[1]
    const operationName = /name:"([0-9A-Za-z_-]+)"/.exec(matchedText)?.[1]
    const operationType = /operationKind:"(query|mutation)"/.exec(matchedText)?.[1]
    if (!(queryId && operationName)) {
      continue
    }
    if (!(operationType === 'query' || operationType === 'mutation')) {
      throw new Error('unreachable')
    }
    gqlDataMap.set(operationName, {
      queryId,
      operationName,
      operationType,
    })
  }
}

function getMainScriptUrl(html: string) {
  const domparser = new DOMParser()
  const parsed = domparser.parseFromString(html, 'text/html')
  const mainScriptTag = Array
    .from(parsed.querySelectorAll<HTMLScriptElement>('script[src*="main."]'))
    .find(script => /\/main\.[0-9a-f]+\.js$/.test(script.src))
  if (!mainScriptTag) {
    throw new Error('failed to find main script')
  }
  return mainScriptTag.src
}

function getTweetActivityScriptUrl(html: string) {
  const tweetActivityMatch =
    /"shared~bundle\.TweetEditHistory~bundle\.QuoteTweetActivity~bundle\.TweetActivity":"([0-9a-f]{7})"/
      .exec(html)
  if (!tweetActivityMatch) {
    throw new Error('failed to find tweet-activity script')
  }
  return 'https://abs.twimg.com/responsive-web/client-web/' +
    'shared~bundle.TweetEditHistory~bundle.QuoteTweetActivity~bundle.TweetActivity.' +
    `${tweetActivityMatch[1]}a.js`
}

function getCommunitiesScriptUrl(html: string) {
  const communitiesMatch = /"bundle\.Communities":"([0-9a-f]{7})"/.exec(html)
  if (!communitiesMatch) {
    throw new Error('failed to find communities script')
  }
  return 'https://abs.twimg.com/responsive-web/client-web/' +
    'bundle.Communities.' +
    `${communitiesMatch[1]}a.js`
}

async function fetchGraphQLQueryData() {
  if (gqlDataMap.size > 0) {
    return
  }
  const html = await fetch('https://x.com/').then(resp => resp.text())
  const promises = [
    extractGraphQLQueryData(
      getMainScriptUrl(html),
    ),
    extractGraphQLQueryData(
      getTweetActivityScriptUrl(html),
    ),
  ]
  if (NaN) {
    promises.push(
      extractGraphQLQueryDataFromComplexCode(
        getCommunitiesScriptUrl(html),
      ),
    )
  }
  await Promise.all(promises)
  console.log('graphql querydatas: %o', gqlDataMap)
}

export async function getQueryDataByOperationName(operationName: string): Promise<GraphQLQueryData> {
  if (gqlDataMap.size <= 0) {
    await fetchGraphQLQueryData()
  }
  const queryData = gqlDataMap.get(operationName)
  if (!queryData) {
    throw new Error('failed to find gql data for: ' + operationName)
  }
  return queryData
}

export const instructionsPath = {
  Retweeters({ data }: any): Instruction[] {
    return data.retweeters_timeline.timeline.instructions
  },
  TweetDetail({ data }: any): Instruction[] {
    return data.threaded_conversation_with_injections_v2.instructions
  },
  Followers({ data }: any): Instruction[] {
    return data.user.result.timeline.timeline.instructions
  },
  Following({ data }: any): Instruction[] {
    return data.user.result.timeline.timeline.instructions
  },
  SearchTimeline({ data }: any): Instruction[] {
    return data.search_by_raw_query.search_timeline.timeline.instructions
  },
}
