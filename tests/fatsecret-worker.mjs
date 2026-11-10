import assert from 'node:assert/strict';
import worker from '../cloud/fatsecret-worker.js';

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  const value = String(url).includes('food.get.v4')
      ? { food: { food_name: 'Buckwheat', servings: { serving: [{ serving_id: '7',
        serving_description: '100 g', metric_serving_amount: '100', metric_serving_unit: 'g',
        calories: '343', protein: '13', fat: '3.4', carbohydrate: '71.5' }] } } }
      : { foods: { food: { food_id: '42', food_name: 'Buckwheat', food_description: '343 kcal' } } };
  return new Response(JSON.stringify(value), { status: 200 });
};
const env = { FATSECRET_CONSUMER_KEY: 'consumer', FATSECRET_CONSUMER_SECRET: 'secret' };
const endpoint = (path, origin = 'https://gomes-java.github.io') =>
  worker.fetch(new Request('https://vkach-fatsecret-api.example' + path, { headers: { origin } }), env);

try {
  assert.equal((await endpoint('/search?q=rice', 'https://evil.example')).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await endpoint('/search?q=x')).status, 400);
  const foods = await (await endpoint('/search?q=buckwheat')).json();
  assert.deepEqual(foods.foods, [{ id: '42', name: 'Buckwheat', brand: '', description: '343 kcal' }]);
  const food = await (await endpoint('/food?id=42')).json();
  assert.equal(food.food.servings[0].kcal, 343);
  assert.equal(food.food.servings[0].grams, 100);
  assert.equal(calls.filter(call => call.url.includes('connect/token')).length, 0);
  for (const call of calls) {
    const signed = new URL(call.url);
    assert.equal(signed.searchParams.get('oauth_consumer_key'), 'consumer');
    assert.equal(signed.searchParams.get('oauth_signature_method'), 'HMAC-SHA1');
    assert.ok(signed.searchParams.get('oauth_signature'));
  }
  assert.equal((await endpoint('/food?id=../../secret')).status, 400);
  console.log('FatSecret Worker: origin, input, search, details and OAuth 1.0 signing verified');
} finally { globalThis.fetch = originalFetch; }
