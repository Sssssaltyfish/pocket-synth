// Public code assets only. Tool calls and user data keep their existing auth.
const originMeta = '<meta name="pocket-synth-asset-origin" content="">';

export function assetOrigin(request, configured) {
  const url = new URL(configured || request.url);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('POCKET_SYNTH_ASSET_ORIGIN must be HTTPS (HTTP loopback is allowed for local development).');
  }
  return url.origin;
}

export function htmlWithAssetOrigin(html, origin) {
  const escaped = origin.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return html.replace(originMeta, () => `<meta name="pocket-synth-asset-origin" content="${escaped}">`);
}

export function resourceWithAssets(resource, origin, uri = resource.uri) {
  return {...resource, uri, _meta: {
    ...resource._meta,
    ui: {...resource._meta.ui, csp: {connectDomains: [origin], resourceDomains: [origin]}},
    'openai/widgetCSP': {connect_domains: [origin], resource_domains: [origin]},
  }};
}

export function serveWorklet(request, sources) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/worklets/')) return null;
  const headers = {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
  if (!Object.hasOwn(sources, path)) return new Response(null, {status: 404, headers});
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, {status: 405, headers: {...headers, Allow: 'GET, HEAD, OPTIONS'}});
  }
  headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  return new Response(request.method === 'HEAD' ? null : sources[path], {headers});
}
