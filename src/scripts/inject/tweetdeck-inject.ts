{
  function applyMagicToTD(TD: any) {
    // 트윗덱의 AJAX요청에 차단여부 정보를 포함하게 해주는 옵션을 추가한다.
    TD.services.TwitterClient.prototype.request$REAL = TD.services.TwitterClient.prototype.request
    TD.services.TwitterClient.prototype.request = function(url: any, option: any) {
      Object.assign(option.params || {}, {
        include_blocking: 1,
        include_blocked_by: 1,
        include_mute_edge: 1,
        include_followed_by: 1,
      })
      return TD.services.TwitterClient.prototype.request$REAL.call(this, url, option)
    }

    // TwitterUser에 사용자 차단여부를 넣으면 트윗덱의 필터기능 등에서 이를 이용할 수 있다.
    function insertAdditionalInfo(targetObject: any, additional: any) {
      return Object.assign(targetObject, {
        blockedBy: additional.blocked_by,
        blocking: additional.blocking,
        followedBy: additional.followed_by,
        following: additional.following,
        muting: additional.muting,
      })
    }
    TD.services.TwitterUser.prototype.fromJSONObject$REAL =
      TD.services.TwitterUser.prototype.fromJSONObject
    TD.services.TwitterUser.prototype.fromJSONObject = function(json: any, t: any) {
      insertAdditionalInfo(this, json)
      return TD.services.TwitterUser.prototype.fromJSONObject$REAL.call(this, json, t)
    }
    TD.services.TwitterUser.prototype.fromGraphQLJSONObject$REAL =
      TD.services.TwitterUser.prototype.fromGraphQLJSONObject
    TD.services.TwitterUser.prototype.fromGraphQLJSONObject = function(json: any, t: any) {
      insertAdditionalInfo(this, json.legacy)
      return TD.services.TwitterUser.prototype.fromGraphQLJSONObject$REAL.call(this, json, t)
    }

    // 트윗덱에선 "나를 차단함" 대신 "@(기본계정)을 차단함" 같은 식으로 보여줘야함
    // 이를 위해 현재 설정된 기본계정을 알아낼 수 있어야함
    // 따라서, 기본계정이 변경될 때 마다 DOM에 사용자아이디를 넣어 content-scripts에서 접근할 수 있도록 한다.
    document.addEventListener('TDLoaded', () => {
      document.body.setAttribute(
        'data-default-account-username',
        TD.storage.accountController.getDefault().state.username,
      )
    })

    function onDefaultAccountChanged(args: any) {
      // const [afterChange, beforeChange] = args
      const afterChange = args[0]
      const registeredAccounts = TD.storage.accountController.getAccountsForService('twitter')
      const defaultAccount = registeredAccounts.filter((acc: any) => {
        return acc.privateState.key === afterChange
      })[0]
      if (!defaultAccount) {
        console.error('fail to get default account! %o %o', registeredAccounts, args)
        return
      }
      const userName = defaultAccount.state.username
      document.body.setAttribute('data-default-account-username', userName)
    }
    // 기본계정이 바뀌면 data-default-account-username도 같이 바뀌도록
    TD.storage.notification.notify$REAL = TD.storage.notification.notify
    TD.storage.notification.notify = function(msg: string) {
      TD.storage.notification.notify$REAL.apply(this, arguments)
      if (msg !== '/storage/client/default_account_changed') {
        return
      }
      if (msg === '/storage/client/default_account_changed') {
        onDefaultAccountChanged([].slice.call(arguments, 1))
      }
    }
  }

  function applyMagicToMustache(mustaches: any) {
    function magicalTemplate(templateName: string) {
      return `
        <span class="mob-user-data"
        style="display:none;visibility:hidden"
        data-template="${templateName}"
        data-id="{{id}}"
        data-name="{{name}}"
        data-screen-name="{{screenName}}"
        data-blocking="{{blocking}}"
        data-blocked-by="{{blockedBy}}"
        data-muting="{{muting}}"
        data-following="{{following}}"
        data-followed-by="{{followedBy}}"
        ></span>
      `
    }
    mustaches['twitter_profile.mustache'] += `
      {{#twitterProfile}}
        {{#profile}}
          ${magicalTemplate('twitter_profile')}
        {{/profile}}
      {{/twitterProfile}}
    `
    mustaches['account_summary.mustache'] += magicalTemplate('account_summary')
    mustaches['account_summary_inline.mustache'] += magicalTemplate('account_summary_inline')
    mustaches['status/tweet_single_header.mustache'] += magicalTemplate(
      'status/tweet_single_header',
    )
    /* not-workings:
     *  compose/reply_info
     */
  }

  function main() {
    // TD.ready 이벤트 접근이 어렵다...
    const loadingElem = document.querySelector('.js-app-loading')
    if (!loadingElem) {
      throw new Error('fail to initialize tweetdeck')
    }
    const readyObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes') {
          continue
        }
        const target = mutation.target
        if (
          target instanceof HTMLElement
          && mutation.attributeName === 'style'
          && target.style.display === 'none'
        ) {
          const ev = new CustomEvent('TDLoaded')
          document.dispatchEvent(ev)
          readyObserver.disconnect()
        }
      }
    })
    readyObserver.observe(loadingElem, {
      // subtree: true,
      // childList: true,
      attributes: true,
    })

    // @ts-ignore
    applyMagicToTD(window.TD)
    // @ts-ignore
    applyMagicToMustache(window.TD.mustaches || window.TD_mustaches)
  }
  main()
}
