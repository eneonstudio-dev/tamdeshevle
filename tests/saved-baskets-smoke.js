const fs=require('fs');
const src=fs.readFileSync('saved-baskets.js','utf8');
const must=[
  'td:saved-baskets:v1',
  'const KEY="td:saved-baskets:v1",MAX=5',
  'RESTORE_SAVED_BASKET',
  'TDShoppingOptimizer.optimize',
  'Повторить покупку',
  'Сохранить эту корзину'
];
for(const token of must){if(!src.includes(token)){console.error('Missing saved baskets contract:',token);process.exit(1)}}
console.log('Saved baskets smoke: OK');