const fs=require('fs');
const flow=fs.readFileSync('continue-in-stores-v1.js','utf8');
const checkout=fs.readFileSync('bai-checkout.js','utf8');
for(const needle of ['Продолжить в магазинах','TDContinueInStoresV1','data-store-id','td:continue-stores-progress:v1','data-store-progress','Добавил товар','Прогресс — твоя отметка'])if(!flow.includes(needle))throw new Error('missing flow contract: '+needle);
for(const needle of ['continue-in-stores-v1.js','data-bai-continue-stores','Продолжить в магазинах →'])if(!checkout.includes(needle))throw new Error('missing checkout wiring: '+needle);
if(checkout.includes('data-bai-retailer='))throw new Error('legacy per-retailer checkout buttons still exposed');
if(!flow.includes('v.signature===signature()'))throw new Error('progress must reset when basket signature changes');
console.log('continue-in-stores progress smoke: ok');