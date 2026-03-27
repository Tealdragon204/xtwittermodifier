'use strict';

function dbg(...args) {
  if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[XOpt]', ...args);
}

function decodeEntities(str) {
  const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
  return str.replace(/&(?:amp|lt|gt|quot|#39);/g, m => map[m] || m);
}

function extractTweetText(tweetNode) {
  const note = tweetNode?.note_tweet?.note_tweet_results?.result?.text;
  const raw = note || tweetNode?.legacy?.full_text || '';
  return decodeEntities(
    raw.replace(/https:\/\/t\.co\/\S+/g, '')
       .replace(/^(@\w+\s*)+/, '')
       .trim()
  );
}

function extractImages(tweetResult) {
  if (!tweetResult) return [];
  const legacy = tweetResult.legacy ?? {};
  const media  = legacy.extended_entities?.media ?? legacy.entities?.media ?? [];
  return media.filter(m => m.type === 'photo').map(m => m.media_url_https);
}

function extractMediaInfo(tweetResult) {
  if (!tweetResult) return [];
  const legacy = tweetResult.legacy ?? {};
  const media  = legacy.extended_entities?.media ?? legacy.entities?.media ?? [];
  return media.map(m => ({
    type:    m.type,
    url:     m.media_url_https,
    videoInfo: m.video_info || null,
  }));
}

function unwrapTweetResult(r) {
  if (!r) return null;
  if (r.__typename === 'TweetWithVisibilityResults' && r.tweet) return r.tweet;
  return r;
}

function extractTweetResult(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 20) return null;
  if (obj.__typename === 'Tweet' && obj.legacy) return obj;
  for (const v of Object.values(obj)) {
    const found = extractTweetResult(v, depth + 1);
    if (found) return found;
  }
  return null;
}
