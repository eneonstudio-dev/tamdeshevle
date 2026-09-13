import {exportTraining} from '../firewall.mjs';

const SYSTEM='Ты Bai Shopping Brain. Верни только структурированное shopping-решение в JSON. Не выдумывай цену, наличие, магазин, состав или качество. Hard constraints важнее soft preferences.';
const clean=v=>String(v??'').trim();

export function prepareSft(rows,registry){
  const eligible=exportTraining(Array.isArray(rows)?rows:[],registry);
  return eligible.map(row=>({
    id:row.id,
    messages:[
      {role:'system',content:SYSTEM},
      {role:'user',content:JSON.stringify({user_request:clean(row.user_request),session_context:row.session_context||{}})},
      {role:'assistant',content:JSON.stringify(row.target)}
    ],
    metadata:{language:row.language,provenance:row.provenance}
  }));
}

export function renderSftJsonl(rows,registry){return prepareSft(rows,registry).map(x=>JSON.stringify(x)).join('\n')+'\n'}
