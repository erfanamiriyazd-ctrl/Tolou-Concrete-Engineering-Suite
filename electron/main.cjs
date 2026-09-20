const { app, BrowserWindow, Menu, shell, ipcMain, dialog, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createPersistence } = require('./persistence.cjs');
const { createWindowState } = require('./window-state.cjs');
const { seedSampleProject } = require('./sample-project.cjs');

const APP_NAME = 'Tolou Concrete Engineering Suite';
const APP_ID = 'ir.tolou.concrete.engineering';
const BASELINE_FILE = path.join(__dirname, '..', 'app', 'index.html');
const PRELOAD_FILE = path.join(__dirname, 'preload.cjs');

let persistence;
let appIsQuitting = false;
let mainWindow = null;
let windowState = null;


function buildSeededSampleStorage(existing = {}) {
  const map = new Map();
  for (const [key, value] of Object.entries(existing || {})) {
    if (value !== null && value !== undefined) map.set(key, String(value));
  }
  const storage = {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value))
  };
  const result = seedSampleProject(storage);
  return { result, storage: Object.fromEntries(map) };
}

ipcMain.on('tolou:sample:seed', (event, existing) => {
  try {
    event.returnValue = buildSeededSampleStorage(existing);
  } catch (error) {
    event.returnValue = { result: { ok: false, reason: error?.message || String(error) }, storage: existing || {} };
  }
});


async function seedQaSampleIntoRenderer(win) {
  if (!win || win.isDestroyed()) return { ok: false, reason: 'window-unavailable' };
  try {
    const existing = await win.webContents.executeJavaScript(`
      (() => {
        const storage = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key !== null) storage[key] = localStorage.getItem(key);
        }
        return storage;
      })()
    `, true);

    const beforeMarker = existing?.Tolou_sample_project_v1 || null;
    const seeded = buildSeededSampleStorage(existing || {});
    if (!seeded?.result?.ok) return seeded?.result || { ok: false, reason: 'seed-failed' };

    const afterMarker = seeded.storage?.Tolou_sample_project_v1 || null;
    const changed = beforeMarker !== afterMarker ||
      Object.keys(seeded.storage || {}).some(key => existing?.[key] !== seeded.storage[key]);

    if (!changed) return { ...seeded.result, changed: false };

    // Persist the same merged snapshot that will be applied to Chromium storage.
    if (persistence) {
      persistence.saveStorage(seeded.storage, {
        backupLabel: 'sample-seed',
        forceBackup: true
      });
    }

    await win.webContents.executeJavaScript(`
      (() => {
        const incoming = ${JSON.stringify(seeded.storage)};
        for (const [key, value] of Object.entries(incoming)) {
          if (value !== null && value !== undefined) localStorage.setItem(key, String(value));
        }
        sessionStorage.setItem('__tolou_sample_seed_reload__', '1');
        return true;
      })()
    `, true);

    return { ...seeded.result, changed: true };
  } catch (error) {
    return { ok: false, reason: error?.message || String(error) };
  }
}

async function runUiSmoke(win) {
  const dir = process.env.TOLOU_UI_SMOKE_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const stage = process.env.TOLOU_UI_SMOKE_STAGE || 'all';
  const failures = [];
  const results = [];
  const sanitize = (name) => String(name).replace(/[^a-z0-9_-]/gi, '-');

  async function capture(name) {
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, sanitize(name) + '.png'), image.toPNG());
  }

  async function stage1Projects() {
    const payload = await win.webContents.executeJavaScript(`
      (async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const nav = document.querySelector('#nav button[data-view="projects"]');
        if (nav) nav.click();
        await sleep(250);
        if (typeof projectLoad === 'function') projectLoad();
        await sleep(200);
        const view = document.getElementById('view-projects');
        const rect = view?.getBoundingClientRect();
        const visible = !!view && view.classList.contains('active') && rect.width > 0 && rect.height > 0 &&
          getComputedStyle(view).display !== 'none' && getComputedStyle(view).visibility !== 'hidden';
        return {
          visible,
          list: document.getElementById('prProjectList')?.innerText || '',
          active: document.getElementById('prActiveInfo')?.innerText || '',
          form: {
            code: document.getElementById('prCode')?.value || '',
            name: document.getElementById('prName')?.value || '',
            fc: document.getElementById('prReqFc')?.value || '',
            slump: document.getElementById('prReqSlump')?.value || '',
            wcm: document.getElementById('prReqWcm')?.value || '',
            method: document.getElementById('prBaseMethod')?.value || '',
            grade: document.getElementById('prIranSiteGrade')?.value || '',
            fcClass: document.getElementById('prIranFcClass')?.value || ''
          },
          kpis: document.getElementById('prKpis')?.innerText || '',
          timeline: document.getElementById('prTimeline')?.innerText || ''
        };
      })()
    `, true);
    const checks = {
      pageVisible: payload.visible === true,
      projectListed: payload.list.includes('TL-DEMO-25-400') && payload.list.includes('مجتمع اداری آفتاب شرق'),
      activeProject: payload.active.includes('TL-DEMO-25-400') && payload.active.includes('مجتمع اداری آفتاب شرق'),
      formIdentity: payload.form.code === 'TL-DEMO-25-400' && payload.form.name.includes('مجتمع اداری آفتاب شرق'),
      engineeringRequirements:
        Number(payload.form.fc) === 25 &&
        Number(payload.form.slump) === 100 &&
        Number(payload.form.wcm) === 0.5 &&
        payload.form.method === 'iran479' &&
        payload.form.grade === 'B' &&
        payload.form.fcClass === '25'
    };
    const ok = Object.values(checks).every(Boolean);
    results.push({ name:'01-projects', ok, checks, payload });
    if (!ok) failures.push('01-projects: ' + Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
    await capture('01-projects');
  }

  async function stage2MixLibrary() {
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const nav = document.querySelector('#nav button[data-view="mix-library"]');
          if (nav) nav.click();
          await sleep(250);
          if (typeof loadTrialLab === 'function') loadTrialLab();
          if (typeof mlRender === 'function') mlRender();
          await sleep(200);

          const view = document.getElementById('view-mix-library');
          const rect = view?.getBoundingClientRect();
          const visible = !!view && view.classList.contains('active') && rect.width > 0 && rect.height > 0 &&
            getComputedStyle(view).display !== 'none' && getComputedStyle(view).visibility !== 'hidden';

          const count = document.getElementById('mlCount')?.innerText || '';
          const list = document.getElementById('mlList')?.innerText || '';
          const detail = document.getElementById('mlDetail')?.innerText || '';
          const selected = typeof mixLibSelectedId !== 'undefined' ? mixLibSelectedId : null;
          const series = typeof trialLab !== 'undefined'
            ? (trialLab.series || []).find(s => s.id === 'MX-DEMO-25-400')
            : null;
          const r0 = series?.revisions?.find(r => Number(r.revision) === 0) || null;
          const completeness = typeof mixCompleteness === 'function' && series ? mixCompleteness(series, r0) : null;

          return {
            visible,
            count,
            list,
            detail,
            selected,
            series: series ? {
              id: series.id,
              code: series.code,
              name: series.name,
              projectId: series.projectId,
              status: series.status,
              approvedRevision: series.approvedRevision,
              trials: series.trials?.length || 0,
              revisions: series.revisions?.length || 0,
              approvalDecision: series.approvalRecord?.decision || null,
              approvalIntegrity: series.approvalRecord?.integrityStatus || null
            } : null,
            r0: r0 ? {
              revision: r0.revision,
              reason: r0.reason || '',
              hasSnapshot: !!r0.snapshot,
              cement: r0.snapshot?.cementContent,
              water: r0.snapshot?.effectiveWater,
              wcm: r0.snapshot?.wcm,
              targetStrength: r0.snapshot?.targetStrength,
              validationStatus: r0.snapshot?.validationStatus,
              fingerprint: r0.snapshot?.calculationFingerprint || ''
            } : null,
            completeness
          };
        })()
      `, true);

      const checks = {
        pageVisible: payload.visible === true,
        countAtLeastOne: Number(String(payload.count)
          .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
          .replace(/[^0-9]/g,'')) >= 1,
        listShowsMix: payload.list.includes('QC010-001') && payload.list.includes('C25'),
        listShowsProject: payload.list.includes('مجتمع اداری آفتاب شرق'),
        listShowsApproved: payload.list.includes('تأییدشده'),
        detailShowsR0: payload.detail.includes('R0'),
        detailShowsTrials: payload.detail.includes('5 آزمایش') || payload.detail.includes('۵ آزمایش'),
        selectedCorrect: payload.selected === 'MX-DEMO-25-400',
        seriesIdentity:
          payload.series?.id === 'MX-DEMO-25-400' &&
          payload.series?.code === 'QC010-001' &&
          payload.series?.projectId === 'PRJ-DEMO-25-400',
        approved:
          payload.series?.status === 'approved' &&
          Number(payload.series?.approvedRevision) === 0 &&
          payload.series?.approvalDecision === 'approved' &&
          payload.series?.approvalIntegrity === 'valid',
        revisionAndTrials:
          Number(payload.series?.trials) === 5 &&
          Number(payload.series?.revisions) >= 1,
        r0Engineering:
          Number(payload.r0?.revision) === 0 &&
          payload.r0?.hasSnapshot === true &&
          Number(payload.r0?.cement) === 400 &&
          Number(payload.r0?.water) === 190 &&
          Math.abs(Number(payload.r0?.wcm) - 0.475) < 1e-9 &&
          Number(payload.r0?.targetStrength) === 25 &&
          payload.r0?.validationStatus === 'locked-for-trial' &&
          !!payload.r0?.fingerprint,
        completeness: Number(payload.completeness?.score) >= 80 && Array.isArray(payload.completeness?.missing)
      };

      const ok = Object.values(checks).every(Boolean);
      results.push({ name:'02-mix-library', ok, checks, payload });
      if (!ok) failures.push('02-mix-library: ' + Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
      await capture('02-mix-library');
    } catch (error) {
      results.push({ name:'02-mix-library', ok:false, error:error?.stack || error?.message || String(error) });
      failures.push('02-mix-library: ' + (error?.message || String(error)));
      await capture('02-mix-library-error').catch(()=>{});
    }
  }


  async function stage3Durability() {
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const nav = document.querySelector('#nav button[data-view="durability"]');
          if (nav) nav.click();
          await sleep(250);
          if (typeof durLoad === 'function') durLoad();
          if (typeof durRefreshMixOptions === 'function') durRefreshMixOptions();
          await sleep(200);

          const view = document.getElementById('view-durability');
          const rect = view?.getBoundingClientRect();
          const visible = !!view && view.classList.contains('active') && rect.width > 0 && rect.height > 0 &&
            getComputedStyle(view).display !== 'none' && getComputedStyle(view).visibility !== 'hidden';

          const mix = document.getElementById('durMix');
          const history = document.getElementById('durHistory');
          const summary = document.getElementById('durSummary');
          const rules = document.getElementById('durRules');
          const kpis = document.getElementById('durKpis');

          const selectedOptions = mix ? [...mix.options].map(o => ({value:o.value,text:o.textContent})) : [];
          const record = typeof durState !== 'undefined'
            ? (durState.records || []).find(r => r.id === 'DUR-DEMO-001')
            : null;

          return {
            visible,
            options: selectedOptions,
            currentValue: mix?.value || '',
            history: history?.innerText || '',
            summary: summary?.innerText || '',
            rules: rules?.innerText || '',
            kpis: kpis?.innerText || '',
            record: record ? {
              id: record.id,
              projectId: record.projectId,
              seriesId: record.seriesId,
              revision: record.revision,
              mix: record.mix,
              mixLabel: record.mixLabel,
              codes: record.exposureScenario?.codes || record.codes || [],
              overall: record.overall,
              blockingIssues: record.blockingIssues || [],
              reviewItems: record.reviewItems || [],
              designWcm: record.actual?.designWcm,
              maxProductionWcm: record.actual?.maxProductionWcm,
              specifiedFc: record.actual?.specifiedFc,
              productionMeanFc28: record.actual?.productionMeanFc28,
              maxWcm: record.projectLimits?.maxWcm,
              minFc: record.projectLimits?.minFc,
              designFingerprint: record.designFingerprint,
              evidenceFingerprint: record.evidenceFingerprint
            } : null
          };
        })()
      `, true);

      const hasMixOption = payload.options.some(o =>
        o.value.includes('MX-DEMO-25-400') &&
        o.text.includes('QC010-001') &&
        o.text.includes('R0')
      );

      const checks = {
        pageVisible: payload.visible === true,
        mixRecognized: hasMixOption && payload.currentValue === 'MX-DEMO-25-400|0',
        historyShowsRecord:
          payload.history.includes('QC010-001') &&
          payload.history.includes('F0/S0/W0/C0'),
        analysisVisible:
          payload.summary.includes('نیازمند بررسی') &&
          (payload.rules.includes('chloride') || payload.rules.includes('کلرید') || payload.rules.includes('w/cm')),
        kpisVisible:
          payload.kpis.includes('0.50') &&
          payload.kpis.includes('25 MPa') &&
          payload.kpis.includes('F0 / S0 / W0 / C0'),
        recordIdentity:
          payload.record?.id === 'DUR-DEMO-001' &&
          payload.record?.projectId === 'PRJ-DEMO-25-400' &&
          payload.record?.seriesId === 'MX-DEMO-25-400' &&
          Number(payload.record?.revision) === 0,
        exposureCodes:
          JSON.stringify(payload.record?.codes) === JSON.stringify(['F0','S0','W0','C0']),
        disposition:
          payload.record?.overall === 'acceptable-with-open-items' &&
          Array.isArray(payload.record?.blockingIssues) &&
          payload.record.blockingIssues.length === 0 &&
          Array.isArray(payload.record?.reviewItems) &&
          payload.record.reviewItems.includes('chloride'),
        engineeringValues:
          Math.abs(Number(payload.record?.designWcm) - 0.475) < 1e-9 &&
          Number(payload.record?.maxProductionWcm) <= 0.5 &&
          Number(payload.record?.specifiedFc) === 25 &&
          Number(payload.record?.productionMeanFc28) >= 32.53 &&
          Number(payload.record?.maxWcm) === 0.5 &&
          Number(payload.record?.minFc) === 25,
        traceability:
          !!payload.record?.designFingerprint &&
          !!payload.record?.evidenceFingerprint
      };

      const ok = Object.values(checks).every(Boolean);
      results.push({ name:'03-durability', ok, checks, payload });
      if (!ok) failures.push('03-durability: ' + Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
      await capture('03-durability');
    } catch (error) {
      results.push({ name:'03-durability', ok:false, error:error?.stack || error?.message || String(error) });
      failures.push('03-durability: ' + (error?.message || String(error)));
      await capture('03-durability-error').catch(()=>{});
    }
  }


  async function stage4Economics() {
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const nav = document.querySelector('#nav button[data-view="economics"]');
          if (nav) nav.click();
          await sleep(250);
          if (typeof ecoLoad === 'function') ecoLoad();
          if (typeof ecoRefreshMixOptions === 'function') ecoRefreshMixOptions();
          if (typeof ecoRenderAll === 'function') ecoRenderAll();
          await sleep(200);

          const view = document.getElementById('view-economics');
          const rect = view?.getBoundingClientRect();
          const visible = !!view && view.classList.contains('active') && rect.width > 0 && rect.height > 0 &&
            getComputedStyle(view).display !== 'none' && getComputedStyle(view).visibility !== 'hidden';

          const mix = document.getElementById('ecoMix');
          const history = document.getElementById('ecoHistory');
          const summary = document.getElementById('ecoSummary');
          const kpis = document.getElementById('ecoKpis');
          const table = document.getElementById('ecoTable');
          const quality = document.getElementById('ecoDataQuality');

          const options = mix ? [...mix.options].map(o => ({value:o.value,text:o.textContent})) : [];
          const record = typeof ecoState !== 'undefined'
            ? (ecoState.records || []).find(r => r.id === 'ECO-DEMO-001')
            : null;

          return {
            visible,
            options,
            currentValue: mix?.value || '',
            history: history?.innerText || '',
            summary: summary?.innerText || '',
            kpis: kpis?.innerText || '',
            table: table?.innerText || '',
            quality: quality?.innerText || '',
            record: record ? {
              id: record.id,
              projectId: record.projectId,
              seriesId: record.seriesId,
              revision: record.revision,
              mixKey: record.mixKey,
              mixLabel: record.mixLabel,
              exPlantConcretePrice: record.exPlantConcretePrice,
              deliveryFreight: record.deliveryFreight,
              vatRatePct: record.vatRatePct,
              vatAmount: record.vatAmount,
              deliveredWithVat: record.deliveredWithVat,
              pumpingCost: record.pumpingCost,
              totalCost: record.totalCost,
              materialCost: record.materialCost,
              totalCarbon: record.totalCarbon,
              commercialValidity: record.dataQuality?.commercialValidity,
              environmentalClaimValidity: record.dataQuality?.environmentalClaimValidity,
              warning: record.dataQuality?.warning || '',
              performanceValue: record.performance?.value,
              designFingerprint: record.designFingerprint,
              evidenceFingerprint: record.evidenceFingerprint
            } : null
          };
        })()
      `, true);

      const hasMixOption = payload.options.some(o =>
        o.value.includes('MX-DEMO-25-400') &&
        o.text.includes('QC010-001') &&
        o.text.includes('R0')
      );

      const checks = {
        pageVisible: payload.visible === true,
        mixRecognized: hasMixOption && payload.currentValue === 'MX-DEMO-25-400::0',
        historyShowsRecord:
          payload.history.includes('تحلیل اقتصادی/کربن پروژه نمونه 25/400') ||
          payload.history.includes('QC010-001'),
        hydratedKpis:
          payload.kpis.length > 50 &&
          payload.kpis.includes('kgCO₂e') &&
          payload.kpis.includes('33.2'),
        commercialSummary:
          (payload.summary.includes('۳۶٬۸۰۰٬۰۰۰') || payload.summary.includes('36,800,000')) &&
          (payload.summary.includes('۶٬۸۰۰٬۰۰۰') || payload.summary.includes('6,800,000')) &&
          (payload.summary.includes('۴٬۳۶۰٬۰۰۰') || payload.summary.includes('4,360,000')) &&
          (payload.summary.includes('۴۷٬۹۶۰٬۰۰۰') || payload.summary.includes('47,960,000')) &&
          (payload.summary.includes('۲٬۴۰۰٬۰۰۰') || payload.summary.includes('2,400,000')) &&
          (payload.summary.includes('۵۰٬۳۶۰٬۰۰۰') || payload.summary.includes('50,360,000')),
        gwpWarning:
          payload.summary.includes('GWP') &&
          (payload.summary.includes('illustrative') || payload.quality.includes('illustrative-only')),
        recordIdentity:
          payload.record?.id === 'ECO-DEMO-001' &&
          payload.record?.projectId === 'PRJ-DEMO-25-400' &&
          payload.record?.seriesId === 'MX-DEMO-25-400' &&
          Number(payload.record?.revision) === 0 &&
          payload.record?.mixKey === 'MX-DEMO-25-400::0',
        commercialNumbers:
          Number(payload.record?.exPlantConcretePrice) === 36800000 &&
          Number(payload.record?.deliveryFreight) === 6800000 &&
          Number(payload.record?.vatRatePct) === 10 &&
          Number(payload.record?.vatAmount) === 4360000 &&
          Number(payload.record?.deliveredWithVat) === 47960000 &&
          Number(payload.record?.pumpingCost) === 2400000 &&
          Number(payload.record?.totalCost) === 50360000,
        costBasis:
          Number(payload.record?.materialCost) > 23000000 &&
          Number(payload.record?.materialCost) < 25000000,
        performance:
          Number(payload.record?.performanceValue) >= 33.17 &&
          Number(payload.record?.performanceValue) <= 33.19,
        dataQuality:
          payload.record?.commercialValidity === 'project-priced-plus-sourced-estimates' &&
          payload.record?.environmentalClaimValidity === 'illustrative-only' &&
          payload.record?.warning.includes('GWP'),
        traceability:
          !!payload.record?.designFingerprint &&
          !!payload.record?.evidenceFingerprint
      };

      const ok = Object.values(checks).every(Boolean);
      results.push({ name:'04-economics', ok, checks, payload });
      if (!ok) failures.push('04-economics: ' + Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
      await capture('04-economics');
    } catch (error) {
      results.push({ name:'04-economics', ok:false, error:error?.stack || error?.message || String(error) });
      failures.push('04-economics: ' + (error?.message || String(error)));
      await capture('04-economics-error').catch(()=>{});
    }
  }


  async function stage5Optimization() {
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const nav = document.querySelector('#nav button[data-view="optimization"]');
          if (nav) nav.click();
          await sleep(250);
          if (typeof optLoad === 'function') optLoad();
          if (typeof optRefreshMixOptions === 'function') optRefreshMixOptions(true);
          await sleep(200);

          const view = document.getElementById('view-optimization');
          const rect = view?.getBoundingClientRect();
          const visible = !!view && view.classList.contains('active') && rect.width > 0 && rect.height > 0 &&
            getComputedStyle(view).display !== 'none' && getComputedStyle(view).visibility !== 'hidden';

          const mix = document.getElementById('optMix');
          const history = document.getElementById('optHistory');
          const summary = document.getElementById('optResultNote');
          const table = document.getElementById('optResults');
          const kpis = document.getElementById('optStatus');
          const calibration = document.getElementById('optCalibration');
          const options = mix ? [...mix.options].map(o => ({value:o.value,text:o.textContent})) : [];

          const study = typeof optState !== 'undefined'
            ? (optState.studies || []).find(r => r.id === 'OPT-DEMO-001')
            : null;

          return {
            visible,
            options,
            currentValue: mix?.value || '',
            history: history?.innerText || '',
            summary: summary?.innerText || '',
            table: table?.innerText || '',
            kpis: kpis?.innerText || '',
            calibration: calibration?.innerText || '',
            constraintUi: {
              wmin: document.getElementById('optWMin')?.value || '',
              wmax: document.getElementById('optWMax')?.value || '',
              wstep: document.getElementById('optWStep')?.value || '',
              cmmin: document.getElementById('optCmMin')?.value || '',
              cmmax: document.getElementById('optCmMax')?.value || '',
              cementMin: document.getElementById('optCementMin')?.value || '',
              scmMin: document.getElementById('optScmMin')?.value || '',
              scmMax: document.getElementById('optScmMax')?.value || '',
              maxWcm: document.getElementById('optDurW')?.value || '',
              waterMin: document.getElementById('optWaterMin')?.value || '',
              waterMax: document.getElementById('optWaterMax')?.value || '',
              strengthMin: document.getElementById('optStrengthMin')?.value || '',
              enforceStrength: !!document.getElementById('optEnforceStrength')?.checked
            },
            objectiveUi: {
              cost: !!document.getElementById('optObjCost')?.checked,
              carbon: !!document.getElementById('optObjCarbon')?.checked,
              strength: !!document.getElementById('optObjStrength')?.checked
            },
            study: study ? {
              id: study.id,
              projectId: study.projectId,
              source: study.source,
              sourceLabel: study.sourceLabel,
              constraints: study.constraints,
              calibration: study.calibration,
              objectives: study.objectives,
              candidates: study.candidates,
              feasibleCount: study.feasibleCount,
              pareto: study.pareto,
              selectedCandidateId: study.selectedCandidateId,
              designFingerprint: study.designFingerprint,
              evidenceFingerprint: study.evidenceFingerprint,
              dataQuality: study.dataQuality
            } : null
          };
        })()
      `, true);

      const hasMixOption = payload.options.some(o =>
        o.value.includes('MX-DEMO-25-400') &&
        o.text.includes('QC010-001') &&
        o.text.includes('R0')
      );

      const cands = payload.study?.candidates || [];
      const wcmValues = cands.map(x=>Number(x.wcm));
      const checks = {
        pageVisible: payload.visible === true,
        mixRecognized: hasMixOption,
        studyIdentity:
          payload.study?.id === 'OPT-DEMO-001' &&
          payload.study?.projectId === 'PRJ-DEMO-25-400' &&
          payload.study?.source === 'MX-DEMO-25-400::0',
        constraints:
          Number(payload.study?.constraints?.cementFixed) === 400 &&
          payload.study?.constraints?.cementVariationAllowed === false &&
          Number(payload.study?.constraints?.maxWcm) === 0.5 &&
          Number(payload.study?.constraints?.waterMin) === 175 &&
          Number(payload.study?.constraints?.waterMax) === 205,
        calibration:
          payload.study?.calibration?.valid === true &&
          Number(payload.study?.calibration?.n) === 5 &&
          Math.abs(Number(payload.study?.calibration?.wMin)-0.46) < 1e-9 &&
          Math.abs(Number(payload.study?.calibration?.wMax)-0.49) < 1e-9 &&
          Number(payload.study?.calibration?.r2) >= 0.8,
        hydratedConstraints:
          Math.abs(Number(payload.constraintUi?.wmin)-0.46) < 1e-9 &&
          Math.abs(Number(payload.constraintUi?.wmax)-0.49) < 1e-9 &&
          Math.abs(Number(payload.constraintUi?.wstep)-0.005) < 1e-9 &&
          Number(payload.constraintUi?.cmmin) === 400 &&
          Number(payload.constraintUi?.cmmax) === 400 &&
          Number(payload.constraintUi?.cementMin) === 400 &&
          Number(payload.constraintUi?.scmMin) === 0 &&
          Number(payload.constraintUi?.scmMax) === 0 &&
          Number(payload.constraintUi?.maxWcm) === 0.5 &&
          Number(payload.constraintUi?.waterMin) === 175 &&
          Number(payload.constraintUi?.waterMax) === 205 &&
          Math.abs(Number(payload.constraintUi?.strengthMin)-32.53) < 1e-9 &&
          payload.constraintUi?.enforceStrength === true,
        hydratedObjectives:
          payload.objectiveUi?.cost === true &&
          payload.objectiveUi?.carbon === true &&
          payload.objectiveUi?.strength === false,
        candidates:
          cands.length === 7 &&
          wcmValues.every(v => v >= 0.46-1e-9 && v <= 0.49+1e-9) &&
          cands.every(x => Number(x.cm ?? x.cement) === 400),
        feasibility:
          Number(payload.study?.feasibleCount) >= 1 &&
          cands.some(x => x.feasible === true),
        pareto:
          Array.isArray(payload.study?.pareto) &&
          payload.study.pareto.length >= 1,
        noAutoSelection:
          payload.study?.selectedCandidateId == null ||
          payload.study?.selectedCandidateId === '',
        objectives:
          Array.isArray(payload.study?.objectives) &&
          payload.study.objectives.some(o=>(typeof o==='string'?o:o.id)==='exPlantCost') &&
          payload.study.objectives.some(o=>(typeof o==='string'?o:o.id)==='carbon'),
        historyVisible:
          payload.history.includes('QC010-001') || payload.history.includes('OPT-DEMO-001'),
        hydratedUi:
          payload.kpis.includes('حجم مطلق کامل') &&
          payload.kpis.includes('0.475') &&
          (payload.kpis.includes('5') || payload.kpis.includes('۵')) &&
          payload.kpis.includes('0.500') &&
          (payload.summary.includes('5') || payload.summary.includes('۵')) &&
          (payload.summary.includes('1') || payload.summary.includes('۱')) &&
          payload.summary.includes('غیرمغلوب') &&
          payload.table.includes('0.480') &&
          payload.table.includes('400.0') &&
          payload.table.includes('32.7') &&
          payload.table.includes('غربالگری'),
        traceability:
          !!payload.study?.designFingerprint &&
          !!payload.study?.evidenceFingerprint
      };

      const ok = Object.values(checks).every(Boolean);
      results.push({ name:'05-optimization', ok, checks, payload });
      if (!ok) failures.push('05-optimization: ' + Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
      await capture('05-optimization');
    } catch (error) {
      results.push({ name:'05-optimization', ok:false, error:error?.stack || error?.message || String(error) });
      failures.push('05-optimization: ' + (error?.message || String(error)));
      await capture('05-optimization-error').catch(()=>{});
    }
  }


  async function stage6Reports() {
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const nav = document.querySelector('#nav button[data-view="reports"]');
          if (nav) nav.click();
          else if (typeof openView === 'function') openView('reports');
          await sleep(250);

          if (typeof reportLoad === 'function') reportLoad();
          if (typeof reportRefreshMixOptions === 'function') reportRefreshMixOptions();
          const mix = document.getElementById('repMix');
          if (mix && [...mix.options].some(o => o.value === 'MX-DEMO-25-400::0')) {
            mix.value = 'MX-DEMO-25-400::0';
          }
          document.querySelectorAll('[data-report-section]').forEach(x => { x.checked = true; });
          if (typeof window.reportGenerate === 'function') window.reportGenerate();
          await sleep(300);

          const view = document.getElementById('view-reports');
          const rect = view?.getBoundingClientRect();
          const visible = !!view && view.classList.contains('active') && rect.width > 0 && rect.height > 0 &&
            getComputedStyle(view).display !== 'none' && getComputedStyle(view).visibility !== 'hidden';
          const preview = document.getElementById('repPreview');
          const coverage = document.getElementById('repCoverage');
          const text = preview?.innerText || '';
          const headings = preview ? [...preview.querySelectorAll('.report-section > h3')].map(x => x.innerText) : [];
          const sectionChecks = [...document.querySelectorAll('[data-report-section]')].map(x => ({
            key:x.dataset.reportSection, checked:x.checked
          }));

          return {
            visible,
            currentValue: mix?.value || '',
            options: mix ? [...mix.options].map(o => ({value:o.value,text:o.textContent})) : [],
            coverage: coverage?.innerText || '',
            text,
            headings,
            sectionChecks,
            htmlLength: preview?.innerHTML?.length || 0
          };
        })()
      `, true);

      const checks = {
        pageVisible: payload.visible === true,
        mixRecognized:
          payload.currentValue === 'MX-DEMO-25-400::0' &&
          payload.options.some(o => o.value === 'MX-DEMO-25-400::0' && o.text.includes('QC010-001') && o.text.includes('R0')),
        generated:
          payload.htmlLength > 10000 &&
          payload.headings.length >= 16 &&
          payload.sectionChecks.every(x => x.checked),
        projectRequirements:
          payload.text.includes('TL-DEMO-25-400') &&
          payload.text.includes('مجتمع اداری آفتاب شرق') &&
          payload.text.includes('25 MPa') &&
          payload.text.includes('100 mm') &&
          payload.text.includes('0.5'),
        designBasis:
          payload.text.includes('32.53 MPa') &&
          payload.text.includes('4.5 MPa') &&
          payload.text.includes('0.475') &&
          payload.text.includes('25 mm'),
        proportions:
          payload.text.includes('سیمان') &&
          payload.text.includes('400') &&
          payload.text.includes('آب مؤثر') &&
          payload.text.includes('190') &&
          payload.text.includes('آب قابل افزودن به بچ') &&
          payload.text.includes('170.187') &&
          payload.text.includes('774.510') &&
          payload.text.includes('651.293') &&
          payload.text.includes('334.448') &&
          payload.text.includes('2350.251') &&
          payload.text.includes('جرم حجمی نظری بتن تازه / وزن واحد حجم') &&
          payload.text.includes('1.00000'),
        aggregateIntelligence:
          payload.text.includes('44% / 37% / 19%') &&
          payload.text.includes('RMSE'),
        trialApproval:
          payload.text.includes('نتایج طرح اختلاط آزمایشی') &&
          payload.text.includes('34.6') &&
          payload.text.includes('31.7') &&
          payload.text.includes('تأیید و سلامت بازنگری') &&
          payload.text.includes('approved') &&
          payload.text.includes('valid') &&
          payload.text.includes('Design fingerprint') &&
          payload.text.includes('Evidence fingerprint'),
        productionBatching:
          payload.text.includes('تولید و بچینگ') &&
          payload.text.includes('B-260701-01') &&
          payload.text.includes('B-260805-01') &&
          payload.text.includes('کارت بچینگ') &&
          payload.text.includes('Relative Yield'),
        qcStatistics:
          payload.text.includes('کنترل کیفیت و مقاومت') &&
          payload.text.includes('میانگین مقاومت تولید') &&
          payload.text.includes('33.183') &&
          payload.text.includes('SD نمونه') &&
          payload.text.includes('COV'),
        durability:
          payload.text.includes('دوام و انطباق') &&
          payload.text.includes('acceptable-with-open-items') &&
          payload.text.includes('F0 / S0 / W0 / C0') &&
          payload.text.includes('chloride'),
        economics:
          payload.text.includes('هزینه و پایداری') &&
          payload.text.includes('36800000') &&
          payload.text.includes('6800000') &&
          payload.text.includes('47960000') &&
          payload.text.includes('2400000') &&
          payload.text.includes('50360000') &&
          payload.text.includes('illustrative-only'),
        optimization:
          payload.text.includes('OPT-DEMO-001') &&
          payload.text.includes('بهینه‌سازی') &&
          payload.text.includes('0.46') &&
          payload.text.includes('0.49') &&
          payload.text.includes('بدون انتخاب خودکار') &&
          payload.text.includes('C-DEMO-'),
        audit:
          payload.text.includes('دفتر ردیابی تغییرات') &&
          payload.text.includes('مطالعه چندهدفه')
      };

      const ok = Object.values(checks).every(Boolean);
      results.push({ name:'06-reports', ok, checks, payload });
      if (!ok) failures.push('06-reports: ' + Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
      await capture('06-reports');
    } catch (error) {
      results.push({ name:'06-reports', ok:false, error:error?.stack || error?.message || String(error) });
      failures.push('06-reports: ' + (error?.message || String(error)));
      await capture('06-reports-error').catch(()=>{});
    }
  }

  await new Promise(r => setTimeout(r, 1200));
  if (stage === 'projects') await stage1Projects();
  else if (stage === 'mix-library') await stage2MixLibrary();
  else if (stage === 'durability') await stage3Durability();
  else if (stage === 'economics') await stage4Economics();
  else if (stage === 'optimization') await stage5Optimization();
  else if (stage === 'reports') await stage6Reports();
  else if (stage === 'all') { await stage1Projects(); await stage2MixLibrary(); await stage3Durability(); await stage4Economics(); await stage5Optimization(); await stage6Reports(); }

  const report = { at:new Date().toISOString(), platform:process.platform, stage, failures, results };
  fs.writeFileSync(path.join(dir, 'ui-smoke-result.json'), JSON.stringify(report, null, 2), 'utf8');
  if (failures.length) {
    console.error('TOLOU_UI_SMOKE_FAIL', failures);
    app.exit(3);
  } else {
    console.log('TOLOU_UI_SMOKE_PASS');
    app.exit(0);
  }
}

function persistenceBootstrapScript() {
  return `
    (() => {
      if (window.__tolouDesktopPersistenceInstalled) return true;
      if (!window.tolouDesktop || !window.tolouDesktop.persistence) return false;

      let timer = null;
      let flushing = false;

      const collect = () => {
        const storage = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key !== null) storage[key] = localStorage.getItem(key);
        }
        return storage;
      };

      const flush = async () => {
        if (flushing) return;
        flushing = true;
        try {
          await window.tolouDesktop.persistence.saveSnapshot(collect());
        } finally {
          flushing = false;
        }
      };

      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { flush().catch(() => {}); }, 700);
      };

      const nativeSetItem = Storage.prototype.setItem;
      const nativeRemoveItem = Storage.prototype.removeItem;
      const nativeClear = Storage.prototype.clear;

      Storage.prototype.setItem = function() {
        const result = nativeSetItem.apply(this, arguments);
        if (this === localStorage) schedule();
        return result;
      };

      Storage.prototype.removeItem = function() {
        const result = nativeRemoveItem.apply(this, arguments);
        if (this === localStorage) schedule();
        return result;
      };

      Storage.prototype.clear = function() {
        const result = nativeClear.apply(this, arguments);
        if (this === localStorage) schedule();
        return result;
      };

      window.__tolouFlushPersistence = flush;
      window.__tolouDesktopPersistenceInstalled = true;

      setTimeout(() => { flush().catch(() => {}); }, 1200);
      setInterval(() => { flush().catch(() => {}); }, 60000);
      return true;
    })();
  `;
}

async function flushWindowPersistence(win) {
  if (!win || win.isDestroyed()) return false;
  try {
    return await win.webContents.executeJavaScript(
      `(async()=>{if(window.__tolouFlushPersistence){await window.__tolouFlushPersistence();return true;}return false;})()`,
      true
    );
  } catch {
    return false;
  }
}

async function exportBackup(win) {
  await flushWindowPersistence(win);
  const now = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(win, {
    title: 'ذخیره نسخه پشتیبان طلوع',
    defaultPath: path.join(app.getPath('documents'), 'Tolou-Backup-' + now + '.tolou-backup'),
    filters: [
      { name: 'Tolou Backup', extensions: ['tolou-backup'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  if (result.canceled || !result.filePath) return;
  const saved = persistence.exportBackup(result.filePath);
  if (!saved.ok) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'پشتیبان‌گیری انجام نشد',
      message: 'نسخه معتبر از داده‌های طلوع برای خروجی یافت نشد.'
    });
  }
}

async function restoreBackup(win) {
  const result = await dialog.showOpenDialog(win, {
    title: 'بازیابی نسخه پشتیبان طلوع',
    properties: ['openFile'],
    filters: [
      { name: 'Tolou Backup', extensions: ['tolou-backup', 'json'] }
    ]
  });
  if (result.canceled || !result.filePaths?.[0]) return;

  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['انصراف', 'بازیابی'],
    defaultId: 0,
    cancelId: 0,
    title: 'بازیابی اطلاعات',
    message: 'اطلاعات فعلی با نسخه پشتیبان انتخاب‌شده جایگزین شود؟',
    detail: 'قبل از جایگزینی، یک نسخه ایمنی از داده فعلی ساخته می‌شود.'
  });
  if (confirm.response !== 1) return;

  await flushWindowPersistence(win);
  const restored = persistence.importBackup(result.filePaths[0]);

  if (!restored.ok) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'بازیابی انجام نشد',
      message: 'فایل پشتیبان معتبر نیست یا سلامت آن تأیید نشد.',
      detail: String(restored.reason || 'UNKNOWN_ERROR')
    });
    return;
  }

  win.webContents.send('tolou:persistence:apply-restore', restored.storage);
}

function installApplicationMenu(win) {
  const template = [
    {
      label: 'فایل',
      submenu: [
        {
          label: 'ذخیره اطلاعات',
          accelerator: 'Ctrl+S',
          click: () => { flushWindowPersistence(win); }
        },
        {
          label: 'ایجاد نسخه پشتیبان…',
          accelerator: 'Ctrl+Shift+B',
          click: () => { exportBackup(win); }
        },
        {
          label: 'بازیابی نسخه پشتیبان…',
          accelerator: 'Ctrl+Shift+R',
          click: () => { restoreBackup(win); }
        },
        { type: 'separator' },
        {
          label: 'باز کردن پوشه اطلاعات',
          click: () => { shell.openPath(persistence.rootDir); }
        },
        { type: 'separator' },
        { role: 'quit', label: 'خروج' }
      ]
    },
    {
      label: 'نمایش',
      submenu: [
        { role: 'reload', label: 'بارگذاری مجدد' },
        { role: 'togglefullscreen', label: 'تمام‌صفحه' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  const savedWindow = windowState ? windowState.load() : { width: 1440, height: 900, maximized: false };
  const win = new BrowserWindow({
    title: APP_NAME,
    width: savedWindow.width,
    height: savedWindow.height,
    ...(Number.isFinite(savedWindow.x) && Number.isFinite(savedWindow.y) ? { x: savedWindow.x, y: savedWindow.y } : {}),
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#f4f5f2',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_FILE,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow = win;
  installApplicationMenu(win);

  if (savedWindow.maximized) {
    win.maximize();
  }

  win.once('ready-to-show', () => {
    win.show();
    if (process.env.TOLOU_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.webContents.on('did-finish-load', async () => {
    try {
      const seedResult = await seedQaSampleIntoRenderer(win);
      if (seedResult?.ok && seedResult.changed) {
        // Reload exactly once so every renderer module rehydrates from the now-populated localStorage.
        const shouldReload = await win.webContents.executeJavaScript(
          `(() => sessionStorage.getItem('__tolou_sample_seed_reload__') === '1')()`,
          true
        );
        if (shouldReload) {
          await win.webContents.executeJavaScript(
            `(() => { sessionStorage.removeItem('__tolou_sample_seed_reload__'); return true; })()`,
            true
          );
          win.webContents.reload();
          return;
        }
      }
    } catch (error) {
      console.error('Tolou QA sample bootstrap failed:', error);
    }

    win.webContents.executeJavaScript(persistenceBootstrapScript(), true).catch(() => {});
    if (process.env.TOLOU_UI_SMOKE_DIR) {
      runUiSmoke(win).catch(error => {
        console.error('Tolou UI smoke failed:', error);
        try {
          fs.mkdirSync(process.env.TOLOU_UI_SMOKE_DIR, { recursive: true });
          fs.writeFileSync(path.join(process.env.TOLOU_UI_SMOKE_DIR, 'ui-smoke-fatal.txt'), String(error?.stack || error), 'utf8');
        } catch {}
        app.exit(4);
      });
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  let closeAfterFlush = false;
  win.on('close', (event) => {
    if (closeAfterFlush || appIsQuitting) return;
    event.preventDefault();
    flushWindowPersistence(win).finally(() => {
      closeAfterFlush = true;
      win.close();
    });
  });

  let stateSaveTimer = null;
  const scheduleWindowStateSave = () => {
    clearTimeout(stateSaveTimer);
    stateSaveTimer = setTimeout(() => {
      if (windowState) windowState.save(win);
    }, 250);
  };
  win.on('resize', scheduleWindowStateSave);
  win.on('move', scheduleWindowStateSave);
  win.on('maximize', scheduleWindowStateSave);
  win.on('unmaximize', scheduleWindowStateSave);

  win.on('closed', () => {
    clearTimeout(stateSaveTimer);
    if (mainWindow === win) mainWindow = null;
  });

  win.loadFile(BASELINE_FILE).catch((error) => {
    console.error('Failed to load Tolou baseline:', error);
  });

  return win;
}

app.setName(APP_NAME);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
  persistence = createPersistence(app, ipcMain);
  windowState = createWindowState(app, screen);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', (event) => {
  if (appIsQuitting) return;
  const windows = BrowserWindow.getAllWindows();
  if (!windows.length) {
    appIsQuitting = true;
    return;
  }

  event.preventDefault();
  Promise.all(windows.map(flushWindowPersistence)).finally(() => {
    appIsQuitting = true;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
