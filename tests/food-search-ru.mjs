import assert from 'node:assert/strict';
import '../src/food-ui.js';

const translate = globalThis.VkachFoodUI.translateFoodSearch;
assert.equal(translate('Филе'), 'chicken breast');
assert.equal(translate('Куриное филе'), 'chicken breast');
assert.equal(translate('Гречка'), 'buckwheat');
assert.equal(translate('Творог'), 'cottage cheese');
assert.equal(translate('рис'), 'rice');
assert.equal(translate('Яйца'), 'egg');
assert.equal(translate('chicken breast'), 'chicken breast');
assert.equal(translate('Неизвестный продукт'), 'Неизвестный продукт');
console.log('FatSecret Russian food-name translation passed');
