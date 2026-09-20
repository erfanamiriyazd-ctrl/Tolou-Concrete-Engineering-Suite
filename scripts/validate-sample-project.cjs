'use strict';

const assert = require('assert');
const { seedSampleProject, PROJECT_ID, SERIES_ID } = require('../electron/sample-project.cjs');

class MemoryStorage {
  constructor(){ this.map = new Map(); }
  getItem(k){ return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k,v){ this.map.set(k, String(v)); }
  removeItem(k){ this.map.delete(k); }
}
const storage = new MemoryStorage();
const result = seedSampleProject(storage);
assert.equal(result.ok, true, result.reason || 'sample seed failed');

const read = k => JSON.parse(storage.getItem(k) || 'null');
const approx = (a,b,tol,msg) => assert.ok(Math.abs(Number(a)-Number(b)) <= tol, `${msg}: got ${a}, expected ${b} ± ${tol}`);

const hub = read('Tolou_project_hub_v1');
const ml = read('Tolou_material_library_v1');
const agg = read('Tolou_aggregate_intelligence_v1');
const lab = read('Tolou_trial_lab_v1');
const qc = read('Tolou_quality_control_v1');
const prod = read('Tolou_production_intelligence_v1');
const dur = read('Tolou_durability_engine_v1');
const eco = read('Tolou_cost_sustainability_v1');
const opt = read('Tolou_multiobjective_optimizer_v1');

const project = hub.projects.find(x => x.id === PROJECT_ID);
assert(project, 'project missing');
assert.equal(project.requirements.fc, 25);
assert.equal(project.requirements.slump, 100);
assert.equal(project.requirements.maxWcm, .50);

assert.ok(ml.materials.length >= 5, 'material library incomplete');

const series = lab.series.find(x => x.id === SERIES_ID);
assert(series, 'mix series missing');
assert.equal(series.approvedRevision, 0);
assert.equal(series.approvalRecord.decision, 'approved');
assert.equal(series.approvalRecord.integrityStatus, 'valid');
assert.equal(series.trials.length, 5);

const snap = series.revisions.find(x => x.revision === 0).snapshot;
assert(snap, 'R0 snapshot missing');
assert.equal(snap.validationStatus, 'locked-for-trial');
approx(snap.cementContent, 400, 1e-9, 'cement');
approx(snap.effectiveWater, 190, 1e-9, 'effective water');
approx(snap.wcm, .475, 1e-9, 'w/cm');
approx(snap.airContent, 2, 1e-9, 'air');
assert.equal(snap.dmax, 25);

const a = snap.aggregates;
assert.equal(a.length, 3, 'aggregate count');
const ssd = a.map(x => Number(x.ssd));
approx(ssd[0], 774.510, .002, 'fine SSD');
approx(ssd[1], 651.293, .002, 'pea SSD');
approx(ssd[2], 334.448, .002, 'almond SSD');
const ssdTotal = ssd.reduce((x,y)=>x+y,0);
approx(ssdTotal, 1760.251, .003, 'SSD aggregate total');
const theoreticalMass = 400 + 190 + ssdTotal;
approx(theoreticalMass, 2350.251, .004, 'theoretical fresh unit mass');
approx(snap.totalWeight, theoreticalMass, .01, 'snapshot totalWeight');
approx(snap.volumeClosure, 1, 1e-9, 'absolute volume closure');
approx(snap.freeWaterTotal, 19.813, .01, 'aggregate free water');
approx(snap.batchWater, 170.187, .01, 'batch water');

const wetAggTotal = a.reduce((sum,x)=>sum+Number(x.batch),0);
approx(400 + Number(snap.batchWater) + wetAggTotal, theoreticalMass, .02, 'moisture-corrected batch mass closure');

const trial28 = series.trials.map(t => Number(t.strengths['28']));
const trialMean = trial28.reduce((x,y)=>x+y,0)/trial28.length;
approx(trialMean, 33.18, .001, 'trial 28d mean');
assert.ok(trialMean >= 32.53, 'trial mean below fcm');

const batches = prod.batches.filter(x => x.seriesId === SERIES_ID);
assert.equal(batches.length, 6, 'production batch count');
assert.ok(batches.every(x => x.status === 'ok'), 'production batch not released');
assert.ok(batches.every(x => x.control && x.control.productionReady), 'production gate failed');
assert.ok(batches.every(x => Number(x.actualWcm) <= .50), 'production w/cm exceeded');
assert.ok(batches.every(x => Number(x.relativeYield) >= .98 && Number(x.relativeYield) <= 1.02), 'yield out of range');
assert.ok(batches.every(x => x.designFingerprint === snap.calculationFingerprint), 'production fingerprint mismatch');

const prod28 = qc.tests.filter(x => x.seriesId === SERIES_ID && x.source === 'production' && x.age === 28);
assert.equal(prod28.length, 6, 'production 28d QC count');
const prodMean = prod28.reduce((s,x)=>s+Number(x.strength),0)/prod28.length;
approx(prodMean, 33.18, .005, 'production 28d mean');
assert.ok(prod28.every(x => Number(x.strength) >= 25), 'production strength below f\'c');

const drec = dur.records.find(x => x.id === 'DUR-DEMO-001');
assert(drec, 'durability record missing');
assert.equal(drec.designFingerprint, snap.calculationFingerprint);
assert.notEqual(drec.overall, 'fail');
assert.ok(drec.checks.some(x => x.code === 'chloride' && x.state === 'not-evaluable'), 'chloride should remain not-evaluable');

const erec = eco.records.find(x => x.id === 'ECO-DEMO-001');
assert(erec, 'economics record missing');
approx(erec.exPlantConcretePrice, 36800000, .01, 'ex-plant price');
approx(erec.deliveryFreight, 6800000, .01, 'delivery freight');
approx(erec.vatRatePct, 10, 1e-9, 'VAT');
approx(erec.deliveredWithVat, 47960000, .01, 'delivered with VAT');
approx(erec.pumpingCost, 2400000, .01, 'pumping');
approx(erec.totalCost, 50360000, .01, 'delivered + VAT + pumping');

const orec = opt.studies.find(x => x.id === 'OPT-DEMO-001');
assert(orec, 'optimizer study missing');
assert.equal(orec.constraints.cementFixed, 400);
assert.equal(orec.constraints.cementVariationAllowed, false);
assert.equal(orec.calibration.valid, true);
assert.ok(orec.candidates.length === 7, 'optimizer candidate count');
assert.ok(orec.candidates.every(x => x.wcm >= .46 && x.wcm <= .49), 'optimizer outside calibrated domain');

const appRequiredContracts = [
  'Tolou_project_hub_v1','Tolou_material_library_v1','Tolou_aggregate_intelligence_v1',
  'Tolou_trial_lab_v1','Tolou_quality_control_v1','Tolou_production_intelligence_v1',
  'Tolou_durability_engine_v1','Tolou_cost_sustainability_v1','Tolou_multiobjective_optimizer_v1'
];
for (const key of appRequiredContracts) assert.ok(storage.getItem(key), `missing storage contract ${key}`);

console.log(JSON.stringify({
  status:'PASS',
  project:PROJECT_ID,
  series:SERIES_ID,
  mix:{cement:400,water:190,wcm:.475,ssdAggregates:ssd,theoreticalFreshUnitMass:theoreticalMass,batchWater:snap.batchWater,volumeClosure:snap.volumeClosure},
  trials:{count:series.trials.length,mean28:trialMean},
  production:{count:batches.length,mean28:prodMean},
  economics:{exPlant:erec.exPlantConcretePrice,freight:erec.deliveryFreight,deliveredVat:erec.deliveredWithVat,pumping:erec.pumpingCost,total:erec.totalCost},
  optimizer:{candidates:orec.candidates.length,feasible:orec.feasibleCount}
}, null, 2));


// Startup wiring contract: the packaged app must seed from Electron main and reload renderer state.
const fs = require('fs');
const path = require('path');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
assert.ok(mainSource.includes('async function seedQaSampleIntoRenderer'), 'startup wiring: main-process seeder missing');
assert.ok(mainSource.includes("win.webContents.on('did-finish-load', async () =>"), 'startup wiring: did-finish-load integration missing');
assert.ok(mainSource.includes('win.webContents.reload()'), 'startup wiring: renderer reload after seed missing');
assert.ok(!preloadSource.includes('function seedQaSampleProject()'), 'startup wiring: legacy preload seeder must be removed');


const appSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const preloadBridgeSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
const bootstrapIndex = appSource.indexOf('id="tolou-qa-sample-bootstrap"');
const projectLoaderIndex = appSource.indexOf('function projectLoad()');
const trialLoaderIndex = appSource.indexOf('function loadTrialLab(');
assert.ok(bootstrapIndex >= 0, 'startup wiring: renderer pre-loader QA bootstrap missing');
assert.ok(projectLoaderIndex > bootstrapIndex, 'startup wiring: project loader executes before QA bootstrap');
assert.ok(trialLoaderIndex > bootstrapIndex, 'startup wiring: trial loader executes before QA bootstrap');
assert.ok(preloadBridgeSource.includes("sample: {"), 'startup wiring: sample bridge namespace missing');
assert.ok(preloadBridgeSource.includes("ipcRenderer.sendSync('tolou:sample:seed'"), 'startup wiring: synchronous seed IPC missing');

// UX-06 contract: analysis/optimization records must retain explicit project + mix + revision identity.
assert.ok(appSource.includes("r.seriesId=x.series.id;r.revision=x.revision.revision;r.mix=x.series.id+'|'+x.revision.revision"), 'UX-06: durability revision identity missing');
assert.ok(appSource.includes('r.seriesId=x.series.id;r.revision=x.revision.revision;'), 'UX-06: economics revision identity missing');
assert.ok(appSource.includes('seriesId:sel.series.id,revision:sel.revision.revision'), 'UX-06: optimizer source revision identity missing');
assert.ok(appSource.includes("این طرح متعلق به پروژه فعال نیست؛ ابتدا پروژه صحیح را فعال کنید."), 'UX-06: active-project guard missing');
assert.ok(appSource.includes("reason:'پیشنهاد موتور بهینه‌سازی چندهدفه — نیازمند آزمایش و تأیید مهندس'"), 'UX-06: optimizer candidate-to-revision path missing');

// UX-07 contract: each trial batch is permanently tied to project + series + revision.
assert.ok(appSource.includes('projectId:s.projectId||active,seriesId:s.id,revision:sourceRevision'), 'UX-07: trial identity contract missing');
assert.ok(appSource.includes('trialRevision(s,t.revision)||latestRevision(s)'), 'UX-07: trial evaluation must use its own revision snapshot');
assert.ok(appSource.includes('این پرونده طرح متعلق به پروژه فعال نیست؛ ابتدا پروژه صحیح را فعال کنید.'), 'UX-07: active-project trial guard missing');
assert.ok(appSource.includes('<th>بازنگری</th>'), 'UX-07: revision must be visible in trial history');
assert.ok(appSource.includes('<b>زمینه آزمایش:</b>'), 'UX-07: Persian trial context banner missing');

// UX-08 contract: revision approval is an explicit Persian decision workflow.
assert.ok(appSource.includes('onclick="rejectCurrentRevision()">رد بازنگری جاری</button>'), 'UX-08: reject action missing');
assert.ok(appSource.includes("decision:'rejected'"), 'UX-08: rejected decision record missing');
assert.ok(appSource.includes("decision:override?'override-approved':'approved'"), 'UX-08: approval/override history missing');
assert.ok(appSource.includes("s.status==='rejected'?'ردشده':'در انتظار بررسی'"), 'UX-08: Persian approval statuses missing');
assert.ok(appSource.includes('برای ادامه، بازنگری جدید ثبت کنید.'), 'UX-08: rejected-to-new-revision guidance missing');

// UX-09 contract: production consumes only the approved revision of the active project.
assert.ok(appSource.includes("&&(!active||s.projectId===active)"), 'UX-09: production must filter by active project');
assert.ok(appSource.includes('else if(arr.length===1){el.value=arr[0].id;prodNewDraft()}'), 'UX-09: single approved revision should auto-bind');
assert.ok(appSource.includes('projectId:ap.series.projectId||projectActiveId(),seriesId:ap.series.id'), 'UX-09: production draft context missing');
assert.ok(appSource.includes("وضعیت تأیید این طرح تغییر کرده است؛ بچ جدید را از بازنگری تأییدشده فعلی ایجاد کنید."), 'UX-09: stale approval guard missing');
assert.ok(appSource.includes("approvalDecision:d.approvalRecord?.overrideReason?'تأیید استثنایی':'تأییدشده'"), 'UX-09: approval traceability missing');

// UX-10 contract: QC keeps production/trial provenance and feeds traceable project feedback.
assert.ok(appSource.includes('id="qcProductionBatch"'), 'UX-10: production batch selector missing');
assert.ok(appSource.includes("source:prod?'production':'manual',productionBatchId:prod?.id||null,seriesId:"), 'UX-10: QC production traceability missing');
assert.ok(appSource.includes("source:'trial',sourceRef:ref,seriesId:s.id,productionBatchId:null"), 'UX-10: trial provenance contract missing');
assert.ok(appSource.includes('بچ تولید انتخاب‌شده متعلق به پروژه فعال نیست.'), 'UX-10: active-project production guard missing');
assert.ok(appSource.includes('داده‌های آزمایشگاهی و بچ‌های واقعی تولید با منبع مستقل نگهداری می‌شوند.'), 'UX-10: Persian provenance guidance missing');

// UX-11 contract: presentation is Persianized without mutating programming/data contracts.
assert.ok(appSource.includes('TolouProjectLibraryBridge'), 'UX-11: project bridge identifier was mutated');
assert.ok(appSource.includes('TolouProjectPackage'), 'UX-11: project package format identifier was mutated');
assert.ok(appSource.includes('function lifecycleInfo('), 'UX-11: lifecycleInfo identifier was mutated');
assert.ok(!appSource.includes('TolouپروژهLibraryBridge'), 'UX-11: mixed Persian programming identifier remains');
assert.ok(!appSource.includes('lifecycleاطلاعات'), 'UX-11: translated programming identifier remains');
assert.ok(appSource.includes('مرحله ۶.۵ — اعتبارسنجی نهایی سرتاسری و بستن رگرسیون'), 'UX-11: advanced workflow heading not Persianized');

// UX-12 contract: preview and print share a real A4 paged document model.
assert.ok(appSource.includes('width:210mm;height:297mm'), 'UX-12: physical A4 page dimensions missing');
assert.ok(appSource.includes('@page{size:A4 portrait;margin:0}'), 'UX-12: print page size contract missing');
assert.ok(appSource.includes('function reportPaginateMarkup(markup)'), 'UX-12: pagination engine missing');
assert.ok(appSource.includes('صفحه \${pageNo} از \${total}'), 'UX-12: page numbering missing');
assert.ok(appSource.includes('thead{display:table-header-group}'), 'UX-12: repeated table header print rule missing');
assert.ok(appSource.includes('const b=reportPagedBuild()'), 'UX-12: print/export must consume paged report');
assert.ok(!appSource.includes('pfLogoNone مانع'), 'UX-12: corrupted profile control id remains');
assert.ok(!appSource.includes('repNone مانعAll'), 'UX-12: corrupted report control id remains');

// UX-13 contract: dashboard is a real Engineering Command Center backed by project state.
assert.ok(appSource.includes('id="homeCommandCenter"'), 'UX-13: engineering command center surface missing');
assert.ok(appSource.includes('function uxRenderCommandCenter()'), 'UX-13: command center renderer missing');
assert.ok(appSource.includes("const d=projectData(p.id)"), 'UX-13: dashboard must consume active-project data');
assert.ok(appSource.includes('آزمایش‌های معلق'), 'UX-13: pending trial KPI missing');
assert.ok(appSource.includes('وضعیت تأیید'), 'UX-13: approval-state KPI missing');
assert.ok(appSource.includes('فعالیت اخیر پروژه'), 'UX-13: recent project activity panel missing');
assert.ok(appSource.includes('اقدام بعدی:'), 'UX-13: next-action guidance missing');
assert.ok(appSource.includes('uxRenderFlow‌کار();uxRenderCommandCenter();'), 'UX-13: command center is not wired into home render');

// UX-14 final report contract: Persian presentation + multi-table A4 pagination.
assert.ok(appSource.includes('function reportFaStatus(v)'), 'UX-14: report status localization helper missing');
assert.ok(appSource.includes("querySelectorAll(':scope > table.report-table')"), 'UX-14: paginator must process every direct report table');
assert.ok(appSource.includes('splitTable=(heading,table)=>'), 'UX-14: multi-table row pagination missing');
assert.ok(appSource.includes('وضعیت آزادسازی'), 'UX-14: production release label not Persianized');
assert.ok(appSource.includes("['مطالعه','تاریخ','گزینه‌های شدنی'"), 'UX-14: optimizer report headings not Persianized');
assert.ok(appSource.includes("x.source==='production'?'تولید':x.source==='trial'?'آزمایش طرح'"), 'UX-14: QC source labels not localized');
assert.ok(appSource.includes('function reportDoc(){const b=reportPagedBuild()'), 'UX-14: export must use the same paged A4 model as preview');

// UX-14 documentation + engineering-engine transparency contracts.
assert.ok(appSource.includes('راهنمای جامع نرم‌افزار'), 'UX-14: general software guide navigation missing');
assert.ok(appSource.includes('function buildGuideDoc(type)'), 'UX-14: refreshed QC-010/QC-012 live guides missing');
assert.ok(appSource.includes('function renderGeneralGuide()'), 'UX-14: step-by-step general guide renderer missing');
assert.ok(appSource.includes('function renderEngineeringEngine()'), 'UX-14: engineering engine transparency page missing');
assert.ok(appSource.includes('موتور مهندسی و معماری نرم‌افزار'), 'UX-14: engineering engine page heading missing');
assert.ok(appSource.includes('درصدها نمای معماری تقریبی'), 'UX-14: language chart measurement disclaimer missing');
assert.ok(appSource.includes('صحه‌گذاری</th>'), 'UX-14: standards validation column missing');
assert.ok(appSource.includes('function standardValidation(x)'), 'UX-14: evidence-based standards validation mapping missing');
assert.ok(appSource.includes('ممیزی کد و طراحی آزمون‌ها با کمک هوش مصنوعی'), 'UX-14: AI-assisted validation disclosure missing');
assert.ok(appSource.includes('جایگزین Validation آزمایشگاهی، بازبینی مهندس یا گواهی شخص ثالث نیست'), 'UX-14: validation limitation disclosure missing');



