(function(){
  "use strict";
  const EXTRA=[
    {id:"water",name:"Вода негазированная",pack:"5 л",emoji:"💧",base:119,tags:["вода","напитки"]},
    {id:"apple",name:"Яблоки",pack:"1 кг",emoji:"🍎",base:149,tags:["фрукты","яблоки"]},
    {id:"ham",name:"Ветчина",pack:"400 г",emoji:"🍖",base:319,tags:["мясо","ветчина","быстро"]},
    {id:"dumplings",name:"Пельмени",pack:"500 г",emoji:"🥟",base:229,tags:["быстро","без готовки","пельмени"]},
    {id:"noodles",name:"Лапша быстрого приготовления",pack:"90 г",emoji:"🍜",base:49,tags:["быстро","перекус","лапша"]},
    {id:"waffles",name:"Вафли",pack:"200 г",emoji:"🧇",base:99,tags:["перекус","сладкое"]},
    {id:"cottage",name:"Творог 5%",pack:"200 г",emoji:"🥣",base:149,tags:["молочка","белок","творог"]}
  ];
  const MULT={pyat:1,magnit:.92,perek:1.07,lenta:.95,dixy:.97,lavka:1.24,vprok:1.08};
  const tagMap={milk:["молочка","молоко","быстро"],bread:["хлеб","быстро"],chicken:["мясо","курица","готовить"],banana:["фрукты","бананы"],oil:["масло","готовить"],eggs:["яйца","белок","быстро"],buck:["гречка","крупа","готовить"],sour:["молочка","сметана"],sugar:["сахар"],pasta:["макароны","готовить"]};
  const catalog=()=>[...(typeof PRODUCTS!=="undefined"?PRODUCTS:[]).map(p=>({...p,base:Math.min(...Object.values(p.prices||{}).filter(Number.isFinite)),tags:tagMap[p.id]||[]})),...EXTRA];
  function quality(productId,storeId,channel="shelf"){
    const meta=window.TDPriceMeta?.get?.(productId,storeId,channel);
    if(!meta)return"ESTIMATED";
    const scoped=meta.scopeVerified===true||meta.scope_verified===true;
    if(!scoped)return"UNKNOWN";
    const assessed=window.TDDataQuality?.metaQuality?.(meta);
    const status=assessed?.status||meta.freshness||"invalid";
    if(status==="fresh")return"LIVE";
    if(status==="stale")return"RECENT";
    return"UNKNOWN";
  }
  function price(product,storeId,channel="shelf"){const source=channel==="bring"?product.bring:product.prices;const exact=source?.[storeId];if(Number.isFinite(exact))return{value:exact,quality:quality(product.id,storeId,channel)};const base=Number(product.base);return Number.isFinite(base)?{value:Math.round(base*(MULT[storeId]||1)),quality:"ESTIMATED"}:{value:null,quality:"UNKNOWN"};}
  function adapter(storeId){const store=(typeof STORES!=="undefined"?STORES:[]).find(x=>x.id===storeId);return{storeId,capabilities:{prices:true,availability:false,cart:false,pickup:false,delivery:Boolean(store?.has_bring)},searchProducts(query){const q=String(query||"").toLowerCase();return catalog().filter(p=>!q||p.name.toLowerCase().includes(q)||(p.tags||[]).some(t=>t.includes(q)));},getProduct(id){return catalog().find(p=>p.id===id)||null;},getPrice(id,channel){const product=this.getProduct(id);return product?price(product,storeId,channel):{value:null,quality:"UNKNOWN"};},getAvailability(){return{available:null,status:"UNKNOWN"};},createCart(){return{supported:false};},createPickup(){return{supported:false};},createDelivery(){return{supported:false};}};}
  window.TDStoreAdapters={adapter,catalog,quality,qualities:["LIVE","RECENT","ESTIMATED","UNKNOWN"]};
})();
