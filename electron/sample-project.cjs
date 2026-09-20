'use strict';

const SAMPLE_MARKER = 'Tolou_sample_project_v1';
const SAMPLE_DATASET_VERSION = 8;
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

const massWeights=[0.44,0.37,0.19], sgs=[2.64,2.66,2.68];
const volumeRaw=massWeights.map((w,i)=>w/sgs[i]);
const volumeSum=volumeRaw.reduce((a,b)=>a+b,0);
const volumeFractions=volumeRaw.map(v=>v/volumeSum);
const aggregateSources=[
  {id:'AGS-DEMO-SAND',name:'ماسه شسته رودخانه‌ای 0–4.75 mm (فرضی)',kind:'fine',dmax:4.75,materialId:materialIds.fine,materialRevision:1,weight:44,min:40,max:50,locked:false,sg:2.64,particleShape:'rounded',surfaceTexture:'smooth',standardProfile:{profileId:'inso_fine_1',label:'INSO 302 — ریزدانه جدول 1',standard:'INSO 302:1399',table:'Table 1'},passing:passingObject(finePoints),limits:limitsObject(fineRanges)},
  {id:'AGS-DEMO-PEA',name:'شن نخودی 4.75–12.5 mm (فرضی)',kind:'coarse',dmax:12.5,materialId:materialIds.pea,materialRevision:1,weight:37,min:25,max:40,locked:false,sg:2.66,particleShape:'rounded',surfaceTexture:'rough',standardProfile:{profileId:'inso_c7',label:'INSO 302 — سنگدانه درشت رده 7',standard:'INSO 302:1399',table:'Table 3'},passing:passingObject(peaPoints),limits:limitsObject(peaRanges)},
  {id:'AGS-DEMO-ALMOND',name:'شن بادامی 12.5–25 mm (فرضی)',kind:'coarse',dmax:25,materialId:materialIds.almond,materialRevision:1,weight:19,min:15,max:30,locked:false,sg:2.68,particleShape:'angular',surfaceTexture:'rough',standardProfile:{profileId:'inso_c5',label:'INSO 302 — سنگدانه درشت رده 5',standard:'INSO 302:1399',table:'Table 3'},passing:passingObject(almondPoints),limits:limitsObject(almondRanges)}
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
const aggregateCurrent={name:'ترکیب سه‌جزئی استاندارد — پروژه نمونه 25/400',dmax:25,exponent:.45,targetMode:'iran479',iranCurve:'B',cementitious:400,measuredDRUW:1680,notes:'سه منبع سنگدانه با درصد عبوری دقیقاً در وسط حدود کنترل INSO 302 روی الک‌های استاندارد. سهم‌های جرمی 44/37/19 درصد با بهینه‌سازی محدودشده در بازه‌های مجاز برای نزدیک‌شدن به منحنی B روش ملی انتخاب شده‌اند.',sources:aggregateSources,lastResult:aggregateResult};
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

const stage31={
  profileId:'IR_NMD_479_1388',
  ruleId:'IR479_3_1_STRENGTH',
  fc:25,
  n:null,
  mean:null,
  rawSd:null,
  correctionFactor:null,
  sdUsed:4.5,
  fcmEq31:32.53,
  fcmEq32:31.485,
  fcm:32.53,
  governingEquation:'3-1',
  source:'رتبه کارگاه B / جدول 3-1 — داده پروژه نمونه',
  workshopRank:'B',
  notes:[],
  warnings:[],
  completeness:{complete:true,issues:[]},
  ruleTrace:[{id:'IR479_3_1_FCM',reference:'نشریه ض-479 — Stage 3.1'}]
};
const stage32={
  profileId:'IR_NMD_479_1388',
  ruleId:'IR479_3_2_WORKABILITY',
  slump:{value:100,class:'متوسط',label:'اسلامپ هدف پروژه نمونه'},
  particleShape:'mixed-average',
  surfaceTexture:'mixed-average',
  aggregates:aggregateSources.map(s=>({
    id:s.id,
    name:s.name,
    type:s.kind,
    particleShape:s.particleShape,
    shapeLabel:s.particleShape==='rounded'?'گردگوشه':s.particleShape==='angular'?'گوشه‌دار / تیزگوشه':'—',
    surfaceTexture:s.surfaceTexture,
    textureLabel:s.surfaceTexture==='smooth'?'صاف / صیقلی':s.surfaceTexture==='rough'?'زبر':'—',
    dmax:s.dmax,
    materialRevision:s.materialRevision
  })),
  warnings:[],
  completeness:{complete:3,total:3,issues:[]},
  ruleTrace:[{id:'IR479_3_2_SLUMP',reference:'نشریه ض-479 — Stage 3.2'}]
};
const stage33={
  profileId:'IR_NMD_479_1388',
  ruleId:'IR479_4_2_GRADING',
  dmax:25,
  curve:'B',
  sourceFigure:'4-4',
  fm:aggregateResult.metrics.nationalFm,
  rmse:aggregateResult.metrics.rmse,
  blendBasis:'volume',
  massFractions:massWeights,
  volumeFractions:aggregateSources.map((s,i)=>({
    aggregateId:s.id,
    name:s.name,
    sg:sgs[i],
    massFraction:massWeights[i],
    volumeFraction:round(volumeFractions[i],8)
  })),
  aggregateBlendId:AGG_CASE_ID,
  aggregateCase:{id:AGG_CASE_ID,name:aggregateCurrent.name},
  warnings:[],
  completeness:{complete:true,issues:[]},
  ruleTrace:[{id:'IR479_4_2_GRADING',reference:'نشریه ض-479 — شکل 4-4'}]
};
const stage34={
  profileId:'IR_NMD_479_1388',
  ruleId:'IR479_3_4_WATER',
  slump:{value:100,class:'متوسط'},
  slumpClass:'متوسط',
  fm:aggregateResult.metrics.nationalFm,
  demandMode:'auto',
  sourceFigure:null,
  sourceType:'QA locked sample result',
  baseFreeWaterKgM3:190,
  waterReducerPct:0,
  freeWaterAfterReducerKgM3:190,
  digitizationUncertaintyKgM3:null,
  final:{freeWaterKgM3:190},
  dmax:25,
  shapeTexture:'average',
  warnings:[],
  completeness:{complete:true,issues:[]},
  ruleTrace:[{id:'IR479_3_4_FREE_WATER',reference:'نشریه ض-479 — Stage 3.4'}]
};
const stage35={
  profileId:'IR_NMD_479_1388',
  ruleId:'IR479_3_5_WC_BINDER',
  fc:25,
  fcm:32.53,
  wcMode:'manual',
  wcBase:.475,
  cementStrengthClass:'42.5',
  coarseShape:'mixed-average',
  sourceType:'QA locked sample result',
  sourceFigure:null,
  waterCorrection:{required:false,rateKgPer10KgCement:null},
  scm:{type:'none',kgM3:0,k:null,ratioToCementPct:0},
  final:{
    freeWaterKgM3:190,
    cementKgM3:400,
    scmKgM3:0,
    totalCementitiousKgM3:400,
    effectiveRatio:.475
  },
  warnings:[],
  completeness:{complete:true,issues:[]},
  ruleTrace:[{id:'IR479_3_5_WC',reference:'نشریه ض-479 — Stage 3.5'}]
};
const stage36={
  profileId:'IR_NMD_479_1388',
  ruleId:'IR479_3_6_ABSOLUTE_VOLUME',
  air:{entrappedPct:2,intentionalPct:0,totalPct:2},
  airCorrections:{waterAdjustedKgM3:190,wcAdjusted:.475},
  binder:{cementKgM3:400,totalCementitiousKgM3:400,scmType:'none',scmKgM3:0,effectiveRatio:.475},
  absoluteVolume:{knownM3:round(1-aggVol,8),aggregateM3:round(aggVol,8),closureM3:1},
  moistureCorrection:{
    batchWaterKgM3:round(batchWater,6),
    aggregateFreeWaterKgM3:round(freeWaterTotal,6),
    aggregateSSDTotalKgM3:round(totalAgg,6),
    aggregateBatchTotalKgM3:round(aggCalc.reduce((s,x)=>s+x.batch,0),6)
  },
  aggregates:snapshotAggregates.map((a,i)=>({
    id:a.id,
    aggregateId:a.id,
    name:a.name,
    volumeFraction:round(volumeFractions[i],8),
    ssdKgM3:a.ssd,
    ssdMassKgM3:a.ssd,
    moisturePct:a.moisture,
    moisture:a.moisture,
    absorptionPct:a.absorption,
    absorption:a.absorption,
    batchKgM3:a.batch,
    batchMassKgM3:a.batch,
    freeWaterKgM3:a.freeWater
  })),
  warnings:[],
  completeness:{complete:true,issues:[]},
  ruleTrace:[{id:'IR479_3_6_VOLUME',reference:'نشریه ض-479 — Stage 3.6'}]
};
const stage37={
  version:'stage3.7-integration-lock-1.0',
  engineVersion:'QC010-iran479-engine-3.7-locked',
  status:'locked-for-trial',
  requiredPassed:8,
  requiredTotal:8,
  fingerprint:'IR479-DEMO-25-400-R0',
  gates:[
    {id:'strength',label:'Strength basis',severity:'required',ok:true,detail:'f\'c=25 MPa; fcm=32.53 MPa; SD=4.5 MPa.'},
    {id:'workability',label:'Workability',severity:'required',ok:true,detail:'Slump target=100 mm.'},
    {id:'grading',label:'Aggregate grading',severity:'required',ok:true,detail:'Iran 479 Curve B, Dmax 25 mm, volume-basis blend.'},
    {id:'water',label:'Free water',severity:'required',ok:true,detail:'Effective water=190 kg/m³.'},
    {id:'wc',label:'w/c',severity:'required',ok:true,detail:'w/cm=0.475 with 400 kg/m³ cement.'},
    {id:'air',label:'Air',severity:'required',ok:true,detail:'Entrapped air=2%; intentional air=0%.'},
    {id:'volume',label:'Absolute volume closure',severity:'required',ok:true,detail:'Absolute-volume closure=1.00000 m³.'},
    {id:'moisture',label:'SSD/moisture correction',severity:'required',ok:true,detail:'Aggregate moisture correction and batch water are populated.'}
  ],
  ruleTrace:[{id:'IR479_3_7_LOCK',reference:'Tolou Stage 3.7 integration gate'}]
};

const mixSnapshot={
  engineVersion:'QC010-iran479-engine-3.7-locked',designMethodId:'iran479',designMethodLabel:'روش ملی ایران — نشریه ض-479',methodProfileId:'IR_NMD_479_1388',methodRuleSetId:'RULESET_IR_479',reference:'نشریه ض-479، چاپ دوم 1388',
  inputState:{projectName:projectContext.name,structureType:'building',standardType:'isiri',cementType:'II',cementDensity:'3150',cementContent:'400',slumpTarget:'100',maxAggSize:'25',targetStrength:'25',targetWc:'0.475',finalWater:'190',airContent:'2',airSystem:'non-air',fineAggregateFM:String(round(fineFM(),2)),ambientTemp:'25',humidity:'55'},
  materialBindings:clone(materialBindings),aggregateBlendBinding:clone(aggregateBlendBinding),projectName:projectContext.name,projectLinkMode:'library',projectContext:clone(projectContext),standard:'iran479',cementType:'II',cementTypeLabel:'Type II',slump:100,dmax:25,targetStrength:25,targetWc:.475,cementDensity:3150,silicaDensity:2200,flyAshDensity:2300,slagDensity:2900,cementContent:400,silica:0,flyAsh:0,slag:0,totalCementitious:400,effectiveWater:190,batchWater:round(batchWater,6),freeWaterTotal:round(freeWaterTotal,6),finalWc:.475,wcm:.475,airContent:2,airSystem:'nonair',airExposure:'iran479',fineFM:round(fineFM(),3),knownVolume:round(1-aggVol,8),aggregateVolume:round(aggVol,8),volumeClosure:1,aggregateSSDTotal:round(totalAgg,6),aggregateBatchTotal:round(aggCalc.reduce((s,x)=>s+x.batch,0),6),totalWeight:round(totalWeight,6),iranNational:{stage31,stage32,stage33,stage34,stage35,stage36,stage37},integrationAudit:stage37,validationStatus:'locked-for-trial',calculationFingerprint:stage37.fingerprint,ruleTrace:[{id:'IR479_3_1_FCM',reference:'نشریه ض-479 Stage 3.1'},{id:'IR479_4_2_GRADING',reference:'نشریه ض-479 شکل 4-4'},{id:'IR479_3_4_FREE_WATER',reference:'نشریه ض-479 Stage 3.4'},{id:'IR479_3_5_WC',reference:'نشریه ض-479 Stage 3.5'},{id:'IR479_3_6_VOLUME',reference:'نشریه ض-479 Stage 3.6'},{id:'IR479_3_7_LOCK',reference:'Tolou Stage 3.7'}],aggregates:clone(snapshotAggregates),admixtures:[],fibers:[],timestamp:'2026-05-24T11:00:00+03:30'
};

function makeTrial(i,date,water,fc28,slump,air,density,moistures){
  const wcm=water/400, id=`TR-DEMO-${String(i).padStart(2,'0')}`;
  const batchVolumeL=45, batchVolumeM3=batchVolumeL/1000;
  const cementBatch=cement*batchVolumeM3;
  const aggBatch=snapshotAggregates.map((a,j)=>{
    const M=moistures[j]/100, A=a.absorption/100;
    const ssdPerM3=a.ssd, odPerM3=ssdPerM3/(1+A), wetPerM3=odPerM3*(1+M);
    const freeWaterPerM3=wetPerM3-ssdPerM3;
    return {
      aggregateId:a.id,
      materialId:a.materialId,
      name:a.name,
      absorptionPct:a.absorption,
      moisturePct:moistures[j],
      ssdTargetKg:round(ssdPerM3*batchVolumeM3,3),
      wetBatchKg:round(wetPerM3*batchVolumeM3,3),
      freeWaterKg:round(freeWaterPerM3*batchVolumeM3,3)
    };
  });
  const aggregateFreeWaterKg=aggBatch.reduce((s,a)=>s+a.freeWaterKg,0);
  const effectiveWaterBatchKg=water*batchVolumeM3;
  const waterToAddKg=effectiveWaterBatchKg-aggregateFreeWaterKg;
  const totalBatchMassKg=cementBatch+waterToAddKg+aggBatch.reduce((s,a)=>s+a.wetBatchKg,0);
  const measuredYieldM3=totalBatchMassKg/density;
  const relativeYield=measuredYieldM3/batchVolumeM3;
  const strengths={'1':null,'3':round(fc28*.50,1),'7':round(fc28*.72,1),'28':fc28,'56':round(fc28*1.07,1),'90':null};
  const specimenSets={
    '3':[round(strengths['3']-.3,1),strengths['3'],round(strengths['3']+.3,1)],
    '7':[round(strengths['7']-.3,1),strengths['7'],round(strengths['7']+.3,1)],
    '28':[round(fc28-.4,1),fc28,round(fc28+.4,1)],
    '56':[round(strengths['56']-.4,1),strengths['56'],round(strengths['56']+.4,1)]
  };
  const meetsSpecified=fc28>=25;
  const meetsDesignMean=fc28>=stage31.fcm;
  const withinWcm=wcm<=.50;
  const withinSlump=Math.abs(slump-100)<=20;
  const withinAir=Math.abs(air-2)<=1;
  return {
    id,projectId:PROJECT_ID,revision:0,batchNo:`T-${String(i).padStart(2,'0')}`,date,
    batchVolume:batchVolumeL,batchVolumeM3,
    operator:'م. کریمی — کارشناس آزمایشگاه (فرضی)',
    technician:'س. نادری — تکنسین بتن (فرضی)',
    laboratory:'آزمایشگاه کنترل کیفیت بتن طلوع — نمونه QA',
    materialLots:{cement:'CII-260518-A',fine:'FA-260520',pea:'CA7-260520',almond:'CA5-260520',water:'W-2605'},
    actual:{
      water,cementitious:400,
      waterAddedKg:round(waterToAddKg,3),
      effectiveWaterBatchKg:round(effectiveWaterBatchKg,3),
      cementBatchKg:round(cementBatch,3),
      aggregateFreeWaterKg:round(aggregateFreeWaterKg,3),
      totalBatchMassKg:round(totalBatchMassKg,3)
    },
    preparation:{
      basis:'SSD masses from locked R0 + measured trial-day moisture correction',
      moistureReadingsPct:moistures,
      aggregates:aggBatch,
      waterToAddKg:round(waterToAddKg,3),
      effectiveWaterBatchKg:round(effectiveWaterBatchKg,3),
      mixingSequence:'سنگدانه + حدود 70% آب؛ افزودن سیمان؛ تکمیل آب؛ اختلاط نهایی و کنترل یکنواختی.',
      mixingTimeSec:180,
      restTimeSec:60
    },
    fresh:{
      slump,slumpFlow:null,t500:null,air,density,temperature:round(24+i*.3,1),
      segregation:'مشاهده نشد',bleeding:'ناچیز / غیرمعنادار',workability:'یکنواخت و مناسب',
      visualCohesion:'خوب',finishability:'مناسب',
      measuredYieldM3:round(measuredYieldM3,5),relativeYield:round(relativeYield,4)
    },
    strengths,specimenSets,
    hardened:{flexural:null,splitting:null,rcpt:null,absorption:null},
    notes:'Trial نمونه QA بر پایه R0 قفل‌شده؛ جرم‌های بچ از مقادیر SSD Stage 3 با رطوبت روز آزمایش اصلاح شده‌اند.',
    batchChanges:i===3?'نقطه مبنا R0 — فقط اجرای آزمایشگاهی و تصحیح رطوبت؛ نسبت‌های طراحی تغییر نکرده‌اند.':'فقط آب مؤثر برای مطالعه حساسیت w/cm تغییر داده شده؛ سیمان 400 kg/m³ و Blend سنگدانه 44/37/19 ثابت مانده است.',
    calculated:{actualWcm:round(wcm,4),designWcm:.475,designFcm:stage31.fcm,yieldRatio:round(relativeYield,4)},
    evaluation:{
      status:'بررسی‌شده',
      level:(meetsSpecified&&withinWcm&&withinSlump&&withinAir)?'pass':'review',
      specifiedStrengthPass:meetsSpecified,
      designMeanPointPass:meetsDesignMean,
      reasons:[
        `f'c مشخصه 25 MPa: ${meetsSpecified?'قبول':'نیازمند بررسی'}؛ نتیجه 28روزه = ${fc28.toFixed(1)} MPa.`,
        `مبنای طراحی fcm = ${stage31.fcm.toFixed(2)} MPa؛ این نقطه ${meetsDesignMean?'در/بالای مبنا':'زیر مبنا'} است.`,
        `اسلامپ ${slump} mm ${withinSlump?'داخل':'خارج'} بازه 80–120 mm است.`,
        `هوا ${air.toFixed(1)}% ${withinAir?'داخل':'خارج'} بازه 1–3% است.`,
        `w/cm واقعی ${wcm.toFixed(3)} ${withinWcm?'از حد 0.500 عبور نکرده':'از حد 0.500 عبور کرده'} است.`
      ]
    },
    updatedAt:`${date}T16:00:00+03:30`,createdAt:`${date}T08:00:00+03:30`
  };
}
const trials=[
  makeTrial(1,'2026-06-01',184,34.6,90,1.8,2358,[3.4,1.4,1.1]),
  makeTrial(2,'2026-06-03',188,33.8,95,1.9,2355,[3.5,1.5,1.1]),
  makeTrial(3,'2026-06-05',190,33.2,100,2.0,2352,[3.5,1.5,1.2]),
  makeTrial(4,'2026-06-07',192,32.6,105,2.1,2349,[3.6,1.6,1.2]),
  makeTrial(5,'2026-06-09',196,31.7,110,2.2,2346,[3.7,1.6,1.3])
];

function trialEvidencePayload(series,rv){ const rev=series.revisions.find(r=>Number(r.revision)===Number(rv)); const ts=series.trials.filter(t=>Number(t.revision)===Number(rv)); return {seriesId:series.id,revision:Number(rv),designFingerprint:rev?.snapshot?.calculationFingerprint||rev?.snapshot?.canonicalContract?.identity?.calculationFingerprint||null,acceptance:series.acceptance||{},trials:ts.map(t=>({id:t.id,batchNo:t.batchNo,date:t.date,actual:t.actual,fresh:t.fresh,strengths:t.strengths,hardened:t.hardened,batchChanges:t.batchChanges,updatedAt:t.updatedAt}))}; }
function evidenceFingerprint(series,rv){ return 'TE-'+fnv1a(JSON.stringify(stableObj(trialEvidencePayload(series,rv)))); }
function calcTrialStats(ts){ const vals=ts.map(t=>t.strengths['28']);const mean=vals.reduce((a,b)=>a+b,0)/vals.length;const sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/(vals.length-1));const w=ts.map(t=>t.calculated.actualWcm),sl=ts.map(t=>t.fresh.slump),air=ts.map(t=>t.fresh.air),dens=ts.map(t=>t.fresh.density); return {mean,sd,cov:sd/mean*100,wMean:w.reduce((a,b)=>a+b,0)/w.length,wMax:Math.max(...w),slMean:sl.reduce((a,b)=>a+b,0)/sl.length,airMean:air.reduce((a,b)=>a+b,0)/air.length,densityMean:dens.reduce((a,b)=>a+b,0)/dens.length}; }
const trialStats=calcTrialStats(trials);
let mixSeries={id:SERIES_ID,projectId:PROJECT_ID,code:'QC010-001',name:'بتن معمولی C25 — سیمان تیپ II — عیار 400',engine:'QC-010',engineType:'بتن معمولی',status:'approved',createdAt:'2026-05-24T11:05:00+03:30',updatedAt:'2026-07-08T12:00:00+03:30',acceptance:{targetStrength:25,designMeanStrength:stage31.fcm,targetSlump:100,slumpTolerance:20,targetAir:2,airTolerance:1,maxWcm:.50,governingStandard:'نشریه ض-479 + الزامات پروژه نمونه'},approvedRevision:0,approvedAt:'2026-07-08T12:00:00+03:30',revisions:[{revision:0,createdAt:'2026-05-24T11:05:00+03:30',reason:'ثبت طرح اولیه روش ملی پس از عبور Gate 3.7',snapshot:clone(mixSnapshot)}],trials:clone(trials)};
const evfp=evidenceFingerprint(mixSeries,0);
mixSeries.revisions[0].calibration={version:'TolouTrialCalibration/1.0',generatedAt:'2026-07-08T11:50:00+03:30',revision:0,evidenceFingerprint:evfp,status:'ready',stats:{revision:0,trialIds:trials.map(t=>t.id),n:5,fc28:{n:5,mean:round(trialStats.mean,3),sd:round(trialStats.sd,3),covPct:round(trialStats.cov,2),min:round(Math.min(...trials.map(t=>t.strengths['28'])),1),max:round(Math.max(...trials.map(t=>t.strengths['28'])),1),designMean:stage31.fcm,specifiedStrength:25},slump:{n:5,mean:trialStats.slMean,min:90,max:110},air:{n:5,mean:trialStats.airMean,min:1.8,max:2.2},actualWcm:{n:5,mean:round(trialStats.wMean,4),max:round(trialStats.wMax,4)},density:{n:5,mean:trialStats.densityMean,design:round(totalWeight,3),meanDeviationPct:round((trialStats.densityMean-totalWeight)/totalWeight*100,3)},completeness:{trials:5,withFc28:5,withSlump:5,withAir:5,withWcm:5,withDensity:5},acceptance:clone(mixSeries.acceptance)},findings:[{level:trialStats.mean>=stage31.fcm?'pass':'review',code:'FC28_DESIGN_MEAN',text:`میانگین مقاومت 28روزه ${trialStats.mean.toFixed(2)} MPa در برابر fcm طراحی ${stage31.fcm.toFixed(2)} MPa کنترل شد.`},{level:'pass',code:'FC28_SPECIFIED',text:'تمام نتایج 28روزه از مقاومت مشخصه 25.00 MPa بیشتر هستند.'},{level:'pass',code:'SLUMP_RANGE',text:'تمام نتایج اسلامپ داخل بازه 80 تا 120 mm هستند.'},{level:'pass',code:'AIR_RANGE',text:'تمام نتایج هوا داخل بازه تعریف‌شده هستند.'},{level:'pass',code:'WCM_LIMIT',text:'تمام w/cmهای واقعی ثبت‌شده از حد 0.500 عبور نکرده‌اند.'},{level:'info',code:'STAT_READY',text:`بر اساس 5 نتیجه 28روزه: SD = ${trialStats.sd.toFixed(2)} MPa و COV = ${trialStats.cov.toFixed(1)}%.`}],principle:'No automatic mix correction is applied. Engineer review is required before creating the next revision.'};
const approvalGates=[
  {id:'design-lock',label:'Design snapshot locked',ok:mixSnapshot.validationStatus==='locked-for-trial',detail:mixSnapshot.calculationFingerprint},
  {id:'trial-count',label:'Minimum trial evidence',ok:trials.length>=3,detail:`${trials.length} trial batches linked to R0`},
  {id:'specified-strength',label:'Specified strength',ok:trials.every(t=>t.strengths['28']>=25),detail:"All 28-day results >= f'c 25 MPa"},
  {id:'design-mean',label:'Required mean strength',ok:trialStats.mean>=stage31.fcm,detail:`Mean ${trialStats.mean.toFixed(2)} MPa vs fcm ${stage31.fcm.toFixed(2)} MPa`},
  {id:'wcm',label:'Maximum w/cm',ok:trials.every(t=>t.calculated.actualWcm<=.50),detail:'All trial w/cm <= 0.500'},
  {id:'slump',label:'Slump acceptance',ok:trials.every(t=>Math.abs(t.fresh.slump-100)<=20),detail:'All trials within 80–120 mm'},
  {id:'air',label:'Air acceptance',ok:trials.every(t=>Math.abs(t.fresh.air-2)<=1),detail:'All trials within 1–3%'},
  {id:'evidence',label:'Evidence fingerprint',ok:Boolean(evfp&&evfp.startsWith('TE-')),detail:evfp}
];
const approvalReady=approvalGates.every(g=>g.ok);
if(!approvalReady) mixSeries.status='review';
mixSeries.approvalRecord={
  revision:0,
  at:mixSeries.approvedAt,
  decision:approvalReady?'approved':'review-required',
  approvedBy:'مهندس کنترل کیفیت بتن — کاربر نمونه QA',
  reviewerRole:'Senior Concrete QC Engineer',
  trialIds:trials.map(t=>t.id),
  overrideReason:null,
  designFingerprint:mixSnapshot.calculationFingerprint,
  evidenceFingerprint:evfp,
  calibrationStatus:mixSeries.revisions[0].calibration.status,
  calibrationVersion:'TolouTrialCalibration/1.0',
  integrityStatus:approvalReady?'valid':'invalid',
  integrityReason:approvalReady?'All mandatory approval gates passed and evidence fingerprint was captured at approval.':'One or more mandatory approval gates failed.',
  gates:approvalGates,
  designBasis:{fc:25,fcm:stage31.fcm,cementKgM3:400,effectiveWaterKgM3:190,wcm:.475,slumpMm:100,dmaxMm:25,aggregateMassSplit:[44,37,19]},
  engineeringDisposition:'R0 may proceed to controlled production. Any material source/revision, aggregate blend, cement content, design w/cm or acceptance change requires a new revision and new evidence review.'
};

function makeProductionBatch(i,date,ticket,moistures,deviations,waterDev,slump,air,temp,strength28){
  const volume=7, ingredients=[]; let freeTarget=0,freeActual=0,totalActual=0,cemActual=0;
  const cementTarget=400*volume, cementActual=cementTarget*(1+deviations[0]/100); cemActual=cementActual; totalActual+=cementActual;
  const approvalRef={seriesId:SERIES_ID,revision:0,decision:mixSeries.approvalRecord.decision,designFingerprint:mixSeries.approvalRecord.designFingerprint,evidenceFingerprint:mixSeries.approvalRecord.evidenceFingerprint};
  ingredients.push({key:'cement',materialId:materialIds.cement,materialRevision:1,lot:'CII-260518-A',name:'سیمان پرتلند تیپ II',group:'مواد سیمانی',perM3:400,moisture:0,absorption:0,targetAdjusted:round(cementTarget,2),actual:round(cementActual,2),deviation:deviations[0],tolerance:1,withinTolerance:Math.abs(deviations[0])<=1});
  snapshotAggregates.forEach((a,j)=>{
    const M=moistures[j]/100,A=a.absorption/100,od=a.ssd/(1+A),wet=od*(1+M),target=wet*volume,actual=target*(1+deviations[j+1]/100),odAct=actual/(1+M),ssdAct=odAct*(1+A);
    const freeT=(wet-a.ssd)*volume, freeA=actual-ssdAct; freeTarget+=freeT;freeActual+=freeA;totalActual+=actual;
    ingredients.push({
      key:'agg'+j,materialId:a.materialId,materialRevision:1,lot:['FA-260520','CA7-260520','CA5-260520'][j],
      name:a.name,group:'سنگدانه',perM3:a.ssd,ssdPerM3:round(a.ssd,3),moisture:moistures[j],absorption:a.absorption,
      targetAdjusted:round(target,2),actual:round(actual,2),deviation:deviations[j+1],tolerance:2,withinTolerance:Math.abs(deviations[j+1])<=2,
      targetFreeWater:round(freeT,2),actualFreeWater:round(freeA,2)
    });
  });
  const waterTarget=effectiveWater*volume-freeTarget;
  const waterActual=waterTarget*(1+waterDev/100);
  totalActual+=waterActual;
  const effectiveActual=waterActual+freeActual;
  const actualWcm=effectiveActual/cemActual;
  const desiredYield=[1.001,0.999,1.002,1.000,1.003,0.998][i-1]||1;
  const density=totalActual/(volume*desiredYield),yieldVolume=totalActual/density,relativeYield=yieldVolume/volume;
  const weighingPass=ingredients.every(x=>x.withinTolerance)&&Math.abs(waterDev)<=1;
  const wcmPass=actualWcm<=.50;
  const slumpPass=Math.abs(slump-100)<=20;
  const airPass=Math.abs(air-2)<=1;
  const yieldPass=relativeYield>=.98&&relativeYield<=1.02;
  const approvalPass=approvalRef.decision==='approved'&&approvalRef.designFingerprint===mixSnapshot.calculationFingerprint;
  const productionReady=weighingPass&&wcmPass&&slumpPass&&airPass&&yieldPass&&approvalPass;
  const violations=[];
  if(!weighingPass)violations.push('WEIGHING_TOLERANCE');
  if(!wcmPass)violations.push('WCM_LIMIT');
  if(!slumpPass)violations.push('SLUMP_RANGE');
  if(!airPass)violations.push('AIR_RANGE');
  if(!yieldPass)violations.push('YIELD_RANGE');
  if(!approvalPass)violations.push('APPROVAL_INTEGRITY');
  return {
    id:`PB-DEMO-${String(i).padStart(2,'0')}`,createdAt:`${date}T14:00:00+03:30`,projectId:PROJECT_ID,seriesId:SERIES_ID,seriesCode:'QC010-001',mixName:mixSeries.name,engine:'QC-010',revision:0,
    approvalRef,snapshotVersion:mixSnapshot.engineVersion,designFingerprint:mixSnapshot.calculationFingerprint,
    date,time:`0${7+i}:30`.slice(-5),ticket,volume,plant:'بچینگ مرکزی طلوع — کارخانه نمونه (فرضی)',line:'خط ۱',truck:`TM-${String(20+i).padStart(2,'0')}`,
    driver:`راننده ${i} (فرضی)`,operator:'اپراتور بچینگ — ع. مرادی (فرضی)',qcInspector:'کارشناس QC — م. کریمی (فرضی)',
    project:'TL-DEMO-25-400 — مجتمع اداری آفتاب شرق',
    materialLots:{cement:'CII-260518-A',fine:'FA-260520',pea:'CA7-260520',almond:'CA5-260520',water:'W-2605'},
    notes:'بچ تولید نمونه QA بر پایه R0 تأییدشده؛ رطوبت روز تولید اندازه‌گیری و آب بچ بر مبنای آب آزاد سنگدانه اصلاح شده است.',
    density:round(density,1),slump,air,temperature:temp,returned:0,returnedAction:'none',
    tolerances:{cementitious:1,aggregate:2,water:1,admixture:2,yield:{min:.98,max:1.02},maxWcm:.50},
    moistureControl:{readingsPct:moistures,aggregateFreeWaterTargetKg:round(freeTarget,2),aggregateFreeWaterActualKg:round(freeActual,2)},
    ingredients,
    water:{target:round(waterTarget,2),actual:round(waterActual,2),deviation:waterDev,tolerance:1,withinTolerance:Math.abs(waterDev)<=1,freeTarget:round(freeTarget,2),freeActual:round(freeActual,2),effectiveActual:round(effectiveActual,2)},
    actualCementitious:round(cemActual,2),actualWcm:round(actualWcm,4),totalActualMass:round(totalActual,2),yieldVolume:round(yieldVolume,4),relativeYield:round(relativeYield,4),
    control:{approvalPass,weighingPass,wcmPass,slumpPass,airPass,yieldPass,productionReady},
    status:productionReady?'ok':'review',violations,qaStrength28:strength28,
    disposition:productionReady?'Released as controlled production batch under approved R0.':'Hold for QC review before release.'
  };
}
const productionBatches=[
  makeProductionBatch(1,'2026-07-01','B-260701-01',[3.4,1.5,1.1],[.10,.20,-.15,.10],.20,95,2.0,27,33.1),
  makeProductionBatch(2,'2026-07-08','B-260708-01',[3.6,1.4,1.2],[-.05,.10,.25,-.20],-.10,100,1.9,28,33.6),
  makeProductionBatch(3,'2026-07-15','B-260715-01',[3.5,1.6,1.3],[.20,-.10,.15,.05],.15,105,2.1,29,32.9),
  makeProductionBatch(4,'2026-07-22','B-260722-01',[3.7,1.5,1.2],[.00,.30,-.20,.10],-.20,100,2.0,30,33.8),
  makeProductionBatch(5,'2026-07-29','B-260729-01',[3.8,1.7,1.1],[-.10,-.15,.20,-.05],.05,110,2.2,31,32.4),
  makeProductionBatch(6,'2026-08-05','B-260805-01',[3.4,1.6,1.2],[.15,.05,-.10,.20],.10,95,1.8,30,33.3)
];
const productionStats={
  count:productionBatches.length,
  totalVolumeM3:productionBatches.reduce((s,b)=>s+b.volume,0),
  meanWcm:round(productionBatches.reduce((s,b)=>s+b.actualWcm,0)/productionBatches.length,4),
  maxWcm:round(Math.max(...productionBatches.map(b=>b.actualWcm)),4),
  meanRelativeYield:round(productionBatches.reduce((s,b)=>s+b.relativeYield,0)/productionBatches.length,4),
  meanSlump:round(productionBatches.reduce((s,b)=>s+b.slump,0)/productionBatches.length,1),
  meanAir:round(productionBatches.reduce((s,b)=>s+b.air,0)/productionBatches.length,2),
  meanFc28:round(productionBatches.reduce((s,b)=>s+b.qaStrength28,0)/productionBatches.length,2),
  allReleased:productionBatches.every(b=>b.control.productionReady)
};

function addDays(iso,n){ const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10); }
function sampleStats(values){
  const vals=values.filter(Number.isFinite);
  if(!vals.length)return {n:0,mean:null,sd:null,covPct:null,min:null,max:null};
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
  const sd=vals.length>1?Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/(vals.length-1)):0;
  return {n:vals.length,mean:round(mean,3),sd:round(sd,3),covPct:mean?round(sd/mean*100,2):null,min:round(Math.min(...vals),3),max:round(Math.max(...vals),3)};
}
const qcTests=[];
trials.forEach((t,i)=>{
  [7,28].forEach(age=>{
    const v=t.strengths[String(age)];
    qcTests.push({
      id:`ST-DEMO-TR-${i+1}-${age}`,
      date:addDays(t.date,age),
      testId:`QC010-001-${t.batchNo}-${age}d`,
      mix:'QC010-001',seriesId:SERIES_ID,revision:'R0',revisionNo:0,lot:t.batchNo,
      plant:'آزمایشگاه طرح اختلاط',age,strength:v,target:25,designMeanTarget:stage31.fcm,
      specimens:clone(t.specimenSets[String(age)]||[]),
      materialLots:clone(t.materialLots),
      materialLot:'CII-260518-A / FA-260520 / CA7-260520 / CA5-260520',
      notes:age===28?'نتیجه 28روزه Trial متصل به Evidence تأیید R0.':'نتیجه 7روزه Trial برای کنترل روند رشد مقاومت.',
      source:'trial',sourceRef:`${SERIES_ID}|${t.id}|${age}`,projectId:PROJECT_ID,
      designFingerprint:mixSnapshot.calculationFingerprint,evidenceFingerprint:evfp,
      acceptance:{specifiedPass:age===28?v>=25:null,designMeanReference:stage31.fcm},
      createdAt:`${addDays(t.date,age)}T10:00:00+03:30`
    });
  });
});
productionBatches.forEach((b,i)=>{
  const strength7=round(b.qaStrength28*.73,1);
  qcTests.push({
    id:`ST-DEMO-P-${i+1}-7`,date:addDays(b.date,7),testId:`${b.ticket}-7d`,
    mix:'QC010-001',seriesId:SERIES_ID,revision:'R0',revisionNo:0,lot:b.ticket,plant:b.plant,
    age:7,strength:strength7,target:25,designMeanTarget:stage31.fcm,specimens:[round(strength7-.3,1),strength7,round(strength7+.3,1)],
    materialLots:clone(b.materialLots),materialLot:'CII-260518-A / FA-260520 / CA7-260520 / CA5-260520',
    notes:'کنترل روند 7روزه تولید نمونه؛ برای پذیرش نهایی، نتیجه 28روزه ملاک پرونده QA است.',
    source:'production',sourceRef:b.id,projectId:PROJECT_ID,
    designFingerprint:b.designFingerprint,evidenceFingerprint:b.approvalRef.evidenceFingerprint,
    batchControl:clone(b.control),createdAt:`${addDays(b.date,7)}T10:30:00+03:30`
  });
  qcTests.push({
    id:`ST-DEMO-P-${i+1}-28`,date:addDays(b.date,28),testId:`${b.ticket}-28d`,
    mix:'QC010-001',seriesId:SERIES_ID,revision:'R0',revisionNo:0,lot:b.ticket,plant:b.plant,
    age:28,strength:b.qaStrength28,target:25,designMeanTarget:stage31.fcm,
    specimens:[round(b.qaStrength28-.3,1),b.qaStrength28,round(b.qaStrength28+.3,1)],
    materialLots:clone(b.materialLots),materialLot:'CII-260518-A / FA-260520 / CA7-260520 / CA5-260520',
    notes:'کنترل مقاومت 28روزه تولید نمونه و اتصال مستقیم به Batch تولیدی و R0 تأییدشده.',
    source:'production',sourceRef:b.id,projectId:PROJECT_ID,
    designFingerprint:b.designFingerprint,evidenceFingerprint:b.approvalRef.evidenceFingerprint,
    acceptance:{specifiedPass:b.qaStrength28>=25,designMeanReference:stage31.fcm},
    batchControl:clone(b.control),createdAt:`${addDays(b.date,28)}T10:30:00+03:30`
  });
});

const trial7=qcTests.filter(t=>t.source==='trial'&&t.age===7);
const trial28=qcTests.filter(t=>t.source==='trial'&&t.age===28);
const prod7=qcTests.filter(t=>t.source==='production'&&t.age===7);
const prod28=qcTests.filter(t=>t.source==='production'&&t.age===28);
const productionFcStats=sampleStats(prod28.map(t=>t.strength));
const trialFcStats=sampleStats(trial28.map(t=>t.strength));
const combined28Stats=sampleStats([...trial28,...prod28].map(t=>t.strength));
const production7Stats=sampleStats(prod7.map(t=>t.strength));
const trial7Stats=sampleStats(trial7.map(t=>t.strength));
const qcTrend=prod28.map((t,i)=>({
  sequence:i+1,date:t.date,lot:t.lot,strength:t.strength,
  deltaFromSpecified:round(t.strength-25,2),
  deltaFromDesignMean:round(t.strength-stage31.fcm,2),
  movingMean3:i<2?null:round(prod28.slice(i-2,i+1).reduce((s,x)=>s+x.strength,0)/3,3)
}));
const qcSummary={
  projectId:PROJECT_ID,seriesId:SERIES_ID,revision:0,
  specifiedStrength:25,requiredMeanStrength:stage31.fcm,
  counts:{tests:qcTests.length,trial7:trial7.length,trial28:trial28.length,production7:prod7.length,production28:prod28.length},
  trial:{age7:trial7Stats,age28:trialFcStats},
  production:{age7:production7Stats,age28:productionFcStats},
  combined28:combined28Stats,
  allProduction28AboveSpecified:prod28.every(t=>t.strength>=25),
  productionMeanAboveDesignMean:productionFcStats.mean>=stage31.fcm,
  allProductionBatchesTraceable:prod28.every(t=>Boolean(t.sourceRef&&t.designFingerprint&&t.evidenceFingerprint&&t.materialLots)),
  trend:qcTrend,
  disposition:(prod28.every(t=>t.strength>=25)&&productionFcStats.mean>=stage31.fcm&&prod28.every(t=>t.batchControl?.productionReady))
    ?'stable-controlled'
    :'review-required',
  interpretation:'کنترل آماری نمونه بر مبنای نتایج ثبت‌شده همین پروژه است؛ نتایج 7روزه برای روند و نتایج 28روزه برای ارزیابی پرونده QA استفاده شده‌اند.'
};

const durabilityChecks=[
  {
    code:'design-integrity',
    state:(mixSeries.approvalRecord?.decision==='approved'&&mixSeries.approvalRecord?.designFingerprint===mixSnapshot.calculationFingerprint)?'pass':'fail',
    value:mixSnapshot.calculationFingerprint,
    limit:'Approved R0 fingerprint must match',
    why:'تحلیل دوام فقط روی همان R0 تأییدشده معتبر است.',
    ref:'Tolou approval integrity'
  },
  {
    code:'qc-status',
    state:qcSummary.disposition==='stable-controlled'?'pass':'review',
    value:qcSummary.disposition,
    limit:'stable-controlled',
    why:'وضعیت آماری تولید باید قبل از اتکای دوام به طرح، پایدار و قابل ردیابی باشد.',
    ref:'Tolou Stage 7 QC summary'
  },
  {
    code:'w/cm',
    state:.475<=.50?'pass':'fail',
    value:.475,
    limit:.50,
    why:'w/cm طرح = 0.475 و حداکثر الزام پروژه = 0.500.',
    ref:'Project requirement / approved R0'
  },
  {
    code:"f'c",
    state:25>=25?'pass':'fail',
    value:25,
    limit:25,
    why:"مقاومت مشخصه طرح = 25 MPa و حداقل الزام پروژه = 25 MPa.",
    ref:'Project requirement / approved R0'
  },
  {
    code:'production-mean',
    state:productionFcStats.mean>=stage31.fcm?'pass':'review',
    value:productionFcStats.mean,
    limit:stage31.fcm,
    why:`میانگین مقاومت 28روزه تولید ${productionFcStats.mean.toFixed(2)} MPa در برابر fcm = ${stage31.fcm.toFixed(2)} MPa کنترل شد.`,
    ref:'Tolou Stage 7 production statistics'
  },
  {
    code:'cement-type',
    state:'info',
    value:'Portland Type II',
    limit:null,
    why:'نوع سیمان R0 همان سیمان پرتلند تیپ II ثبت‌شده در Material Intelligence است؛ این رکورد به‌تنهایی جایگزین ارزیابی شیمیایی/محیطی اختصاصی نیست.',
    ref:'Material Intelligence revision 1'
  },
  {
    code:'chloride',
    state:'not-evaluable',
    value:.08,
    unit:'% cementitious',
    limit:null,
    why:'کلرید نمونه QA = 0.080% مواد سیمانی ثبت شده، اما در Requirements پروژه حد مجاز عددی کلرید ذخیره نشده است؛ بنابراین Pass/Fail قطعی صادر نمی‌شود.',
    ref:'QA sample input / missing project numeric limit'
  },
  {
    code:'calcium-chloride',
    state:'pass',
    value:'no',
    limit:'no',
    why:'در داده نمونه استفاده از CaCl2 ثبت نشده است.',
    ref:'QA sample input'
  }
];
const durabilityBlocking=durabilityChecks.filter(x=>x.state==='fail');
const durabilityReview=durabilityChecks.filter(x=>x.state==='review'||x.state==='not-evaluable');
const durabilityRecord={
  id:'DUR-DEMO-001',
  projectId:PROJECT_ID,
  seriesId:SERIES_ID,
  revision:0,
  at:'2026-08-10T12:00:00+03:30',
  mix:`${SERIES_ID}|0`,
  mixLabel:'QC010-001 — بتن معمولی C25 — سیمان تیپ II — عیار 400 — R0',
  designFingerprint:mixSnapshot.calculationFingerprint,
  evidenceFingerprint:evfp,
  approvalDecision:mixSeries.approvalRecord.decision,
  qcDisposition:qcSummary.disposition,
  exposureScenario:{
    codes:['F0','S0','W0','C0'],
    label:'سناریوی QA — شرایط معمول داخلی / غیرمهاجم',
    source:'Project Hub sample exposure + durability QA coding',
    disclaimer:'این کدگذاری برای اتصال End-to-End پروژه نمونه ذخیره شده و بدون Standard Profile دارای حدود عددی، ادعای انطباق مستقل استانداردی ایجاد نمی‌کند.'
  },
  member:'reinforced',
  materialBasis:{
    cement:{type:'II',materialId:materialIds.cement,revision:1,lot:'CII-260518-A'},
    aggregates:{blend:[44,37,19],caseId:AGG_CASE_ID},
    water:{materialId:materialIds.water,revision:1}
  },
  actual:{
    designWcm:.475,
    maxProductionWcm:productionStats.maxWcm,
    specifiedFc:25,
    productionMeanFc28:productionFcStats.mean,
    air:2,
    chloride:.08,
    chlorideUnit:'% cementitious',
    calciumChloride:'no'
  },
  projectLimits:{maxWcm:.50,minFc:25,maxChloride:null},
  governing:{maxW:.50,minFc:25,maxChloride:null},
  checks:durabilityChecks,
  blockingIssues:durabilityBlocking.map(x=>x.code),
  reviewItems:durabilityReview.map(x=>x.code),
  overall:durabilityBlocking.length?'fail':(durabilityReview.length?'acceptable-with-open-items':'pass'),
  disposition:durabilityBlocking.length
    ?'Do not release durability assessment until blocking items are resolved.'
    :'R0 is acceptable for the defined non-aggressive QA scenario based on project w/cm, strength and QC evidence; chloride compliance remains unclassified until a project/standard numeric limit is assigned.',
  revalidationTriggers:[
    'Material source or revision change',
    'Aggregate blend change',
    'Cement type/content change',
    'Design or production w/cm limit change',
    'Exposure classification change',
    'Project chloride limit assignment/change',
    'QC disposition change from stable-controlled'
  ],
  notes:'تحلیل دوام نمونه به داده‌های واقعی R0، Approval و QC متصل است. داده‌های آزمایشگاهی/محیطی فرضی‌اند و موارد بدون حد مرجع به‌صورت not-evaluable باقی می‌مانند.'
};

const ecoFactors={
  [`MAT:${materialIds.cement}`]:{
    price:3600,basis:'ton',gwp:.72,
    priceSource:'QA SAMPLE — illustrative unit price; replace with approved commercial source.',
    gwpSource:'QA SAMPLE — illustrative GWP factor; replace with verified EPD/LCA source.',
    priceQuality:'illustrative',gwpQuality:'illustrative',currency:'واحد نمونه',validForCommercialUse:false,validForEnvironmentalClaim:false
  },
  [`MAT:${materialIds.fine}`]:{
    price:480,basis:'ton',gwp:.005,
    priceSource:'QA SAMPLE — illustrative',gwpSource:'QA SAMPLE — illustrative',
    priceQuality:'illustrative',gwpQuality:'illustrative',currency:'واحد نمونه',validForCommercialUse:false,validForEnvironmentalClaim:false
  },
  [`MAT:${materialIds.pea}`]:{
    price:520,basis:'ton',gwp:.006,
    priceSource:'QA SAMPLE — illustrative',gwpSource:'QA SAMPLE — illustrative',
    priceQuality:'illustrative',gwpQuality:'illustrative',currency:'واحد نمونه',validForCommercialUse:false,validForEnvironmentalClaim:false
  },
  [`MAT:${materialIds.almond}`]:{
    price:560,basis:'ton',gwp:.0065,
    priceSource:'QA SAMPLE — illustrative',gwpSource:'QA SAMPLE — illustrative',
    priceQuality:'illustrative',gwpQuality:'illustrative',currency:'واحد نمونه',validForCommercialUse:false,validForEnvironmentalClaim:false
  },
  'water:mix':{
    price:.02,basis:'kg',gwp:.0003,
    priceSource:'QA SAMPLE — illustrative',gwpSource:'QA SAMPLE — illustrative',
    priceQuality:'illustrative',gwpQuality:'illustrative',currency:'واحد نمونه',validForCommercialUse:false,validForEnvironmentalClaim:false
  }
};
function ecoRows(){return [
  {key:`MAT:${materialIds.cement}`,name:materials[0].revisions[0].name,group:'مواد سیمانی',mass:400,meta:{materialId:materialIds.cement,code:materialCodes.cement,revision:1,lot:'CII-260518-A'}},
  {key:'water:mix',name:'آب اختلاط',group:'آب',mass:190,meta:{materialId:materialIds.water,code:materialCodes.water,revision:1,lot:'W-2605'}},
  {key:`MAT:${materialIds.fine}`,name:aggregateSources[0].name,group:'سنگدانه ریز',mass:round(ssdMasses[0],3),meta:{materialId:materialIds.fine,code:materialCodes.fine,revision:1,lot:'FA-260520'}},
  {key:`MAT:${materialIds.pea}`,name:aggregateSources[1].name,group:'سنگدانه',mass:round(ssdMasses[1],3),meta:{materialId:materialIds.pea,code:materialCodes.pea,revision:1,lot:'CA7-260520'}},
  {key:`MAT:${materialIds.almond}`,name:aggregateSources[2].name,group:'سنگدانه',mass:round(ssdMasses[2],3),meta:{materialId:materialIds.almond,code:materialCodes.almond,revision:1,lot:'CA5-260520'}}
];}
const erows=ecoRows();
let totalCost=0,totalCarbon=0;
erows.forEach(r=>{
  const f=ecoFactors[r.key];
  const cost=f.basis==='ton'?r.mass/1000*f.price:r.mass*f.price;
  const carbon=r.mass*f.gwp;
  totalCost+=cost;totalCarbon+=carbon;
  r.cost=round(cost,3);
  r.carbon=round(carbon,3);
  r.factor={
    price:f.price,basis:f.basis,currency:f.currency,priceSource:f.priceSource,priceQuality:f.priceQuality,
    gwp:f.gwp,gwpSource:f.gwpSource,gwpQuality:f.gwpQuality,
    validForCommercialUse:f.validForCommercialUse,validForEnvironmentalClaim:f.validForEnvironmentalClaim
  };
});
const massClosure=round(erows.reduce((s,r)=>s+r.mass,0),3);
const allPriceFactorsPresent=erows.every(r=>Number.isFinite(r.factor.price));
const allGwpFactorsPresent=erows.every(r=>Number.isFinite(r.factor.gwp));
const allCommercialFactorsVerified=erows.every(r=>r.factor.validForCommercialUse===true);
const allGwpFactorsVerified=erows.every(r=>r.factor.validForEnvironmentalClaim===true);
const economicsRecord={
  id:'ECO-DEMO-001',
  projectId:PROJECT_ID,
  seriesId:SERIES_ID,
  revision:0,
  designFingerprint:mixSnapshot.calculationFingerprint,
  evidenceFingerprint:evfp,
  approvalDecision:mixSeries.approvalRecord.decision,
  qcDisposition:qcSummary.disposition,
  durabilityDisposition:durabilityRecord.overall,
  savedAt:'2026-08-11T09:00:00+03:30',
  at:'2026-08-11T09:00:00+03:30',
  name:'تحلیل اقتصادی/کربن پروژه نمونه 25/400',
  mixKey:`${SERIES_ID}::0`,
  mixLabel:'QC010-001 — بتن معمولی C25 — سیمان تیپ II — عیار 400 — R0',
  basis:{
    scope:'1 m³ concrete',
    massBasis:'Approved R0 SSD design masses',
    cementKgM3:400,effectiveWaterKgM3:190,aggregateSSDTotalKgM3:round(totalAgg,3),totalConstituentMassKgM3:massClosure,
    aggregateBlend:[44,37,19],
    materialRevisionPolicy:'All material rows are tied to Material Intelligence revision 1 and QA lot identifiers.'
  },
  totalCost:round(totalCost,2),
  totalCarbon:round(totalCarbon,2),
  priceCoverage:allPriceFactorsPresent?100:round(erows.filter(r=>Number.isFinite(r.factor.price)).length/erows.length*100,1),
  gwpCoverage:allGwpFactorsPresent?100:round(erows.filter(r=>Number.isFinite(r.factor.gwp)).length/erows.length*100,1),
  verifiedCommercialCoverage:allCommercialFactorsVerified?100:0,
  verifiedEnvironmentalCoverage:allGwpFactorsVerified?100:0,
  costCoverage:allPriceFactorsPresent?100:0,
  carbonCoverage:allGwpFactorsPresent?100:0,
  performance:{
    value:productionFcStats.mean,
    basis:'میانگین مقاومت 28روزه تولید Stage 7',
    specifiedStrength:25,
    requiredMeanStrength:stage31.fcm,
    qcDisposition:qcSummary.disposition
  },
  strength:productionFcStats.mean,
  normalized:{
    costPerMPa:round(totalCost/productionFcStats.mean,3),
    carbonPerMPa:round(totalCarbon/productionFcStats.mean,3),
    cementKgPerMPa:round(400/productionFcStats.mean,3)
  },
  dataQuality:{
    computationalCompleteness:(allPriceFactorsPresent&&allGwpFactorsPresent)?'complete':'incomplete',
    commercialValidity:allCommercialFactorsVerified?'verified':'illustrative-only',
    environmentalClaimValidity:allGwpFactorsVerified?'verified':'illustrative-only',
    warning:'100% factor coverage means every row has a numeric factor; it does not mean the factors are commercially verified or EPD/LCA-verified.'
  },
  input:{
    name:'تحلیل اقتصادی/کربن پروژه نمونه 25/400',
    date:'2026-08-11',
    currency:'واحد نمونه',
    scope:'1 m³ بتن — صرفاً QA',
    overhead:0,transportCost:0,otherCost:0,otherCarbon:0,otherSource:'',
    notes:'تمام قیمت‌ها و عوامل GWP نمایشی هستند. خروجی برای آزمون اتصال و محاسبه معتبر است، اما برای خرید، قیمت‌گذاری، EPD، LCA یا ادعای محیط‌زیستی معتبر نیست.'
  },
  rows:erows,
  disposition:'Calculation path complete; commercial and environmental factors are illustrative-only until replaced by approved price sources and verified EPD/LCA data.',
  revalidationTriggers:[
    'Material revision or lot change',
    'Approved mix revision change',
    'Unit price or currency/source update',
    'GWP/EPD/LCA factor update',
    'Production QC performance basis change'
  ]
};

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
    ['دوام','تحلیل دوام','DurabilityAnalysis',durabilityRecord.id,'سناریوی دوام F0/S0/W0/C0 بررسی و ذخیره شد.',{overall:durabilityRecord.overall}],
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
    if(existingMarker?.version===SAMPLE_DATASET_VERSION&&existingMarker?.projectId===PROJECT_ID) return {ok:true,alreadySeeded:true,projectId:PROJECT_ID,seriesId:SERIES_ID};
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

    storage.setItem(SAMPLE_MARKER,JSON.stringify({version:SAMPLE_DATASET_VERSION,projectId:PROJECT_ID,seriesId:SERIES_ID,aggregateCaseId:AGG_CASE_ID,seededAt:new Date().toISOString(),dataset:'Tolou QA Sample C25/Cement400/TypeII',baselineChanged:false}));
    return {ok:true,projectId:PROJECT_ID,seriesId:SERIES_ID};
  } catch(error){ return {ok:false,reason:error?.message||String(error)}; }
}

module.exports={seedSampleProject,SAMPLE_MARKER,PROJECT_ID,SERIES_ID};