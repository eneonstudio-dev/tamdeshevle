const fs=require('fs');
const ctx=fs.readFileSync('magnit-store-context-v1.js','utf8');
for(const needle of ['td:selected-store-point','shopCode','shopType','770105','Чертановская','selected_point_not_mapped','searchParams.delete("shopCode")']){if(!ctx.includes(needle))throw new Error(`magnit store context missing: ${needle}`)}
const handoff=fs.readFileSync('real-store-integration-v1.js','utf8');
for(const needle of ['magnit-store-context-v1.js','TDMagnitStoreContextV1','Точка Магнита подтверждена','без shopCode']){if(!handoff.includes(needle))throw new Error(`magnit handoff context missing: ${needle}`)}
console.log('magnit-store-context smoke: ok');