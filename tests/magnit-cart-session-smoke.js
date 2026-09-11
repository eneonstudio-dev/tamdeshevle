const fs=require('fs');
const probe=fs.readFileSync('magnit-cart-session-probe-v1.js','utf8');
const handoff=fs.readFileSync('real-store-integration-v1.js','utf8');
for(const needle of ['TDMagnitCartSessionProbeV1','sharedRetailerSession:true','directCartRead:false','directCartWrite:false','cross_origin_cart_state_unavailable']){if(!probe.includes(needle))throw new Error(`missing probe contract: ${needle}`)}
for(const needle of ['magnit-cart-session-probe-v1.js','Одна сессия Магнита','не читает и не меняет cookie']){if(!handoff.includes(needle))throw new Error(`missing handoff contract: ${needle}`)}
console.log('Magnit cart session smoke: ok');
