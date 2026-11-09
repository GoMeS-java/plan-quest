import assert from 'node:assert/strict';
import '../src/food.js';

const model = globalThis.VkachFood;
const storage = new Map();
const tx = {
  get(path) { return structuredClone(storage.get(path)); },
  set(path, row) { storage.set(path, structuredClone(row)); },
  delete(path) { storage.delete(path); },
};
const read = group => [...storage].filter(([path]) => path.startsWith(model.collections[group] + '/')).map(([, row]) => row);
const today = '2026-11-10', yesterday = '2026-11-09';
const values = { kcal: 200, protein: 0, fat: 10, carbs: 30 };
const one = { id: 'first', name: 'Тестовый продукт', grams: '50,5', base: '100', mode: 'exact', values };
const two = { ...one, id: 'second', name: 'Тестовая порция', grams: 60, mode: 'estimate', values: { kcal: 100 } };
const unknown = { ...one, id: 'unknown', mode: 'unknown' };
const draft = { id: 'meal-1', date: today, kind: 'breakfast', items: [one, two], edit: null };

assert(!model.validDate('2026-11-08'));
assert(!model.validDate('2027-02-29'));
assert(model.validDate('2028-02-29'));
assert.equal(model.position(one).grams, 50.5);
assert.equal(model.position(two).values.protein, null);
assert.equal(model.position(one).values.protein, 0);
assert.throws(() => model.position({ ...one, grams: '0' }));
assert.throws(() => model.position({ ...one, values: { kcal: 200 } }));

tx.set('days/' + today, { q: [false, true], kcal: 1500, unrelated: 123 });
tx.set('cfg/opening', { card: 7400, cash: 100 });
const breakfast = model.putDraft(tx, draft, null, 10);
const dinner = model.putDraft(tx, { ...draft, id: 'meal-2', kind: 'dinner', items: [unknown] }, null, 11);
const oldBreakfast = model.putDraft(tx, { ...draft, id: 'meal-3', date: yesterday }, null, 12);
assert.equal(read('drafts').length, 3);
assert.equal(read('meals').length, 0);
assert.throws(() => model.putDraft(tx, draft, null, 13), { code: 'record_changed' });
model.setComplete(tx, today, true, 14);
const saved = model.finishMeal(tx, breakfast, 15);
assert.deepEqual(model.finishMeal(tx, breakfast, 15), saved);
assert.equal(read('drafts').length, 2);
assert.equal(read('meals').length, 1);
assert.equal(read('events').length, 1);
assert.equal(model.suggestedCalories(saved.items), 161);
assert.deepEqual(model.read({
  'food-meals/meal-1': { d: saved },
  'food-meals/damaged': { d: { ...saved, items: null } },
  'food-meals/future': { d: { ...saved, version: 2 } },
}, 'meals'), [saved]);
assert.deepEqual(model.totals(saved.items).metrics.protein, { known: 1, missing: 1, sum: 0 });
assert.equal(read('days')[0].complete, false);

const savedDinner = model.finishMeal(tx, dinner, 16);
assert.equal(model.suggestedCalories([...saved.items, ...savedDinner.items]), null);
assert.equal(model.suggestedCalories([]), null);
assert.equal(model.suggestedCalories([model.position({ ...one, values: { ...values, kcal: 0 } })]), 0);
assert.deepEqual(model.totals(savedDinner.items).counts, { exact: 0, estimate: 0, unknown: 1 });

const edit = model.putDraft(tx, {
  ...draft, edit: { id: saved.id, updated: saved.updated }, items: [{ ...one, grams: 75 }, two],
}, null, 17);
const edited = model.finishMeal(tx, edit, 18);
assert.equal(model.suggestedCalories(edited.items), 210);
assert.equal(read('events').at(-1).action, 'portion');
const deleted = model.setDeleted(tx, edited, true, 19);
assert.throws(() => model.setDeleted(tx, edited, false, 20), { code: 'record_changed' });
assert.equal(model.setDeleted(tx, deleted, false, 20).deleted, false);
assert.deepEqual(read('events').map(row => row.action), ['create', 'create', 'portion', 'delete', 'restore']);
model.finishMeal(tx, oldBreakfast, 21);
assert.equal(read('meals').find(row => row.id === 'meal-3').date, yesterday);

const input = { id: 'product', type: 'product', name: 'Тестовый продукт', base: 100, values };
let product = model.saveCatalog(tx, input, null, 22);
product = model.favorite(tx, product, 23);
assert(product.favorite);
const cookedInput = { id: 'recipe', type: 'recipe', name: 'Тестовый рецепт', recipeMode: 'cooked', base: 200, ingredients: [one, two] };
const cooked = model.saveCatalog(tx, cookedInput, null, 24);
assert.equal(model.recipe([one, two], 'simple').base, 110.5);
assert.equal(cooked.values.kcal, 161);
assert.equal(cooked.values.protein, null);
assert(cooked.estimated);
assert.equal(model.recipe([one], 'simple').values.kcal, 101);
assert.equal(model.recipe([one, unknown], 'cooked', 100).values.kcal, null);
assert.equal(model.recipe([one, unknown], 'cooked', 100, { kcal: 180 }).values.kcal, 180);
assert.throws(() => model.recipe([one], 'cooked', 0));
assert.throws(() => model.recipe([one], 'cooked', 'Infinity'));
assert.throws(() => model.recipe([{ ...one, grams: 0 }], 'simple'));
assert.equal(model.recipe([one, two], 'cooked', 200, { protein: 0 }).values.protein, 0);
const recipeDraft = model.putDraft(tx, {
  id: 'meal-4', date: today, kind: 'lunch', items: [{ ...model.fromCatalog(cooked), grams: 50 }],
}, null, 25);
const recipeMeal = model.finishMeal(tx, recipeDraft, 26);
assert.equal(model.suggestedCalories(recipeMeal.items), 40.25);
const recents = read('catalog').find(row => row.id === 'recipe');
assert.equal(model.fromCatalog(recents).grams, 50);
const revised = model.saveCatalog(tx, { ...cookedInput, base: 100 }, recents, 27);
assert.equal(model.portion(model.fromCatalog(revised), 'kcal'), 80.5);
assert.equal(revised.lastGrams, 50);
assert.equal(model.suggestedCalories(read('meals').find(row => row.id === recipeMeal.id).items), 40.25);
assert.deepEqual(tx.get('days/' + today), { q: [false, true], kcal: 1500, unrelated: 123 });
assert.deepEqual(tx.get('cfg/opening'), { card: 7400, cash: 100 });
assert.deepEqual(read('settings'), []);
assert.throws(() => model.setGoal(tx, '2500.5'));
assert.throws(() => model.setGoal(tx, '0'));
assert.equal(model.setGoal(tx, '2600', 30).kcal, 2600);
assert.equal(read('settings')[0].kcal, 2600);
assert.equal(tx.get('days/' + today).kcal, 1500);
console.log('Food model: dates, portions, unknowns, draft conflicts, duplicate protection, edits, deletion, favorites and recipes');
