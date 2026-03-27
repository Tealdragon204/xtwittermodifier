'use strict';

// ── Auth ──────────────────────────────────────────────────────────
const FALLBACK_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// ── Query IDs ─────────────────────────────────────────────────────
// NOTE: These may rotate when Twitter redeploys. If API calls return 400,
// check DevTools Network tab for updated IDs.
const ABOUT_QUERY_ID       = 'XRqGa7EeokUU5kppkh13EA';
const ABOUT_FEATURES       = JSON.stringify({ hidden_profile_subscriptions_enabled: true });
const TWEET_RESULT_QUERY_ID = '0hWvDhmW8YQ-S_ib3azIrw';
const TWEET_RESULT_FEATURES = JSON.stringify({
  creator_subscriptions_tweet_preview_api_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: false,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
});

// ── Message type enum ─────────────────────────────────────────────
const MSG = {
  GET_LOCATION:    'GET_LOCATION',
  FETCH_TWEET:     'FETCH_TWEET',
  FETCH_VIDEO_URL: 'FETCH_VIDEO_URL',
  AUTO_ACTION:     'AUTO_ACTION',
  COMPOSITE_MEDIA: 'COMPOSITE_MEDIA',
  CONVERT_GIF:     'CONVERT_GIF',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
};

// ── Timing constants ──────────────────────────────────────────────
const CACHE_TTL       = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_TTL_MISS  =      60 * 60 * 1000;       //  1 hour
const QUEUE_INTERVAL  = 2200;                       // ms between API requests
const ACTION_INTERVAL = 8000;                       // ms between block/mute calls

// ── Country data ──────────────────────────────────────────────────
const COUNTRY_DATA = {
  // South Asia
  'India':                   { flag: '🇮🇳', region: 'South Asia' },
  'Pakistan':                { flag: '🇵🇰', region: 'South Asia' },
  'Bangladesh':              { flag: '🇧🇩', region: 'South Asia' },
  'Nepal':                   { flag: '🇳🇵', region: 'South Asia' },
  'Sri Lanka':               { flag: '🇱🇰', region: 'South Asia' },
  'Maldives':                { flag: '🇲🇻', region: 'South Asia' },
  'Bhutan':                  { flag: '🇧🇹', region: 'South Asia' },
  'Afghanistan':             { flag: '🇦🇫', region: 'South Asia' },
  // Southeast Asia
  'Indonesia':               { flag: '🇮🇩', region: 'Southeast Asia' },
  'Philippines':             { flag: '🇵🇭', region: 'Southeast Asia' },
  'Vietnam':                 { flag: '🇻🇳', region: 'Southeast Asia' },
  'Thailand':                { flag: '🇹🇭', region: 'Southeast Asia' },
  'Malaysia':                { flag: '🇲🇾', region: 'Southeast Asia' },
  'Singapore':               { flag: '🇸🇬', region: 'Southeast Asia' },
  'Myanmar':                 { flag: '🇲🇲', region: 'Southeast Asia' },
  'Cambodia':                { flag: '🇰🇭', region: 'Southeast Asia' },
  'Laos':                    { flag: '🇱🇦', region: 'Southeast Asia' },
  'Brunei':                  { flag: '🇧🇳', region: 'Southeast Asia' },
  'Timor-Leste':             { flag: '🇹🇱', region: 'Southeast Asia' },
  // East Asia
  'China':                   { flag: '🇨🇳', region: 'East Asia' },
  'Japan':                   { flag: '🇯🇵', region: 'East Asia' },
  'South Korea':             { flag: '🇰🇷', region: 'East Asia' },
  'North Korea':             { flag: '🇰🇵', region: 'East Asia' },
  'Taiwan':                  { flag: '🇹🇼', region: 'East Asia' },
  'Mongolia':                { flag: '🇲🇳', region: 'East Asia' },
  'Hong Kong':               { flag: '🇭🇰', region: 'East Asia' },
  'Macau':                   { flag: '🇲🇴', region: 'East Asia' },
  // West Africa
  'Nigeria':                 { flag: '🇳🇬', region: 'West Africa' },
  'Ghana':                   { flag: '🇬🇭', region: 'West Africa' },
  'Senegal':                 { flag: '🇸🇳', region: 'West Africa' },
  "Côte d'Ivoire":           { flag: '🇨🇮', region: 'West Africa' },
  'Mali':                    { flag: '🇲🇱', region: 'West Africa' },
  'Burkina Faso':            { flag: '🇧🇫', region: 'West Africa' },
  'Guinea':                  { flag: '🇬🇳', region: 'West Africa' },
  'Benin':                   { flag: '🇧🇯', region: 'West Africa' },
  'Togo':                    { flag: '🇹🇬', region: 'West Africa' },
  'Sierra Leone':            { flag: '🇸🇱', region: 'West Africa' },
  'Liberia':                 { flag: '🇱🇷', region: 'West Africa' },
  'Gambia':                  { flag: '🇬🇲', region: 'West Africa' },
  'Guinea-Bissau':           { flag: '🇬🇼', region: 'West Africa' },
  'Niger':                   { flag: '🇳🇪', region: 'West Africa' },
  'Cape Verde':              { flag: '🇨🇻', region: 'West Africa' },
  'Mauritania':              { flag: '🇲🇷', region: 'West Africa' },
  // East Africa
  'Kenya':                   { flag: '🇰🇪', region: 'East Africa' },
  'Ethiopia':                { flag: '🇪🇹', region: 'East Africa' },
  'Tanzania':                { flag: '🇹🇿', region: 'East Africa' },
  'Uganda':                  { flag: '🇺🇬', region: 'East Africa' },
  'Rwanda':                  { flag: '🇷🇼', region: 'East Africa' },
  'Somalia':                 { flag: '🇸🇴', region: 'East Africa' },
  'South Sudan':             { flag: '🇸🇸', region: 'East Africa' },
  'Eritrea':                 { flag: '🇪🇷', region: 'East Africa' },
  'Djibouti':                { flag: '🇩🇯', region: 'East Africa' },
  'Burundi':                 { flag: '🇧🇮', region: 'East Africa' },
  'Comoros':                 { flag: '🇰🇲', region: 'East Africa' },
  'Mauritius':               { flag: '🇲🇺', region: 'East Africa' },
  'Seychelles':              { flag: '🇸🇨', region: 'East Africa' },
  'Mozambique':              { flag: '🇲🇿', region: 'East Africa' },
  'Madagascar':              { flag: '🇲🇬', region: 'East Africa' },
  'Malawi':                  { flag: '🇲🇼', region: 'East Africa' },
  'Zambia':                  { flag: '🇿🇲', region: 'East Africa' },
  'Zimbabwe':                { flag: '🇿🇼', region: 'East Africa' },
  // North Africa
  'Egypt':                   { flag: '🇪🇬', region: 'North Africa' },
  'Libya':                   { flag: '🇱🇾', region: 'North Africa' },
  'Tunisia':                 { flag: '🇹🇳', region: 'North Africa' },
  'Algeria':                 { flag: '🇩🇿', region: 'North Africa' },
  'Morocco':                 { flag: '🇲🇦', region: 'North Africa' },
  'Sudan':                   { flag: '🇸🇩', region: 'North Africa' },
  // Southern Africa
  'South Africa':            { flag: '🇿🇦', region: 'Southern Africa' },
  'Botswana':                { flag: '🇧🇼', region: 'Southern Africa' },
  'Namibia':                 { flag: '🇳🇦', region: 'Southern Africa' },
  'Lesotho':                 { flag: '🇱🇸', region: 'Southern Africa' },
  'Eswatini':                { flag: '🇸🇿', region: 'Southern Africa' },
  'Angola':                  { flag: '🇦🇴', region: 'Southern Africa' },
  // Central Africa
  'DR Congo':                { flag: '🇨🇩', region: 'Central Africa' },
  'Republic of the Congo':   { flag: '🇨🇬', region: 'Central Africa' },
  'Cameroon':                { flag: '🇨🇲', region: 'Central Africa' },
  'Chad':                    { flag: '🇹🇩', region: 'Central Africa' },
  'Central African Republic':{ flag: '🇨🇫', region: 'Central Africa' },
  'Gabon':                   { flag: '🇬🇦', region: 'Central Africa' },
  'Equatorial Guinea':       { flag: '🇬🇶', region: 'Central Africa' },
  // Middle East
  'Saudi Arabia':            { flag: '🇸🇦', region: 'Middle East' },
  'United Arab Emirates':    { flag: '🇦🇪', region: 'Middle East' },
  'UAE':                     { flag: '🇦🇪', region: 'Middle East' },
  'Qatar':                   { flag: '🇶🇦', region: 'Middle East' },
  'Kuwait':                  { flag: '🇰🇼', region: 'Middle East' },
  'Bahrain':                 { flag: '🇧🇭', region: 'Middle East' },
  'Oman':                    { flag: '🇴🇲', region: 'Middle East' },
  'Jordan':                  { flag: '🇯🇴', region: 'Middle East' },
  'Lebanon':                 { flag: '🇱🇧', region: 'Middle East' },
  'Syria':                   { flag: '🇸🇾', region: 'Middle East' },
  'Iraq':                    { flag: '🇮🇶', region: 'Middle East' },
  'Iran':                    { flag: '🇮🇷', region: 'Middle East' },
  'Yemen':                   { flag: '🇾🇪', region: 'Middle East' },
  'Turkey':                  { flag: '🇹🇷', region: 'Middle East' },
  'Israel':                  { flag: '🇮🇱', region: 'Middle East' },
  'Palestine':               { flag: '🇵🇸', region: 'Middle East' },
  // Central Asia
  'Kazakhstan':              { flag: '🇰🇿', region: 'Central Asia' },
  'Uzbekistan':              { flag: '🇺🇿', region: 'Central Asia' },
  'Kyrgyzstan':              { flag: '🇰🇬', region: 'Central Asia' },
  'Tajikistan':              { flag: '🇹🇯', region: 'Central Asia' },
  'Turkmenistan':            { flag: '🇹🇲', region: 'Central Asia' },
  // Western Europe
  'United Kingdom':          { flag: '🇬🇧', region: 'Western Europe' },
  'France':                  { flag: '🇫🇷', region: 'Western Europe' },
  'Germany':                 { flag: '🇩🇪', region: 'Western Europe' },
  'Spain':                   { flag: '🇪🇸', region: 'Western Europe' },
  'Italy':                   { flag: '🇮🇹', region: 'Western Europe' },
  'Netherlands':             { flag: '🇳🇱', region: 'Western Europe' },
  'Belgium':                 { flag: '🇧🇪', region: 'Western Europe' },
  'Switzerland':             { flag: '🇨🇭', region: 'Western Europe' },
  'Austria':                 { flag: '🇦🇹', region: 'Western Europe' },
  'Portugal':                { flag: '🇵🇹', region: 'Western Europe' },
  'Sweden':                  { flag: '🇸🇪', region: 'Western Europe' },
  'Norway':                  { flag: '🇳🇴', region: 'Western Europe' },
  'Denmark':                 { flag: '🇩🇰', region: 'Western Europe' },
  'Finland':                 { flag: '🇫🇮', region: 'Western Europe' },
  'Ireland':                 { flag: '🇮🇪', region: 'Western Europe' },
  'Greece':                  { flag: '🇬🇷', region: 'Western Europe' },
  'Luxembourg':              { flag: '🇱🇺', region: 'Western Europe' },
  'Iceland':                 { flag: '🇮🇸', region: 'Western Europe' },
  'Malta':                   { flag: '🇲🇹', region: 'Western Europe' },
  'Cyprus':                  { flag: '🇨🇾', region: 'Western Europe' },
  // Eastern Europe
  'Russia':                  { flag: '🇷🇺', region: 'Eastern Europe' },
  'Ukraine':                 { flag: '🇺🇦', region: 'Eastern Europe' },
  'Belarus':                 { flag: '🇧🇾', region: 'Eastern Europe' },
  'Poland':                  { flag: '🇵🇱', region: 'Eastern Europe' },
  'Czech Republic':          { flag: '🇨🇿', region: 'Eastern Europe' },
  'Slovakia':                { flag: '🇸🇰', region: 'Eastern Europe' },
  'Hungary':                 { flag: '🇭🇺', region: 'Eastern Europe' },
  'Romania':                 { flag: '🇷🇴', region: 'Eastern Europe' },
  'Bulgaria':                { flag: '🇧🇬', region: 'Eastern Europe' },
  'Serbia':                  { flag: '🇷🇸', region: 'Eastern Europe' },
  'Croatia':                 { flag: '🇭🇷', region: 'Eastern Europe' },
  'Slovenia':                { flag: '🇸🇮', region: 'Eastern Europe' },
  'Bosnia and Herzegovina':  { flag: '🇧🇦', region: 'Eastern Europe' },
  'Montenegro':              { flag: '🇲🇪', region: 'Eastern Europe' },
  'North Macedonia':         { flag: '🇲🇰', region: 'Eastern Europe' },
  'Albania':                 { flag: '🇦🇱', region: 'Eastern Europe' },
  'Moldova':                 { flag: '🇲🇩', region: 'Eastern Europe' },
  'Lithuania':               { flag: '🇱🇹', region: 'Eastern Europe' },
  'Latvia':                  { flag: '🇱🇻', region: 'Eastern Europe' },
  'Estonia':                 { flag: '🇪🇪', region: 'Eastern Europe' },
  'Kosovo':                  { flag: '🇽🇰', region: 'Eastern Europe' },
  // North America
  'United States':           { flag: '🇺🇸', region: 'North America' },
  'Canada':                  { flag: '🇨🇦', region: 'North America' },
  'Mexico':                  { flag: '🇲🇽', region: 'North America' },
  // Latin America
  'Brazil':                  { flag: '🇧🇷', region: 'Latin America' },
  'Argentina':               { flag: '🇦🇷', region: 'Latin America' },
  'Colombia':                { flag: '🇨🇴', region: 'Latin America' },
  'Chile':                   { flag: '🇨🇱', region: 'Latin America' },
  'Peru':                    { flag: '🇵🇪', region: 'Latin America' },
  'Venezuela':               { flag: '🇻🇪', region: 'Latin America' },
  'Ecuador':                 { flag: '🇪🇨', region: 'Latin America' },
  'Bolivia':                 { flag: '🇧🇴', region: 'Latin America' },
  'Paraguay':                { flag: '🇵🇾', region: 'Latin America' },
  'Uruguay':                 { flag: '🇺🇾', region: 'Latin America' },
  'Cuba':                    { flag: '🇨🇺', region: 'Latin America' },
  'Dominican Republic':      { flag: '🇩🇴', region: 'Latin America' },
  'Guatemala':               { flag: '🇬🇹', region: 'Latin America' },
  'Honduras':                { flag: '🇭🇳', region: 'Latin America' },
  'El Salvador':             { flag: '🇸🇻', region: 'Latin America' },
  'Nicaragua':               { flag: '🇳🇮', region: 'Latin America' },
  'Costa Rica':              { flag: '🇨🇷', region: 'Latin America' },
  'Panama':                  { flag: '🇵🇦', region: 'Latin America' },
  'Haiti':                   { flag: '🇭🇹', region: 'Latin America' },
  'Jamaica':                 { flag: '🇯🇲', region: 'Latin America' },
  'Trinidad and Tobago':     { flag: '🇹🇹', region: 'Latin America' },
  // Oceania
  'Australia':               { flag: '🇦🇺', region: 'Oceania' },
  'New Zealand':             { flag: '🇳🇿', region: 'Oceania' },
  'Fiji':                    { flag: '🇫🇯', region: 'Oceania' },
  'Papua New Guinea':        { flag: '🇵🇬', region: 'Oceania' },
};

// ── Default settings ──────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  // Region filter
  enabled:              true,
  displayMode:          'both',
  filterAction:         'hide',
  blockedCountries:     [],
  blockedRegions:       [],
  whitelistedAccounts:  [],
  cacheMaxSize:         512,
  autoAction:           'off',
  showToasts:           true,

  // Feed optimizer
  hideWhatsHappening:   true,
  hideWhoToFollow:      true,
  hidePremiumUpsell:    true,
  hideForYouTab:        false,
  hideExploreButton:    false,
  hideComposeArea:      false,
  hideNotificationBadge: false,

  // Engagement suppression
  disableLikes:         false,
  disableRetweets:      false,
  disableComments:      false,
  disableBookmarks:     false,
  hideEngagementCounts: false,

  // Scroll friction
  scrollFriction:       false,

  // Content filter
  blockedKeywords:      [],
  keywordAction:        'hide',
  nsfwDetection:        false,
  nsfwAction:           'blur',
  nsfwThreshold:        0.7,

  // Card downloader
  cardDefaultReplyDepth: 20,
  cardDefaultQuoteDepth: 3,
};

// ── Debug flag ────────────────────────────────────────────────────
const DEBUG = true; // set false for release
