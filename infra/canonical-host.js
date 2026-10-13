// CloudFront Function (viewer request) that moves visitors from the old
// nphunter.gg domain to nphunter.net, keeping the path and query string.
// Other hosts, including the distribution's cloudfront.net name used by the
// deploy smoke test, pass through unchanged.
function handler(event) {
  const request = event.request;
  if (request.headers.host.value !== 'nphunter.gg') return request;

  const pairs = [];
  for (const name in request.querystring) {
    const param = request.querystring[name];
    // The CloudFront runtime does not support for...of.
    (param.multiValue || [param]).forEach(item => pairs.push(`${name}=${item.value}`));
  }
  const query = pairs.length ? `?${pairs.join('&')}` : '';

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: `https://nphunter.net${request.uri}${query}` },
      // Bound how long browsers keep the redirect, in case it ever needs to be undone.
      'cache-control': { value: 'max-age=300' },
    },
  };
}
