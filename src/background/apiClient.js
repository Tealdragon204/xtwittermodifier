'use strict';

// ── API Client ────────────────────────────────────────────────────
// All Twitter GraphQL/REST calls. Runs in background context so
// cross-origin fetch is unrestricted. No GM_xmlhttpRequest needed.

const MAX_CONCURRENT = 1;

const queue      = [];
let activeCount  = 0;
let lastReqTime  = 0;
let queueTimer   = null;
let isRateLimited = false;

let staleRefreshUsedThisSession = false;

// ── About Account query ───────────────────────────────────────────

async function fetchAboutAccount(screenName) {
  const { bearer, csrf } = getTokens();
  if (!bearer || !csrf) return { noToken: true };

  const vars = encodeURIComponent(JSON.stringify({ screenName }));
  const feat = encodeURIComponent(ABOUT_FEATURES);

  try {
    const resp = await fetch(
      `https://x.com/i/api/graphql/${ABOUT_QUERY_ID}/AboutAccountQuery?variables=${vars}&features=${feat}`,
      {
        headers: {
          'Authorization':             `Bearer ${bearer}`,
          'X-Csrf-Token':              csrf,
          'X-Twitter-Auth-Type':       'OAuth2Session',
          'X-Twitter-Active-User':     'yes',
          'X-Twitter-Client-Language': 'en',
          'Content-Type':              'application/json',
          'Referer':                   'https://x.com/',
        },
      }
    );
    dbg(`AboutAccountQuery @${screenName}: HTTP ${resp.status}`);
    if (resp.status === 200) {
      const data = await resp.json();
      const country = data?.data?.user_result_by_screen_name?.result?.about_profile?.account_based_in || null;
      dbg(`  → account_based_in: ${country}`);
      return country;
    } else if (resp.status === 429) {
      dbg('  → 429 rate limited');
      return { rateLimited: true };
    }
    dbg(`  → unexpected status ${resp.status}`);
    return null;
  } catch (e) {
    dbg('fetchAboutAccount error:', e);
    return null;
  }
}

// ── Tweet data query ──────────────────────────────────────────────

async function fetchTweetData(tweetId) {
  const { bearer, csrf } = getTokens();
  if (!bearer || !csrf) throw new Error('No tokens');

  const variables = encodeURIComponent(JSON.stringify({
    tweetId, withCommunity: false, includePromotedContent: false, withVoice: false,
  }));
  const features = encodeURIComponent(TWEET_RESULT_FEATURES);

  const resp = await fetch(
    `https://x.com/i/api/graphql/${TWEET_RESULT_QUERY_ID}/TweetResultByRestId?variables=${variables}&features=${features}`,
    {
      headers: {
        'Authorization':             `Bearer ${bearer}`,
        'X-Csrf-Token':              csrf,
        'X-Twitter-Auth-Type':       'OAuth2Session',
        'X-Twitter-Active-User':     'yes',
        'X-Twitter-Client-Language': 'en',
        'Content-Type':              'application/json',
      },
    }
  );

  if (!resp.ok) throw new Error(`TweetResultByRestId HTTP ${resp.status}`);
  const raw = await resp.json();

  const tweet = extractTweetResult(raw);
  const user  = tweet?.core?.user_results?.result?.legacy ?? {};

  const unwrapResult = (r) => {
    if (!r) return null;
    if (r.__typename === 'TweetWithVisibilityResults' && r.tweet) return r.tweet;
    return r;
  };

  const quotedRaw = unwrapResult(tweet?.quoted_status_result?.result);

  const buildTweetObj = (t, userLegacy) => ({
    text:          extractTweetText(t),
    handle:        userLegacy.screen_name ?? '',
    displayName:   userLegacy.name ?? '',
    avatarUrl:     userLegacy.profile_image_url_https ?? '',
    imageUrls:     extractImages(t),
    mediaInfo:     extractMediaInfo(t),
    lang:          t?.legacy?.lang ?? null,
    _inReplyToId:  t?.legacy?.in_reply_to_status_id_str ?? null,
    _nestedQuoteId: t?.legacy?.quoted_status_id_str ?? null,
  });

  const result = buildTweetObj(tweet, user);

  if (quotedRaw?.legacy) {
    const qUser = quotedRaw?.core?.user_results?.result?.legacy ?? {};
    result.quotedData = buildTweetObj(quotedRaw, qUser);

    // Fetch nested quote
    if (result.quotedData._nestedQuoteId) {
      try {
        result.quotedData.quotedData = await fetchTweetData(result.quotedData._nestedQuoteId);
      } catch {}
    }
  } else {
    result.quotedData = null;
  }

  return result;
}

// ── Video URL extraction ──────────────────────────────────────────

async function fetchVideoUrl(tweetId) {
  const { bearer, csrf } = getTokens();
  if (!bearer || !csrf) throw new Error('No tokens');

  const variables = encodeURIComponent(JSON.stringify({
    tweetId, withCommunity: false, includePromotedContent: false, withVoice: false,
  }));
  const features = encodeURIComponent(TWEET_RESULT_FEATURES);

  const resp = await fetch(
    `https://x.com/i/api/graphql/${TWEET_RESULT_QUERY_ID}/TweetResultByRestId?variables=${variables}&features=${features}`,
    {
      headers: {
        'Authorization':             `Bearer ${bearer}`,
        'X-Csrf-Token':              csrf,
        'X-Twitter-Auth-Type':       'OAuth2Session',
        'X-Twitter-Active-User':     'yes',
        'X-Twitter-Client-Language': 'en',
        'Content-Type':              'application/json',
      },
    }
  );

  if (!resp.ok) throw new Error(`TweetResultByRestId HTTP ${resp.status}`);
  const data = await resp.json();
  const { url, isGif } = extractMp4(data);
  if (!url) throw new Error('No MP4 in response');
  return { url, isGif };
}

function extractMp4(obj, depth) {
  depth = depth || 0;
  if (!obj || typeof obj !== 'object' || depth > 40) return { url: null, isGif: false };

  if (obj.video_info?.variants && obj.type !== undefined) {
    const isGif = obj.type === 'animated_gif';
    const best = obj.video_info.variants
      .filter(v => v.content_type === 'video/mp4' && v.url)
      .sort((a, b) => {
        const bwDiff = (b.bitrate ?? 0) - (a.bitrate ?? 0);
        if (bwDiff !== 0) return bwDiff;
        const res = u => { const m = u.url?.match(/\/(\d+)x(\d+)\//); return m ? parseInt(m[1]) * parseInt(m[2]) : 0; };
        return res(b) - res(a);
      })[0]?.url;
    if (best) return { url: best, isGif };
  }

  // Also handle video_info without type (legacy path)
  if (obj.video_info?.variants) {
    const best = obj.video_info.variants
      .filter(v => v.content_type === 'video/mp4' && v.url)
      .sort((a, b) => {
        const bwDiff = (b.bitrate ?? 0) - (a.bitrate ?? 0);
        if (bwDiff !== 0) return bwDiff;
        const res = u => { const m = u.url?.match(/\/(\d+)x(\d+)\//); return m ? parseInt(m[1]) * parseInt(m[2]) : 0; };
        return res(b) - res(a);
      })[0]?.url;
    if (best) return { url: best, isGif: false };
  }

  for (const v of (Array.isArray(obj) ? obj : Object.values(obj))) {
    if (v && typeof v === 'object') {
      const found = extractMp4(v, depth + 1);
      if (found.url) return found;
    }
  }
  return { url: null, isGif: false };
}

// ── Request queue (rate-limited) ──────────────────────────────────

function enqueueLocation(screenName) {
  return new Promise((resolve) => {
    const existing = queue.find(q => q.screenName === screenName);
    if (existing) { existing.resolvers.push(resolve); return; }
    queue.push({ screenName, resolvers: [resolve] });
    scheduleQueue();
  });
}

function scheduleQueue() {
  if (queueTimer) return;
  const wait = Math.max(0, QUEUE_INTERVAL - (Date.now() - lastReqTime));
  queueTimer = setTimeout(drainQueue, wait);
}

async function drainQueue() {
  queueTimer = null;
  if (!queue.length || activeCount >= MAX_CONCURRENT) return;

  const { bearer } = getTokens();
  if (!bearer) {
    queueTimer = setTimeout(drainQueue, 2000);
    return;
  }

  const { screenName, resolvers } = queue.shift();
  activeCount++;
  lastReqTime = Date.now();
  dbg(`Fetching location for @${screenName} (queue remaining: ${queue.length})`);

  const result = await fetchAboutAccount(screenName);

  if (result?.noToken) {
    queue.unshift({ screenName, resolvers });
    activeCount--;
    queueTimer = setTimeout(drainQueue, 2000);
    return;
  }

  if (result?.rateLimited) {
    dbg('Rate limited — backing off 60s');
    isRateLimited = true;
    resolvers.forEach(r => r({ rateLimited: true }));
    activeCount--;
    queueTimer = setTimeout(() => { isRateLimited = false; drainQueue(); }, 60000);
    return;
  }

  const country = typeof result === 'string' ? result : null;
  dbg(`@${screenName} → ${country || '(no data)'}`);
  cacheSet(screenName, country);

  resolvers.forEach(r => r({ country, source: 'api' }));
  activeCount--;
  if (queue.length) scheduleQueue();
}

// ── Location resolution ───────────────────────────────────────────

async function getLocation(screenName) {
  const entry = cacheGet(screenName);

  if (entry) {
    cacheTouchSeen(screenName);
    const age = Date.now() - (entry.queriedAt || 0);

    if (!entry.country && age < CACHE_TTL_MISS) return { country: null, source: 'cache' };
    if (!entry.country && age >= CACHE_TTL_MISS) return enqueueLocation(screenName);
    if (age < CACHE_TTL) return { country: entry.country, source: 'cache' };

    if (!staleRefreshUsedThisSession) {
      staleRefreshUsedThisSession = true;
      dbg(`Stale refresh for @${screenName}`);
      enqueueLocation(screenName);
    }
    return { country: entry.country, source: 'stale' };
  }

  return enqueueLocation(screenName);
}

// ── Auto-action REST calls ────────────────────────────────────────

async function performAction(username, action, csrf) {
  const { bearer } = getTokens();
  const endpoint = action === 'block'
    ? 'https://x.com/i/api/1.1/blocks/create.json'
    : 'https://x.com/i/api/1.1/mutes/users/create.json';

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization':         `Bearer ${bearer}`,
      'X-Csrf-Token':          csrf,
      'X-Twitter-Auth-Type':   'OAuth2Session',
      'X-Twitter-Active-User': 'yes',
      'Content-Type':          'application/x-www-form-urlencoded',
      'Referer':               'https://x.com/',
    },
    body: `screen_name=${encodeURIComponent(username)}`,
  });

  return { status: resp.status, ok: resp.ok };
}

function getQueueStatus() {
  return { queueLength: queue.length, activeCount, isRateLimited };
}
