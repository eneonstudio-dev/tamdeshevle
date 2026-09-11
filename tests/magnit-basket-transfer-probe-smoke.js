const fs=require('fs');
const probe=fs.readFileSync('magnit-basket-transfer-probe-v2.js','utf8');
for(const needle of ['publicCartDeepLink:false','bulkProductOpen:true','no_verified_public_cart_deeplink','openAll','TDMagnitBasketTransferProbeV2']){if(!probe.includes(needle))throw new Error(`magnit basket probe missing: ${needle}`)}
const handoff=fs.readFileSync('real-store-integration-v1.js','utf8');
for(const needle of ['magnit-basket-transfer-probe-v2.js','data-open-all','Открыть точные товары','добавлено вручную','Публичный стабильный deep-link']){if(!handoff.includes(needle))throw new Error(`magnit basket handoff missing: ${needle}`)}
if(handoff.includes('data-open-item'))throw new Error('opening a product must not auto-mark it as transferred');
console.log('magnit basket transfer probe v2 smoke: ok');
