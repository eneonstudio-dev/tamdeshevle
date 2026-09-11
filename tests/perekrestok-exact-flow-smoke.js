const fs=require('fs');
const flow=fs.readFileSync('perekrestok-product-flow-v1.js','utf8');
const handoff=fs.readFileSync('real-store-integration-v1.js','utf8');
for(const token of ['TDPerekrestokProductFlowV1','official_product_url','publicCartDeepLink:false','openAll','/cat\\/\\d+\\/p\\/'])if(!flow.includes(token))throw new Error('missing flow token: '+token);
for(const token of ['perekrestok-product-flow-v1.js','Точные карточки Перекрёстка','Открыть точные товары','TDPerekrestokProductFlowV1','Официальный поиск магазина'])if(!handoff.includes(token))throw new Error('missing handoff token: '+token);
console.log('Perekrestok exact flow smoke: ok');
