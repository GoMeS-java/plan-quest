/* Vkach FatSecret proxy for Cloudflare Workers Free.
 * Configure FATSECRET_CONSUMER_KEY and FATSECRET_CONSUMER_SECRET as Worker Secrets.
 * Never put these credentials in the PWA or commit their values.
 */
const ALLOWED_ORIGIN = 'https://gomes-java.github.io';
const API = 'https://platform.fatsecret.com/rest/server.api';

function reply(body, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store',
      'vary': 'Origin'
    }
  });
}

async function fatsecret(env, method, params) {
  if (!env.FATSECRET_CONSUMER_KEY || !env.FATSECRET_CONSUMER_SECRET) throw new Error('not_configured');
  const percent = value => encodeURIComponent(String(value)).replace(/[!'()*]/g, char =>
    '%' + char.charCodeAt(0).toString(16).toUpperCase());
  const values = {
    method, format: 'json', ...params,
    oauth_consumer_key: env.FATSECRET_CONSUMER_KEY,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_nonce: crypto.randomUUID().replaceAll('-', ''),
    oauth_version: '1.0'
  };
  const normalized = Object.keys(values).sort().map(key => percent(key) + '=' + percent(values[key])).join('&');
  const base = 'GET&' + percent(API) + '&' + percent(normalized);
  const secret = new TextEncoder().encode(percent(env.FATSECRET_CONSUMER_SECRET) + '&');
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  const signature = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const query = new URLSearchParams({ ...values, oauth_signature: signature });
  const response = await fetch(API + '?' + query);
  if (!response.ok) throw new Error('fatsecret_' + response.status);
  const data = await response.json();
  if (data.error) throw new Error('fatsecret_' + (data.error.code || 'error'));
  return data;
}

const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
function portion(row) {
  const amount = Number(row.metric_serving_amount || 0);
  const unit = row.metric_serving_unit || '';
  const size = amount > 0 && unit === 'g' ? amount : null;
  return {
    id: String(row.serving_id || ''), label: String(row.serving_description || ''), grams: size,
    kcal: row.calories == null ? null : Number(row.calories),
    protein: row.protein == null ? null : Number(row.protein),
    fat: row.fat == null ? null : Number(row.fat),
    carbs: row.carbohydrate == null ? null : Number(row.carbohydrate)
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin');
    // CORS is not authentication; Cloudflare rate limits should be added before broad public use.
    if (origin !== ALLOWED_ORIGIN) return reply({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS') return reply({ ok: true });
    if (request.method !== 'GET') return reply({ error: 'method_not_allowed' }, 405);
    const url = new URL(request.url);
    try {
      if (url.pathname === '/search') {
        const term = (url.searchParams.get('q') || '').trim();
        if (term.length < 2 || term.length > 80) return reply({ error: 'query_length' }, 400);
        const result = await fatsecret(env, 'foods.search', { search_expression: term, max_results: '15' });
        return reply({ foods: array(result.foods?.food).map(item => ({
          id: String(item.food_id || ''), name: String(item.food_name || ''),
          brand: String(item.brand_name || ''), description: String(item.food_description || '')
        })).filter(item => item.id && item.name) });
      }
      if (url.pathname === '/food') {
        const id = url.searchParams.get('id') || '';
        if (!/^\d{1,18}$/.test(id)) return reply({ error: 'food_id' }, 400);
        const result = await fatsecret(env, 'food.get.v4', { food_id: id });
        const food = result.food;
        if (!food) return reply({ error: 'not_found' }, 404);
        return reply({ food: { id, name: String(food.food_name || ''), brand: String(food.brand_name || ''),
          servings: array(food.servings?.serving).map(portion) } });
      }
      return reply({ error: 'not_found' }, 404);
    } catch (error) {
      // Safe diagnostic codes only: no response body, secret, or access token reaches the browser.
      const code = String(error.message || '');
      const safe = code === 'not_configured' || /^fatsecret_\d{3}$/.test(code) ||
        /^fatsecret_\d+$/.test(code);
      return reply({ error: safe ? code : 'network_unavailable' }, 502);
    }
  }
};
