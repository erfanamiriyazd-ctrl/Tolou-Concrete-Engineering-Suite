'use strict';

const SAMPLE_MARKER = 'Tolou_sample_project_v1';
const PROJECT_ID = 'PRJ-DEMO-25-400';
const SERIES_ID = 'MX-DEMO-25-400';
const AGG_CASE_ID = 'AGC-DEMO-25-400';
const REVISION = 0;

const AGG_SIEVES = [100,90,80,75,63,50,45,40,37.5,31.5,25,22.4,20,19,16,14,12.5,11.2,10,9.5,8,6.3,5.6,5,4.75,4,2.36,2,1.18,1,0.6,0.3,0.25,0.15,0.075,0.063];

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function round(v, d=6) { const p=10**d; return Math.round((Number(v)+Number.EPSILON)*p)/p; }
function readJson(storage,key,fallback){ try { const x=JSON.parse(storage.getItem(key)||'null'); return x && typeof x==='object' ? x : clone(fallback); } catch { return clone(fallback); } }
function upsert(arr,item,key='id'){ const i=arr.findIndex(x=>x?.[key]===item[key]); if(i>=0) arr[i]=item; else arr.unshift(item); }
function stableObj(obj){ if(obj===null||typeof obj!=='object') return obj; if(Array.isArray(obj)) return obj.map(stableObj); return Object.keys(obj).sort().reduce((o,k)=>(o[k]=stableObj(obj[k]),o),{}); }
function fnv1a(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return ('00000000'+h.toString(16)).slice(-8); }

function logInterpolate(points, sieve, belowZero=true){
  const pts=Object.entries(points).map(([x,y])=>[Number(x),Number(y)]).sort((a,b)=>a[0]-b[0]);
  if(sieve>=pts[pts.length-1][0]) return 100;
  if(sieve<pts[0][0]) return belowZero ? 0 : pts[0][1];
  const exact=pts.find(([x])=>Math.abs(x-sieve)<1e-9); if(exact) return exact[1];
  for(let i=1;i<pts.length;i++) if(sieve<pts[i][0]){
    const [x1,y1]=pts[i-1],[x2,y2]=pts[i];
    const t=(Math.log10(sieve)-Math.log10(x1))/(Math.log10(x2)-Math.log10(x1));
    return y1+t*(y2-y1);
  }
  return 100;
}
function passingObject(points){ return Object.fromEntries(AGG_SIEVES.map(z=>[String(z),round(logInterpolate(points,z,true),2)])); }
function limitsObject(ranges){ return Object.fromEntries(AGG_SIEVES.map(z=>{const r=ranges[String(z)]; return [String(z),r?{low:r[0],high:r[1]}:{low:'',high:''}];})); }
function materialGradation(profileId,label,table,ranges,points){
  const sieves=Object.keys(ranges).map(Number).sort((a,b)=>b-a);
  return {
    standard:'INSO 302:1399',
    sieves,
    passing:sieves.map(z=>points[String(z)]),
    low:sieves.map(z=>ranges[String(z)][0]),
    high:sieves.map(z=>ranges[String(z)][1]),
    standardProfile:{profileId,label,standard:'INSO 302:1399',table},
    savedAt:'2026-05-20T09:00:00+03:30'
  };
}

const fineRanges={'9.5':[100,100],'4.75':[95,100],'2.36':[80,100],'1.18':[50,85],'0.6':[25,60],'0.3':[5,30],'0.15':[0,10],'0.075':[0,3]};
const finePoints={'9.5':100,'4.75':97.5,'2.36':90,'1.18':67.5,'0.6':42.5,'0.3':17.5,'0.15':5,'0.075':1.5};
const peaRanges={'19':[100,100],'12.5':[90,100],'9.5':[40,70],'4.75':[0,15],'2.36':[0,5]};
const peaPoints={'19':100,'12.5':95,'9.5':55,'4.75':7.5,'2.36':2.5};
const almondRanges={'37.5':[100,100],'25':[90,100],'19':[20,55],'12.5':[0,10],'9.5':[0,5]};
const almondPoints={'37.5':100,'25':95,'19':37.5,'12.5':5,'9.5':2.5};

const materialIds={cement:'MAT-DEMO-CEM-II',water:'MAT-DEMO-WATER',fine:'MAT-DEMO-SAND',pea:'MAT-DEMO-PEA',almond:'MAT-DEMO-ALMOND'};
const materialCodes={cement:'CEM-DEM-02',water:'WAT-DEM-01',fine:'FA-DEM-01',pea:'CA-DEM-07',almond:'CA-DEM-05'};

function makeMaterial(id,code,category,name,props,extra={}){
  const createdAt='2026-05-20T09:00:00+03:30';
  return {id,code,category,currentRevision:1,archived:false,createdAt,updatedAt:createdAt,revisions:[{revision:1,name,manufacturer:extra.manufacturer||'',supplier:extra.supplier||'',source:extra.source||'',standard:extra.standard||'',lot:extra.lot||'',testDate:extra.testDate||'2026-05-18',notes:extra.notes||'داده فرضی کنترل‌شده برای پروژه نمونه QA؛ برای پروژه واقعی باید با نتایج آزمایشگاهی واقعی جایگزین شود.',properties:props,createdAt}]};
}

const materials=[
  makeMaterial(materialIds.cement,materialCodes.cement,'cement','سیمان پرتلند تیپ II — کارخانه کویر (فرضی)',{density:3150,specificGravity:3.15,cementType:'II',cementStrengthClass:'42.5',scmType:'',absorption:null,moisture:null,dmax:null,particleShape:'',surfaceTexture:'',fm:null,roddedUnitWeight:null,admixtureType:'',dosage:null,dosageUnit:'%',fiberType:'',length:null,diameter:null,tensileStrength:null,elasticModulus:null},{manufacturer:'سیمان کویر مرکزی (فرضی)',supplier:'بازرگانی پایدار سازه (فرضی)',source:'سیلوی شماره ۲ — بچینگ نمونه',standard:'استاندارد ملی مرتبط با سیمان پرتلند تیپ II — داده QA',lot:'CII-260518-A'}),
  makeMaterial(materialIds.water,materialCodes.water,'water','آب اختلاط شبکه کارگاه نمونه',{density:1000,specificGravity:1,cementType:'',cementStrengthClass:'',scmType:'',absorption:null,moisture:null,dmax:null,particleShape:'',surfaceTexture:'',fm:null,roddedUnitWeight:null,admixtureType:'',dosage:null,dosageUnit:'%',fiberType:'',length:null,diameter:null,tensileStrength:null,elasticModulus:null},{supplier:'تأسیسات کارگاه نمونه',source:'مخزن آب تصفیه‌شده',standard:'آب مناسب ساخت بتن — داده QA',lot:'W-2605'}),
  makeMaterial(materialIds.fine,materialCodes.fine,'fine_aggregate','ماسه شسته رودخانه‌ای 0–4.75 mm (فرضی)',{density:2640,specificGravity:2.64,cementType:'',cementStrengthClass:'',scmType:'',absorption:1.5,moisture:3.5,dmax:4.75,particleShape:'rounded',surfaceTexture:'smooth',fm:2.80,roddedUnitWeight:null,admixtureType:'',dosage:null,dosageUnit:'%',fiberType:'',length:null,diameter:null,tensileStrength:null,elasticModulus:null,gradation:materialGradation('inso_fine_1','INSO 302 — ریزدانه جدول 1','Table 1',fineRanges,finePoints)},{supplier:'معدن آفتاب شرق (فرضی)',source:'دپو ماسه شسته A',standard:'INSO 302:1399',lot:'FA-260520'}),
  makeMaterial(materialIds.pea,materialCodes.pea,'coarse_aggregate','شن نخودی 4.75–12.5 mm (فرضی)',{density:2660,specificGravity:2.66,cementType:'',cementStrengthClass:'',scmType:'',absorption:1.0,moisture:1.5,dmax:12.5,particleShape:'rounded',surfaceTexture:'rough',fm:null,roddedUnitWeight:1610,admixtureType:'',dosage:null,dosageUnit:'%',fiberType:'',length:null,diameter:null,tensileStrength:null,elasticModulus:null,gradation:materialGradation('inso_c7','INSO 302 — سنگدانه درشت رده 7','Table 3',peaRanges,peaPoints)},{supplier:'معدن آفتاب شرق (فرضی)',source:'دپو شن نخودی B',standard:'INSO 302:1399',lot:'CA7-260520'}),
  makeMaterial(materialIds.almond,materialCodes.almond,'coarse_aggregate','شن بادامی 12.5–25 mm (فرضی)',{density:2680,specificGravity:2.68,cementType:'',cementStrengthClass:'',scmType:'',absorption:0.8,moisture:1.2,dmax:25,particleShape:'angular',surfaceTexture:'rough',fm:null,roddedUnitWeight:1630,admixtureType:'',dosage:null,dosageUnit:'%',fiberType:'',length:null,diameter:null,tensileStrength:null,elasticModulus:null,gradation:materialGradation('inso_c5','INSO 302 — سنگدانه درشت رده 5','Table 3',almondRanges,almondPoints)},{supplier:'معدن آفتاب شرق (فرضی)',source:'دپو شن بادامی C',standard:'INSO 302:1399',lot:'CA5-260520'})
];

const massWeights=[0.445,0.35,0.205], sgs=[2.64,2.66,2.68];
const volumeRaw=massWeights.map((w,i)=>w/sgs[i]);
const volumeSum=volumeRaw.reduce((a,b)=>a+b,0);
const volumeFractions=volumeRaw.map(v=>v/volumeSum);
const aggregateSources=[
  {id:'AGS-DEMO-SAND',name:'ماسه شسته رودخانه‌ای 0–4.75 mm (فرضی)',kind:'fine',dmax:4.75,materialId:materialIds.fine,materialRevision:1,weight:44.5,min:40,max:50,locked:false,sg:2.64,particleShape:'rounded',surfaceTexture:'smooth',standardProfile:{profileId:'inso_fine_1',label:'INSO 302 — ریزدانه جدول 1',standard:'INSO 302:1399',table:'Table 1'},passing:passingObject(finePoints),limits:limitsObject(fineRanges)},
  {id:'AGS-DEMO-PEA',name:'شن نخودی 4.75–12.5 mm (فرضی)',kind:'coarse',dmax:12.5,materialId:materialIds.pea,materialRevision:1,weight:35,min:25,max:40,locked:false,sg:2.66,particleShape:'rounded',surfaceTexture:'rough',standardProfile:{profileId:'inso_c7',label:'INSO 302 — سنگدانه درشت رده 7',standard:'INSO 302:1399',table:'Table 3'},passing:passingObject(peaPoints),limits:limitsObject(peaRanges)},
  {id:'AGS-DEMO-ALMOND',name:'شن بادامی 12.5–25 mm (فرضی)',kind:'coarse',dmax:25,materialId:materialIds.almond,materialRevision:1,weight:20.5,min:15,max:30,locked:false,sg:2.68,particleShape:'angular',surfaceTexture:'rough',standardProfile:{profileId:'inso_c5',label:'INSO 302 — سنگدانه درشت رده 5',standard:'INSO 302:1399',table:'Table 3'},passing:passingObject(almondPoints),limits:limitsObject(almondRanges)}
];

const IR25={s:[.15,.3,.6,1.18,2.36,4.75,9.5,19,25],B:[4.5,9.5,16.5,24.5,35,50,67,90,100]};
function iranTarget(z){ if(z<IR25.s[0]||z>25)return null;if(z>=25)return 100;const ex=IR25.s.findIndex(x=>Math.abs(x-z)<1e-9);if(ex>=0)return IR25.B[ex];for(let i=1;i<IR25.s.length;i++)if(z<=IR25.s[i]){const t=(Math.log10(z)-Math.log10(IR25.s[i-1]))/(Math.log10(IR25.s[i])-Math.log10(IR25.s[i-1]));return IR25.B[i-1]+t*(IR25.B[i]-IR25.B[i-1]);}return null; }
function fineFM(){ const zs=[4.75,2.36,1.18,.6,.3,.15]; return zs.reduce((s,z)=>s+(100-aggregateSources[0].passing[String(z)]),0)/100; }
function blendSG(){ return 1/massWeights.reduce((s,w,i)=>s+w/sgs[i],0); }
function buildAggregateResult(){
  const sieves=AGG_SIEVES.filter(z=>Number.isFinite(iranTarget(z)));
  const combined=sieves.map(z=>aggregateSources.reduce((s,a,i)=>s+volumeFractions[i]*Number(a.passing[String(z)]),0));
  const target=sieves.map(iranTarget); const deviation=combined.map((v,i)=>v-target[i]); const ipr=combined.map((v,i)=>i===0?100-v:combined[i-1]-v);
  const idx=z=>sieves.findIndex(x=>Math.abs(x-z)<1e-8), p95=combined[idx(9.5)], p236=combined[idx(2.36)];
  const cf=(100-p95)/(100-p236)*100; const wf=p236+2.5*((400*1.68555)-564)/94;
  const sg=blendSG(), packing=1680/(sg*1000)*100, voids=100-packing;
  const rmse=Math.sqrt(combined.reduce((s,v,i)=>s+(v-target[i])**2,0)/combined.length);
  let nationalAcc=0;[37.5,19,9.5,4.75,2.36,1.18,.6,.3,.15].forEach(z=>{let p=z>=25?100:aggregateSources.reduce((s,a,i)=>s+volumeFractions[i]*Number(a.passing[String(z)]),0);nationalAcc+=100-p;});
  return {sieves,combined:combined.map(v=>round(v,4)),target:target.map(v=>round(v,4)),deviation:deviation.map(v=>round(v,4)),ipr:ipr.map(v=>round(v,4)),metrics:{fm:round(fineFM(),3),nationalFm:round(nationalAcc/100,3),cf:round(cf,3),wf:round(wf,3),sg:round(sg,5),packing:round(packing,3),voids:round(voids,3),rmse:round(rmse,3)},envelope:{low:sieves.map(()=>null),high:sieves.map(()=>null),valid:sieves.map(()=>false),hasAny:false,basis:'volume'},blendBasis:'volume',massFractions:massWeights,volumeFractions:volumeFractions.map(v=>round(v,8)),targetMeta:{profileId:'IR_NMD_479_1388',ruleId:'IR479_4_2_GRADING',section:'4-2',figure:'4-4',dmax:25,curve:'B',sourceType:'digitized-figure',digitizationUncertaintyPct:1,basis:'volume'},calculatedAt:'2026-05-22T10:15:00+03:30'};
}
const aggregateResult=buildAggregateResult();
const aggregateCurrent={name:'ترکیب سه‌جزئی استاندارد — پروژه نمونه 25/400',dmax:25,exponent:.45,targetMode:'iran479',iranCurve:'B',cementitious:400,measuredDRUW:1680,notes:'سه منبع سنگدانه با درصد عبوری دقیقاً در وسط حدود کنترل INSO 302 روی الک‌های استاندارد. سهم‌های ترکیب برای نزدیک‌شدن به منحنی B روش ملی تنظیم شده‌اند.',sources:aggregateSources,lastResult:aggregateResult};
const aggregateCase={id:AGG_CASE_ID,projectId:PROJECT_ID,name:aggregateCurrent.name,createdAt:'2026-05-22T10:15:00+03:30',snapshot:clone(aggregateCurrent),metrics:clone(aggregateResult.metrics)};

const cement=400, effectiveWater=190, airPct=2;
const aggVol=1-cement/3150-effectiveWater/1000-airPct/100;
const totalAgg=aggVol/massWeights.reduce((s,w,i)=>s+w/(sgs[i]*1000),0);
const ssdMasses=massWeights.map(w=>totalAgg*w);
const absPct=[1.5,1.0,.8], moistPct=[3.5,1.5,1.2];
const aggCalc=ssdMasses.map((ssd,i)=>{const A=absPct[i]/100,M=moistPct[i]/100,od=ssd/(1+A),batch=od*(1+M),freeWater=batch-ssd;return{ssd,od,batch,freeWater,volume:ssd/(sgs[i]*1000)};});
const freeWaterTotal=aggCalc.reduce((s,x)=>s+x.freeWater,0), batchWater=effectiveWater-freeWaterTotal;
const totalWeight=cement+batchWater+aggCalc.reduce((s,x)=>s+x.batch,0);

const materialBindings={
  cement:{materialId:materialIds.cement,code:materialCodes.cement,revision:1,name:materials[0].revisions[0].name,manufacturer:materials[0].revisions[0].manufacturer,supplier:materials[0].revisions[0].supplier,source:materials[0].revisions[0].source,standard:materials[0].revisions[0].standard,properties:clone(materials[0].revisions[0].properties)},
  water:{materialId:materialIds.water,code:materialCodes.water,revision:1,name:materials[1].revisions[0].name,manufacturer:'',supplier:materials[1].revisions[0].supplier,source:materials[1].revisions[0].source,standard:materials[1].revisions[0].standard,properties:clone(materials[1].revisions[0].properties)}
};
const aggregateBlendBinding={id:AGG_CASE_ID,name:aggregateCurrent.name,createdAt:aggregateCase.createdAt,projectId:PROJECT_ID,projectCode:'TL-DEMO-25-400',metrics:clone(aggregateResult.metrics),dmax:25,targetMode:'iran479',iranCurve:'B',blendBasis:'volume',targetMeta:clone(aggregateResult.targetMeta),result:clone(aggregateResult),modified:false,appliedAt:'2026-05-22T10:20:00+03:30',sourceRevisions:aggregateSources.map((s,i)=>({materialId:s.materialId,code:[materialCodes.fine,materialCodes.pea,materialCodes.almond][i],revision:1,standardProfile:clone(s.standardProfile)}))};

const snapshotAggregates=aggregateSources.map((s,i)=>({
  id:i+1,name:s.name,density:sgs[i]*1000,specificGravity:sgs[i],absorption:absPct[i],moisture:moistPct[i],dmax:s.dmax,type:s.kind,blendPct:s.weight,roddedUnitWeight:i===0?null:(i===1?1610:1630),particleShape:s.particleShape,surfaceTexture:s.surfaceTexture,materialId:s.materialId,materialCode:[materialCodes.fine,materialCodes.pea,materialCodes.almond][i],materialRevision:1,standardProfile:clone(s.standardProfile),sieves:Object.fromEntries(AGG_SIEVES.map(z=>[z,{active:true,passing:s.passing[String(z)],low:s.limits[String(z)].low,high:s.limits[String(z)].high}])),...Object.fromEntries(Object.entries(aggCalc[i]).map(([k,v])=>[k,round(v,6)]))
}));

const projectContext={id:PROJECT_ID,code:'TL-DEMO-25-400',name:'مجتمع اداری آفتاب شرق — فاز ۱ (پروژه نمونه)',designScope:'base',structureType:'building',commonSettings:{ambientTemp:25,humidity:55,transportDist:15,transportTime:30},requirements:{fc:25,slump:100,maxWcm:.50,standard:'نشریه ض-479، چاپ دوم 1388 + INSO 302:1399 (سنگدانه)',exposure:'شرایط معمول داخلی / غیرمهاجم — سناریوی QA'},baseSettings:{methodId:'iran479',standardType:'isiri',slump:100,maxAggSize:25,environment:'normal',airSystem:'non-air',iranSiteGrade:'B',iranFcClass:'25'},specialSettings:{concreteType:'scc',standardType:'aci',targetWc:null},capturedAt:'2026-05-24T11:00:00+03:30'};

const stage31={profileId:'IR_NMD_479_1388',ruleId:'IR479_3_1_STRENGTH',fc:25,sdUsed:4.5,fcm1:32.53,fcm2:31.485,fcm:32.53,workshopRank:'B',warnings:[],completeness:{complete:true,issues:[]},ruleTrace:[{id:'IR479_3_1_FCM',reference:'نشریه ض-479 — Stage 3.1'}]};
const stage32={profileId:'IR_NMD_479_1388',ruleId:'IR479_3_2_WORKABILITY',slump:{value:100,class:'متوسط'},particleShape:'mixed-average',surfaceTexture:'mixed-average',warnings:[],completeness:{complete:true,issues:[]},ruleTrace:[{id:'IR479_3_2_SLUMP',reference:'نشریه ض-479 — Stage 3.2'}]};
const stage33={profileId:'IR_NMD_479_1388',ruleId:'IR479_4_2_GRADING',dmax:25,curve:'B',fm:aggregateResult.metrics.nationalFm,blendBasis:'volume',massFractions:massWeights,volumeFractions:volumeFractions.map(v=>round(v,8)),aggregateBlendId:AGG_CASE_ID,warnings:[],completeness:{complete:true,issues:[]},ruleTrace:[{id:'IR479_4_2_GRADING',reference:'نشریه ض-479 — شکل 4-4'}]};
const stage34={profileId:'IR_NMD_479_1388',ruleId:'IR479_3_4_WATER',final:{freeWaterKgM3:190},slump:100,dmax:25,shapeTexture:'average',warnings:[],completeness:{complete:true,issues:[]},ruleTrace:[{id:'IR479_3_4_FREE_WATER',reference:'نشریه ض-479 — Stage 3.4'}]};
const stage35={profileId:'IR_NMD_479_1388',ruleId:'IR479_3_5_WC_BINDER',wcBase:.475,fc:25,fcm:32.53,final:{freeWaterKgM3:190},scm:{type:'none',kgM3:0,k:null},warnings:[],completeness:{complete:true,issues:[]},ruleTrace:[{id:'IR479_3_5_WC',reference:'نشریه ض-479 — Stage 3.5'}]};
const stage36={profileId:'IR_NMD_479_1388',ruleId:'IR479_3_6_ABSOLUTE_VOLUME',air:{totalPct:2,intentionalPct:0,unintentionalPct:2},airCorrections:{waterAdjustedKgM3:190,wcAdjusted:.475},binder:{cementKgM3:400,totalCementitiousKgM3:400,scmType:'none',scmKgM3:0},absoluteVolume:{knownM3:round(1-aggVol,8),aggregateM3:round(aggVol,8),closureM3:1},moistureCorrection:{batchWaterKgM3:round(batchWater,6),aggregateFreeWaterKgM3:round(freeWaterTotal,6),aggregateSSDTotalKgM3:round(totalAgg,6),aggregateBatchTotalKgM3:round(aggCalc.reduce((s,x)=>s+x.batch,0),6)},aggregates:snapshotAggregates.map(a=>({id:a.id,name:a.name,ssd:a.ssd,od:a.od,batch:a.batch,freeWater:a.freeWater})),warnings:[],completeness:{complete:true,issues:[]},ruleTrace:[{id:'IR479_3_6_VOLUME',reference:'نشریه ض-479 — Stage 3.6'}]};
const stage37={version:'stage3.7-integration-lock-1.0',status:'locked-for-trial',requiredPassed:8,requiredTotal:8,fingerprint:'IR479-DEMO-25-400-R0',gates:[{id:'strength',label:'Strength basis',severity:'required',ok:true},{id:'workability',label:'Workability',severity:'required',ok:true},{id:'grading',label:'Aggregate grading',severity:'required',ok:true},{id:'water',label:'Free water',severity:'required',ok:true},{id:'wc',label:'w/c',severity:'required',ok:true},{id:'air',label:'Air',severity:'required',ok:true},{id:'volume',label:'Absolute volume closure',severity:'required',ok:true},{id:'moisture',label:'SSD/moisture correction',severity:'required',ok:true}],ruleTrace:[{id:'IR479_3_7_LOCK',reference:'Tolou Stage 3.7 integration gate'}]};

const mixSnapshot={
  engineVersion:'QC010-iran479-engine-3.7-locked',designMethodId:'iran479',designMethodLabel:'روش ملی ایران — نشریه ض-479',methodProfileId:'IR_NMD_479_1388',methodRuleSetId:'RULESET_IR_479',reference:'نشریه ض-479، چاپ دوم 1388',
  inputState:{projectName:projectContext.name,structureType:'building',standardType:'isiri',cementType:'II',cementDensity:'3150',cementContent:'400',slumpTarget:'100',maxAggSize:'25',targetStrength:'25',targetWc:'0.475',finalWater:'190',airContent:'2',airSystem:'non-air',fineAggregateFM:String(round(fineFM(),2)),ambientTemp:'25',humidity:'55'},
  materialBindings:clone(materialBindings),aggregateBlendBinding:clone(aggregateBlendBinding),projectName:projectContext.name,projectLinkMode:'library',projectContext:clone(projectContext),standard:'iran479',cementType:'II',cementTypeLabel:'Type II',slump:100,dmax:25,targetStrength:25,targetWc:.475,cementDensity:3150,silicaDensity:2200,flyAshDensity:2300,slagDensity:2900,cementContent:400,silica:0,flyAsh:0,slag:0,totalCementitious:400,effectiveWater:190,batchWater:round(batchWater,6),freeWaterTotal:round(freeWaterTotal,6),finalWc:.475,wcm:.475,airContent:2,airSystem:'nonair',airExposure:'iran479',fineFM:round(fineFM(),3),knownVolume:round(1-aggVol,8),aggregateVolume:round(aggVol,8),volumeClosure:1,aggregateSSDTotal:round(totalAgg,6),aggregateBatchTotal:round(aggCalc.reduce((s,x)=>s+x.batch,0),6),totalWeight:round(totalWeight,6),iranNational:{stage31,stage32,stage33,stage34,stage35,stage36,stage37},integrationAudit:stage37,validationStatus:'locked-for-trial',calculationFingerprint:stage37.fingerprint,ruleTrace:[{id:'IR479_3_1_FCM',reference:'نشریه ض-479 Stage 3.1'},{id:'IR479_4_2_GRADING',reference:'نشریه ض-479 شکل 4-4'},{id:'IR479_3_4_FREE_WATER',reference:'نشریه ض-479 Stage 3.4'},{id:'IR479_3_5_WC',reference:'نشریه ض-479 Stage 3.5'},{id:'IR479_3_6_VOLUME',reference:'نشریه ض-479 Stage 3.6'},{id:'IR479_3_7_LOCK',reference:'Tolou Stage 3.7'}],aggregates:clone(snapshotAggregates),admixtures:[],fibers:[],timestamp:'2026-05-24T11:00:00+03:30'
};

function makeTrial(i,date,water,fc28,slump,air,density){
  const wcm=water/400, id=`TR-DEMO-${String(i).padStart(2,'0')}`;
  const strengths={'1':null,'3':round(fc28*.52,1),'7':round(fc28*.73,1),'28':fc28,'56':round(fc28*1.08,1),'90':null};
  return {id,projectId:PROJECT_ID,revision:0,batchNo:`T-${String(i).padStart(2,'0')}`,date,batchVolume:45,operator:'م. کریمی — کارشناس آزمایشگاه (فرضی)',actual:{water,cementitious:400},fresh:{slump,slumpFlow:null,t500:null,air,density,temperature:24+i*.3,segregation:'مشاهده نشد',workability:'یکنواخت و مناسب'},strengths,hardened:{flexural:null,splitting:null,rcpt:null,absorption:null},notes:'Trial نمونه برای کنترل اتصال کامل جریان مهندسی Tolou.',batchChanges:i===3?'نقطه مبنا — بدون تغییر نسبت‌های طراحی':'تغییر کنترل‌شده آب مؤثر برای مطالعه حساسیت و کالیبراسیون.',calculated:{actualWcm:round(wcm,4)},evaluation:{status:'ثبت‌شده',level:'pass',reasons:['اسلامپ و هوا در بازه ثبت‌شده هستند.','مقاومت 28روزه بالاتر از هدف 25 MPa است.',`w/cm واقعی ${wcm.toFixed(3)} از حد پروژه 0.500 عبور نکرده است.`]},updatedAt:`${date}T16:00:00+03:30`,createdAt:`${date}T08:00:00+03:30`};
}
const trials=[
  makeTrial(1,'2026-06-01',184,32.0,90,1.8,2357),
  makeTrial(2,'2026-06-03',188,31.2,95,1.9,2354),
  makeTrial(3,'2026-06-05',190,30.7,100,2.0,2351),
  makeTrial(4,'2026-06-07',192,30.2,105,2.1,2348),
  makeTrial(5,'2026-06-09',196,29.4,110,2.2,2345)
];

function trialEvidencePayload(series,rv){ const rev=series.revisions.find(r=>Number(r.revision)===Number(rv)); const ts=series.trials.filter(t=>Number(t.revision)===Number(rv)); return {seriesId:series.id,revision:Number(rv),designFingerprint:rev?.snapshot?.calculationFingerprint||rev?.snapshot?.canonicalContract?.identity?.calculationFingerprint||null,acceptance:series.acceptance||{},trials:ts.map(t=>({id:t.id,batchNo:t.batchNo,date:t.date,actual:t.actual,fresh:t.fresh,strengths:t.strengths,hardened:t.hardened,batchChanges:t.batchChanges,updatedAt:t.updatedAt}))}; }
function evidenceFingerprint(series,rv){ return 'TE-'+fnv1a(JSON.stringify(stableObj(trialEvidencePayload(series,rv)))); }
function calcTrialStats(ts){ const vals=ts.map(t=>t.strengths['28']);const mean=vals.reduce((a,b)=>a+b,0)/vals.length;const sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/(vals.length-1));const w=ts.map(t=>t.calculated.actualWcm),sl=ts.map(t=>t.fresh.slump),air=ts.map(t=>t.fresh.air),dens=ts.map(t=>t.fresh.density); return {mean,sd,cov:sd/mean*100,wMean:w.reduce((a,b)=>a+b,0)/w.length,wMax:Math.max(...w),slMean:sl.reduce((a,b)=>a+b,0)/sl.length,airMean:air.reduce((a,b)=>a+b,0)/air.length,densityMean:dens.reduce((a,b)=>a+b,0)/dens.length}; }
const trialStats=calcTrialStats(trials);
let mixSeries={id:SERIES_ID,projectId:PROJECT_ID,code:'QC010-001',name:'بتن معمولی C25 — سیمان تیپ II — عیار 400',engine:'QC-010',engineType:'بتن معمولی',status:'approved',createdAt:'2026-05-24T11:05:00+03:30',updatedAt:'2026-07-08T12:00:00+03:30',acceptance:{targetStrength:25,targetSlump:100,slumpTolerance:20,targetAir:2,airTolerance:1,maxWcm:.50,governingStandard:'نشریه ض-479 + الزامات پروژه نمونه'},approvedRevision:0,approvedAt:'2026-07-08T12:00:00+03:30',revisions:[{revision:0,createdAt:'2026-05-24T11:05:00+03:30',reason:'ثبت طرح اولیه روش ملی پس از عبور Gate 3.7',snapshot:clone(mixSnapshot)}],trials:clone(trials)};
const evfp=evidenceFingerprint(mixSeries,0);
mixSeries.revisions[0].calibration={version:'TolouTrialCalibration/1.0',generatedAt:'2026-07-08T11:50:00+03:30',revision:0,evidenceFingerprint:evfp,status:'ready',stats:{revision:0,trialIds:trials.map(t=>t.id),n:5,fc28:{n:5,mean:round(trialStats.mean,3),sd:round(trialStats.sd,3),covPct:round(trialStats.cov,2),min:29.4,max:32},slump:{n:5,mean:trialStats.slMean,min:90,max:110},air:{n:5,mean:trialStats.airMean,min:1.8,max:2.2},actualWcm:{n:5,mean:round(trialStats.wMean,4),max:round(trialStats.wMax,4)},density:{n:5,mean:trialStats.densityMean,design:round(totalWeight,3),meanDeviationPct:round((trialStats.densityMean-totalWeight)/totalWeight*100,3)},completeness:{trials:5,withFc28:5,withSlump:5,withAir:5,withWcm:5,withDensity:5},acceptance:clone(mixSeries.acceptance)},findings:[{level:'pass',code:'FC28_TARGET',text:`میانگین مقاومت 28روزه ${trialStats.mean.toFixed(2)} MPa به هدف 25.00 MPa می‌رسد.`},{level:'pass',code:'SLUMP_RANGE',text:'تمام نتایج اسلامپ داخل بازه 80 تا 120 mm هستند.'},{level:'pass',code:'AIR_RANGE',text:'تمام نتایج هوا داخل بازه تعریف‌شده هستند.'},{level:'pass',code:'WCM_LIMIT',text:'تمام w/cmهای واقعی ثبت‌شده از حد 0.500 عبور نکرده‌اند.'},{level:'info',code:'STAT_READY',text:`بر اساس 5 نتیجه 28روزه: SD = ${trialStats.sd.toFixed(2)} MPa و COV = ${trialStats.cov.toFixed(1)}%.`}],principle:'No automatic mix correction is applied. Engineer review is required before creating the next revision.'};
mixSeries.approvalRecord={revision:0,at:mixSeries.approvedAt,trialIds:trials.map(t=>t.id),overrideReason:null,evidenceFingerprint:evfp,calibrationStatus:'ready',calibrationVersion:'TolouTrialCalibration/1.0',integrityStatus:'valid',integrityReason:'Evidence fingerprint captured at approval.'};

function makeProductionBatch(i,date,ticket,moistures,deviations,waterDev,slump,air,temp,strength28){
  const volume=7, ingredients=[]; let freeTarget=0,freeActual=0,totalActual=0,cemActual=0;
  const cementTarget=400*volume, cementActual=cementTarget*(1+deviations[0]/100); cemActual=cementActual; totalActual+=cementActual;
  ingredients.push({key:'cement',name:'سیمان',group:'مواد سیمانی',perM3:400,moisture:0,absorption:0,targetAdjusted:cementTarget,actual:round(cementActual,2),deviation:deviations[0],tolerance:1});
  snapshotAggregates.forEach((a,j)=>{const M=moistures[j]/100,A=a.absorption/100,od=a.ssd/(1+A),wet=od*(1+M),target=wet*volume,actual=target*(1+deviations[j+1]/100),odAct=actual/(1+M),ssdAct=odAct*(1+A);freeTarget+=(wet-a.ssd)*volume;freeActual+=actual-ssdAct;totalActual+=actual;ingredients.push({key:'agg'+j,name:a.name,group:'سنگدانه',perM3:a.ssd,moisture:moistures[j],absorption:a.absorption,targetAdjusted:round(target,2),actual:round(actual,2),deviation:deviations[j+1],tolerance:2});});
  const waterTarget=effectiveWater*volume-freeTarget, waterActual=waterTarget*(1+waterDev/100);totalActual+=waterActual;const effectiveActual=waterActual+freeActual, actualWcm=effectiveActual/cemActual;const desiredYield=[1.001,0.999,1.002,1.000,1.003,0.998][i-1]||1;const density=totalActual/(volume*desiredYield),yieldVolume=totalActual/density,relativeYield=yieldVolume/volume;
  return {id:`PB-DEMO-${String(i).padStart(2,'0')}`,createdAt:`${date}T14:00:00+03:30`,projectId:PROJECT_ID,seriesId:SERIES_ID,seriesCode:'QC010-001',mixName:mixSeries.name,engine:'QC-010',revision:0,snapshotVersion:mixSnapshot.engineVersion,date,time:`0${7+i}:30`.slice(-5),ticket,volume,plant:'بچینگ مرکزی طلوع — کارخانه نمونه (فرضی)',line:'خط ۱',truck:`TM-${String(20+i).padStart(2,'0')}`,driver:`راننده ${i} (فرضی)`,operator:'اپراتور بچینگ — ع. مرادی (فرضی)',project:'TL-DEMO-25-400 — مجتمع اداری آفتاب شرق',notes:'بچ نمونه QA؛ مقادیر واقعی توزین با انحراف کوچک و در محدوده کنترل داخلی ثبت شده‌اند.',density:round(density,1),slump,air,temperature:temp,returned:0,returnedAction:'none',tolerances:{cementitious:1,aggregate:2,water:1,admixture:2},ingredients,water:{target:round(waterTarget,2),actual:round(waterActual,2),deviation:waterDev,tolerance:1,freeTarget:round(freeTarget,2),freeActual:round(freeActual,2),effectiveActual:round(effectiveActual,2)},actualCementitious:round(cemActual,2),actualWcm:round(actualWcm,4),totalActualMass:round(totalActual,2),yieldVolume:round(yieldVolume,4),relativeYield:round(relativeYield,4),status:'ok',violations:[],qaStrength28:strength28};
}
const productionBatches=[
  makeProductionBatch(1,'2026-07-01','B-260701-01',[3.4,1.5,1.1],[.10,.20,-.15,.10],.20,95,2.0,27,30.4),
  makeProductionBatch(2,'2026-07-08','B-260708-01',[3.6,1.4,1.2],[-.05,.10,.25,-.20],-.10,100,1.9,28,31.1),
  makeProductionBatch(3,'2026-07-15','B-260715-01',[3.5,1.6,1.3],[.20,-.10,.15,.05],.15,105,2.1,29,30.8),
  makeProductionBatch(4,'2026-07-22','B-260722-01',[3.7,1.5,1.2],[.00,.30,-.20,.10],-.20,100,2.0,30,31.5),
  makeProductionBatch(5,'2026-07-29','B-260729-01',[3.8,1.7,1.1],[-.10,-.15,.20,-.05],.05,110,2.2,31,29.9),
  makeProductionBatch(6,'2026-08-05','B-260805-01',[3.4,1.6,1.2],[.15,.05,-.10,.20],.10,95,1.8,30,30.6)
];

function addDays(iso,n){ const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10); }
const qcTests=[];
trials.forEach((t,i)=>qcTests.push({id:`ST-DEMO-TR-${i+1}-28`,date:addDays(t.date,28),testId:`QC010-001-${t.batchNo}-28d`,mix:'QC010-001',revision:'R0',lot:t.batchNo,plant:'آزمایشگاه طرح اختلاط',age:28,strength:t.strengths['28'],target:25,specimens:[round(t.strengths['28']-.3,1),round(t.strengths['28'],1),round(t.strengths['28']+.3,1)],materialLot:'CII-260518-A / FA-260520 / CA7-260520 / CA5-260520',notes:'همگام‌سازی داده Trial نمونه.',source:'trial',sourceRef:`${SERIES_ID}|${t.id}|28`,projectId:PROJECT_ID,createdAt:`${addDays(t.date,28)}T10:00:00+03:30`}));
productionBatches.forEach((b,i)=>{qcTests.push({id:`ST-DEMO-P-${i+1}-7`,date:addDays(b.date,7),testId:`${b.ticket}-7d`,mix:'QC010-001',revision:'R0',lot:b.ticket,plant:b.plant,age:7,strength:round(b.qaStrength28*.73,1),target:25,specimens:[],materialLot:'CII-260518-A / Aggregate Lot 260520',notes:'کنترل روند 7روزه تولید نمونه.',source:'manual',projectId:PROJECT_ID,createdAt:`${addDays(b.date,7)}T10:30:00+03:30`});qcTests.push({id:`ST-DEMO-P-${i+1}-28`,date:addDays(b.date,28),testId:`${b.ticket}-28d`,mix:'QC010-001',revision:'R0',lot:b.ticket,plant:b.plant,age:28,strength:b.qaStrength28,target:25,specimens:[round(b.qaStrength28-.2,1),b.qaStrength28,round(b.qaStrength28+.2,1)],materialLot:'CII-260518-A / Aggregate Lot 260520',notes:'کنترل مقاومت 28روزه تولید نمونه.',source:'manual',projectId:PROJECT_ID,createdAt:`${addDays(b.date,28)}T10:30:00+03:30`});});

const durabilityRecord={id:'DUR-DEMO-001',projectId:PROJECT_ID,at:'2026-08-10T12:00:00+03:30',mix:`${SERIES_ID}|0`,mixLabel:'QC010-001 — بتن معمولی C25 — سیمان تیپ II — عیار 400 — R0',codes:['F0','S0','W0','C0'],member:'reinforced',actual:{w:.475,fc:25,air:2,chloride:.08,cement:'MS',cacl2:'no'},project:{w:.50,fc:25,chloride:null},governing:{maxW:.50,minFc:25},checks:[{code:'w/cm',state:'good',why:'w/cm طرح = 0.475؛ حداکثر پروژه = 0.500.','ref':'Project requirement / durability check'},{code:"f'c",state:'good',why:"f'c طرح = 25.0 MPa؛ حداقل پروژه = 25.0 MPa.",ref:'Project requirement'},{code:'کلرید',state:'good',why:'کلرید نمونه = 0.080% مواد سیمانی؛ در سناریوی C0 کنترل شده است.',ref:'QA sample durability input'}],overall:'good',notes:'سناریوی مواجهه معمول و غیرمهاجم برای بررسی اتصال موتور دوام؛ مقادیر آزمایشگاهی فرضی‌اند.'};

const ecoFactors={
  [`MAT:${materialIds.cement}`]:{price:3600,basis:'ton',gwp:.72,source:'QA SAMPLE — قیمت و GWP نمایشی؛ جایگزین داده واقعی/EPD شود.'},
  [`MAT:${materialIds.fine}`]:{price:480,basis:'ton',gwp:.005,source:'QA SAMPLE — illustrative'},
  [`MAT:${materialIds.pea}`]:{price:520,basis:'ton',gwp:.006,source:'QA SAMPLE — illustrative'},
  [`MAT:${materialIds.almond}`]:{price:560,basis:'ton',gwp:.0065,source:'QA SAMPLE — illustrative'},
  'water:mix':{price:.02,basis:'kg',gwp:.0003,source:'QA SAMPLE — illustrative'}
};
function ecoRows(){return [
  {key:`MAT:${materialIds.cement}`,name:materials[0].revisions[0].name,group:'مواد سیمانی',mass:400,meta:{materialId:materialIds.cement,code:materialCodes.cement,revision:1}},
  {key:'water:mix',name:'آب اختلاط',group:'آب',mass:190,meta:{}},
  {key:`MAT:${materialIds.fine}`,name:aggregateSources[0].name,group:'سنگدانه ریز',mass:round(ssdMasses[0],3),meta:{materialId:materialIds.fine,code:materialCodes.fine}},
  {key:`MAT:${materialIds.pea}`,name:aggregateSources[1].name,group:'سنگدانه',mass:round(ssdMasses[1],3),meta:{materialId:materialIds.pea,code:materialCodes.pea}},
  {key:`MAT:${materialIds.almond}`,name:aggregateSources[2].name,group:'سنگدانه',mass:round(ssdMasses[2],3),meta:{materialId:materialIds.almond,code:materialCodes.almond}}
];}
const erows=ecoRows();
let totalCost=0,totalCarbon=0;erows.forEach(r=>{const f=ecoFactors[r.key];const cost=f.basis==='ton'?r.mass/1000*f.price:r.mass*f.price;totalCost+=cost;totalCarbon+=r.mass*f.gwp;r.cost=round(cost,3);r.carbon=round(r.mass*f.gwp,3);});
const economicsRecord={id:'ECO-DEMO-001',projectId:PROJECT_ID,savedAt:'2026-08-11T09:00:00+03:30',at:'2026-08-11T09:00:00+03:30',name:'تحلیل اقتصادی/کربن پروژه نمونه 25/400',mixKey:`${SERIES_ID}::0`,mixLabel:'QC010-001 — بتن معمولی C25 — سیمان تیپ II — عیار 400 — R0',totalCost:round(totalCost,2),totalCarbon:round(totalCarbon,2),priceCoverage:100,gwpCoverage:100,costCoverage:100,carbonCoverage:100,performance:{value:round(trialStats.mean,2),basis:'میانگین مقاومت 28روزه 5 Trial'},strength:round(trialStats.mean,2),input:{name:'تحلیل اقتصادی/کربن پروژه نمونه 25/400',date:'2026-08-11',currency:'واحد نمونه',scope:'1 m³ بتن — صرفاً QA',overhead:0,transportCost:0,otherCost:0,otherCarbon:0,otherSource:'',notes:'تمام قیمت‌ها و عوامل کربن نمایشی هستند و برای برآورد تجاری معتبر نیستند.'},rows:erows};

const calX=trials.map(t=>1/t.calculated.actualWcm),calY=trials.map(t=>t.strengths['28']);
const mx=calX.reduce((a,b)=>a+b,0)/calX.length,my=calY.reduce((a,b)=>a+b,0)/calY.length;
const bReg=calX.reduce((s,x,i)=>s+(x-mx)*(calY[i]-my),0)/calX.reduce((s,x)=>s+(x-mx)**2,0),aReg=my-bReg*mx;
const pred=calX.map(x=>aReg+bReg*x),ssRes=calY.reduce((s,y,i)=>s+(y-pred[i])**2,0),ssTot=calY.reduce((s,y)=>s+(y-my)**2,0),r2=1-ssRes/ssTot;
function econFor(cm,w){ const fine=ssdMasses[0],pea=ssdMasses[1],almond=ssdMasses[2]; return {cost:(cm/1000*3600)+(w*.02)+(fine/1000*480)+(pea/1000*520)+(almond/1000*560),carbon:(cm*.72)+(w*.0003)+(fine*.005)+(pea*.006)+(almond*.0065)}; }
const pareto=[[.46,390],[.465,395],[.47,400],[.475,400],[.48,405],[.485,410],[.49,415]].map((x,i)=>{const [wcm,cm]=x,water=wcm*cm,e=econFor(cm,water);return{id:`C-DEMO-${i+1}`,wcm,cm,scmPct:0,water:round(water,2),cement:cm,strength:round(aReg+bReg*(1/wcm),2),cost:round(e.cost,2),carbon:round(e.carbon,2),mode:'full'};});
const optimizerStudy={id:'OPT-DEMO-001',projectId:PROJECT_ID,at:'2026-08-12T10:00:00+03:30',source:`${SERIES_ID}::0`,sourceLabel:'QC010-001 — بتن معمولی C25 — سیمان تیپ II — عیار 400 — R0',engine:'QC-010',fullMode:true,objectives:['cost','carbon'],constraints:{wmin:.46,wmax:.50,wstep:.005,cmmin:380,cmmax:430,cmstep:5,smin:0,smax:0,sstep:1,dur:.50,cementMin:360,waterMin:175,waterMax:205,strengthMin:25,enforce:true},calibration:{valid:true,n:5,r2:round(r2,6),a:round(aReg,6),b:round(bReg,6),wMin:.46,wMax:.49},feasibleCount:pareto.length,pareto};

function makeAudit(){
  const events=[
    ['پروژه','ایجاد پروژه','Project',PROJECT_ID,'پروژه نمونه TL-DEMO-25-400 ایجاد شد.',{fc:25,cement:400}],
    ['مصالح','ثبت مصالح','MaterialLibrary','DEMO-MATERIALS','کتابخانه مصالح نمونه شامل سیمان تیپ II، آب و سه رده سنگدانه تکمیل شد.',{materials:5}],
    ['سنگدانه','تحلیل ترکیب','AggregateBlend',AGG_CASE_ID,'هوشمندی سنگدانه با درصدهای عبوری میانی INSO 302 و منحنی B روش ملی تکمیل شد.',{rmse:aggregateResult.metrics.rmse}],
    ['طرح اختلاط','محاسبه روش ملی','MixRevision',`${SERIES_ID}:R0`,'طرح C25 با عیار سیمان 400 kg/m³ و w/cm=0.475 محاسبه و برای Trial قفل شد.',{fingerprint:stage37.fingerprint}],
    ['آزمایشگاه','ثبت Trial','TrialSeries',SERIES_ID,'پنج بچ آزمایشگاهی با پنج سطح w/cm ثبت شد.',{trials:5,meanFc28:round(trialStats.mean,2)}],
    ['طرح اختلاط','تأیید بازنگری','MixRevision',`${SERIES_ID}:R0`,'R0 پس از عبور شواهد Trial به‌عنوان طرح تأییدشده ثبت شد.',{evidenceFingerprint:evfp}],
    ['تولید','ثبت تولید','ProductionBatch','DEMO-PRODUCTION','شش بچ تولید نمونه با کنترل توزین، رطوبت، w/cm و Yield ثبت شد.',{batches:6}],
    ['کنترل کیفیت','پایش مقاومت','StrengthTest','DEMO-QC','نتایج Trial و تولید در کنترل کیفیت و آمار مقاومت ثبت شدند.',{tests:qcTests.length}],
    ['دوام','تحلیل دوام','DurabilityAnalysis',durabilityRecord.id,'سناریوی دوام F0/S0/W0/C0 بررسی و ذخیره شد.',{overall:'good'}],
    ['هزینه و پایداری','تحلیل نمونه','EconomicAnalysis',economicsRecord.id,'تحلیل نمونه هزینه و کربن با پوشش 100% داده ذخیره شد.',{demoFactors:true}],
    ['بهینه‌سازی','مطالعه چندهدفه','OptimizationStudy',optimizerStudy.id,'مطالعه بهینه‌سازی با مدل مقاومت کالیبره‌شده و دامنه مجاز Trial ذخیره شد.',{r2:optimizerStudy.calibration.r2}]
  ];
  let prevHash=null;return events.map((e,i)=>{const [module,action,entityType,entityId,summary,details]=e;const base={id:`AUD-DEMO-${String(i+1).padStart(2,'0')}`,at:`2026-${String(5+Math.min(i,3)).padStart(2,'0')}-${String(20+(i%8)).padStart(2,'0')}T12:00:00+03:30`,projectId:PROJECT_ID,module,action,entityType,entityId,summary,actor:'کاربر نمونه Tolou',prevHash,details};base.hash=fnv1a(JSON.stringify(stableObj(base)));prevHash=base.hash;return base;});
}

const sampleProject={id:PROJECT_ID,code:'TL-DEMO-25-400',name:'مجتمع اداری آفتاب شرق — فاز ۱ (پروژه نمونه)',status:'active',designScope:'base',client:'شرکت توسعه سازه سپهر (فرضی)',consultant:'مهندسین مشاور پایدار بتن (فرضی)',contractor:'شرکت عمران پارس‌سازه (فرضی)',manager:'مهندس آرمان رضایی (فرضی)',location:'کارگاه نمونه — منطقه مرکزی',type:'ساختمان اداری بتن‌آرمه',structureType:'building',startDate:'2026-05-15',endDate:'2027-05-15',commonSettings:clone(projectContext.commonSettings),requirements:clone(projectContext.requirements),baseSettings:clone(projectContext.baseSettings),specialSettings:clone(projectContext.specialSettings),notes:'پروژه کاملاً فرضی و از پیش تکمیل‌شده برای کنترل End-to-End نرم‌افزار Tolou. داده‌های قیمت، GWP و هویت اشخاص/شرکت‌ها واقعی نیستند.',archived:false,createdAt:'2026-05-15T08:00:00+03:30',updatedAt:'2026-08-12T10:00:00+03:30'};

function engineAggregates(){ return snapshotAggregates.map(a=>{const c=clone(a);delete c.volume;delete c.ssd;delete c.od;delete c.batch;delete c.freeWater;return c;}); }
const engineState={aggregates:engineAggregates(),admixtures:[],nextAggId:4,nextAdmixId:1,materialBindings:clone(materialBindings),aggregateBlendBinding:clone(aggregateBlendBinding),baseMethodId:'iran479',iranStage31:{mode:'site',siteGrade:'B',fcClass:'',fc:'25',series1:'',series2:'',qcValues:[],lastResult:clone(stage31)},iranStage32:{lastResult:clone(stage32)},iranStage33:{curve:'B',lastResult:clone(stage33)},iranStage34:{demandMode:'auto',reducerPct:'0',lastResult:clone(stage34)},iranStage35:{wcMode:'manual',cementClass:'42.5',coarseShape:'auto',manualWc:'0.475',waterCorrRate:'',scmType:'none',scmRatio:'0',silicaRisk:false,minCement:'',maxCement:'',lastResult:clone(stage35)},iranStage36:{entrappedAir:'2',intentionalAir:'0',lastResult:clone(stage36)}};

function seedSampleProject(storage){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function') return {ok:false,reason:'storage-unavailable'};
  try{
    const existingMarker=readJson(storage,SAMPLE_MARKER,{});
    if(existingMarker?.version===1&&existingMarker?.projectId===PROJECT_ID) return {ok:true,alreadySeeded:true,projectId:PROJECT_ID,seriesId:SERIES_ID};
    const hub=readJson(storage,'Tolou_project_hub_v1',{schemaVersion:1,projects:[],activeProjectId:null,audit:[]});hub.schemaVersion=1;hub.projects=Array.isArray(hub.projects)?hub.projects:[];hub.audit=Array.isArray(hub.audit)?hub.audit:[];upsert(hub.projects,clone(sampleProject));const sampleAudit=makeAudit();hub.audit=hub.audit.filter(x=>x.projectId!==PROJECT_ID).concat(sampleAudit);if(!hub.activeProjectId)hub.activeProjectId=PROJECT_ID;storage.setItem('Tolou_project_hub_v1',JSON.stringify(hub));

    const ml=readJson(storage,'Tolou_material_library_v1',{schemaVersion:1,materials:[]});ml.schemaVersion=1;ml.materials=Array.isArray(ml.materials)?ml.materials:[];materials.forEach(m=>upsert(ml.materials,clone(m)));storage.setItem('Tolou_material_library_v1',JSON.stringify(ml));

    const ag=readJson(storage,'Tolou_aggregate_intelligence_v1',{version:1,current:null,cases:[]});ag.version=1;ag.cases=Array.isArray(ag.cases)?ag.cases:[];upsert(ag.cases,clone(aggregateCase));if(!ag.current||!(ag.current.sources||[]).length)ag.current=clone(aggregateCurrent);storage.setItem('Tolou_aggregate_intelligence_v1',JSON.stringify(ag));

    const lab=readJson(storage,'Tolou_trial_lab_v1',{schemaVersion:1,series:[]});lab.schemaVersion=1;lab.series=Array.isArray(lab.series)?lab.series:[];upsert(lab.series,clone(mixSeries));storage.setItem('Tolou_trial_lab_v1',JSON.stringify(lab));

    const qc=readJson(storage,'Tolou_quality_control_v1',{schemaVersion:1,tests:[]});qc.schemaVersion=1;qc.tests=Array.isArray(qc.tests)?qc.tests:[];qcTests.forEach(t=>upsert(qc.tests,clone(t)));storage.setItem('Tolou_quality_control_v1',JSON.stringify(qc));

    const prod=readJson(storage,'Tolou_production_intelligence_v1',{schemaVersion:1,batches:[],draft:null});prod.schemaVersion=1;prod.batches=Array.isArray(prod.batches)?prod.batches:[];productionBatches.forEach(b=>upsert(prod.batches,clone(b)));if(!prod.draft)prod.draft=null;storage.setItem('Tolou_production_intelligence_v1',JSON.stringify(prod));

    const dur=readJson(storage,'Tolou_durability_engine_v1',{schemaVersion:1,records:[],last:null});dur.schemaVersion=1;dur.records=Array.isArray(dur.records)?dur.records:[];upsert(dur.records,clone(durabilityRecord));if(!dur.last)dur.last=clone(durabilityRecord);storage.setItem('Tolou_durability_engine_v1',JSON.stringify(dur));

    const eco=readJson(storage,'Tolou_cost_sustainability_v1',{schemaVersion:1,factors:{},records:[],lastDraft:null});eco.schemaVersion=1;eco.factors={...(eco.factors||{}),...clone(ecoFactors)};eco.records=Array.isArray(eco.records)?eco.records:[];upsert(eco.records,clone(economicsRecord));if(!eco.lastDraft)eco.lastDraft=clone(economicsRecord);storage.setItem('Tolou_cost_sustainability_v1',JSON.stringify(eco));

    const opt=readJson(storage,'Tolou_multiobjective_optimizer_v1',{schemaVersion:1,studies:[],last:null});opt.schemaVersion=1;opt.studies=Array.isArray(opt.studies)?opt.studies:[];upsert(opt.studies,clone(optimizerStudy));if(!opt.last)opt.last={source:optimizerStudy.source,constraints:clone(optimizerStudy.constraints),objectives:clone(optimizerStudy.objectives)};storage.setItem('Tolou_multiobjective_optimizer_v1',JSON.stringify(opt));

    const q10=readJson(storage,'QC010_full_data',{});if(!Array.isArray(q10.aggregates)||!q10.aggregates.length){storage.setItem('QC010_full_data',JSON.stringify(clone(engineState)));}

    storage.setItem(SAMPLE_MARKER,JSON.stringify({version:1,projectId:PROJECT_ID,seriesId:SERIES_ID,aggregateCaseId:AGG_CASE_ID,seededAt:new Date().toISOString(),dataset:'Tolou QA Sample C25/Cement400/TypeII',baselineChanged:false}));
    return {ok:true,projectId:PROJECT_ID,seriesId:SERIES_ID};
  } catch(error){ return {ok:false,reason:error?.message||String(error)}; }
}

module.exports={seedSampleProject,SAMPLE_MARKER,PROJECT_ID,SERIES_ID};