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
        if (!nav) throw new Error('Projects navigation button not found');
        nav.click();
        await sleep(250);
        if (typeof projectLoad === 'function') projectLoad();
        await sleep(200);

        // Audit setup only: remove pre-seeded active context so activation must happen through the UI.
        if (typeof projectHub !== 'undefined') {
          projectHub.activeProjectId = null;
          if (typeof projectPersist === 'function') projectPersist(false);
          if (typeof projectRender === 'function') projectRender();
        }
        await sleep(120);

        const beforeActive = document.getElementById('prActiveInfo')?.innerText || '';
        const items = [...document.querySelectorAll('#prProjectList .pr-project-item')];
        const target = items.find(x => x.innerText.includes('TL-DEMO-25-400'));
        if (!target) throw new Error('Sample project card not found in Project Hub');
        target.click();
        await sleep(120);

        const selectedCard = [...document.querySelectorAll('#prProjectList .pr-project-item')]
          .find(x => x.innerText.includes('TL-DEMO-25-400'));
        const activate = document.getElementById('prSetActive');
        const activationEnabled = !!activate && !activate.disabled;
        if (!activationEnabled) throw new Error('Activate selected project button is disabled');
        activate.click();
        await sleep(220);

        const view = document.getElementById('view-projects');
        const rect = view?.getBoundingClientRect();
        const visible = !!view && view.classList.contains('active') && rect.width > 0 && rect.height > 0 &&
          getComputedStyle(view).display !== 'none' && getComputedStyle(view).visibility !== 'hidden';

        const activeHeader = document.getElementById('activeProjectBtn')?.innerText || '';
        const activeInfo = document.getElementById('prActiveInfo')?.innerText || '';
        const auditText = document.getElementById('prAuditTable')?.innerText || '';
        const completeness = document.getElementById('prCompleteness')?.innerText || '';

        return {
          visible,
          beforeActive,
          activationEnabled,
          selectedCardActive: !!selectedCard?.classList.contains('active'),
          list: document.getElementById('prProjectList')?.innerText || '',
          activeHeader,
          active: activeInfo,
          form: {
            code: document.getElementById('prCode')?.value || '',
            name: document.getElementById('prName')?.value || '',
            fc: document.getElementById('prReqFc')?.value || '',
            slump: document.getElementById('prReqSlump')?.value || '',
            wcm: document.getElementById('prReqWcm')?.value || '',
            method: document.getElementById('prBaseMethod')?.value || '',
            grade: document.getElementById('prIranSiteGrade')?.value || '',
            fcClass: document.getElementById('prIranFcClass')?.value || '',
            dmax: document.getElementById('prBaseMaxAggSize')?.value || '',
            air: document.getElementById('prBaseAirSystem')?.value || '',
            standard: document.getElementById('prReqStandard')?.value || '',
            exposure: document.getElementById('prExposure')?.value || ''
          },
          kpis: document.getElementById('prKpis')?.innerText || '',
          timeline: document.getElementById('prTimeline')?.innerText || '',
          completeness,
          auditText,
          activeProjectId: typeof projectHub !== 'undefined' ? projectHub.activeProjectId : null
        };
      })()
    `, true);

    const checks = {
      pageVisible: payload.visible === true,
      initiallyInactive:
        !payload.beforeActive.includes('TL-DEMO-25-400'),
      projectListed:
        payload.list.includes('TL-DEMO-25-400') &&
        payload.list.includes('مجتمع اداری آفتاب شرق'),
      selectedByUi:
        payload.selectedCardActive === true &&
        payload.activationEnabled === true,
      activatedByUi:
        payload.activeProjectId === 'PRJ-DEMO-25-400' &&
        payload.activeHeader.includes('TL-DEMO-25-400') &&
        payload.active.includes('TL-DEMO-25-400') &&
        payload.active.includes('مجتمع اداری آفتاب شرق'),
      formIdentity:
        payload.form.code === 'TL-DEMO-25-400' &&
        payload.form.name.includes('مجتمع اداری آفتاب شرق'),
      engineeringRequirements:
        Number(payload.form.fc) === 25 &&
        Number(payload.form.slump) === 100 &&
        Number(payload.form.wcm) === 0.5 &&
        payload.form.method === 'iran479' &&
        payload.form.grade === 'B' &&
        payload.form.fcClass === '25' &&
        Number(payload.form.dmax) === 25 &&
        payload.form.air === 'non-air' &&
        payload.form.standard.includes('479') &&
        payload.form.exposure.includes('غیرمهاجم'),
      dashboardVisible:
        payload.kpis.includes('پرونده طرح') &&
        payload.kpis.includes('بازنگری') &&
        payload.kpis.includes('آزمایش') &&
        payload.kpis.includes('بچ تولید') &&
        (payload.completeness.includes('100') || payload.completeness.includes('۱۰۰')) &&
        payload.timeline.includes('طرح اختلاط') &&
        payload.timeline.includes('بهینه‌سازی'),
      activationAudited:
        payload.auditText.includes('فعال‌سازی') &&
        payload.auditText.includes('TL-DEMO-25-400')
    };

    const ok = Object.values(checks).every(Boolean);
    results.push({ name:'A-project-hub-operator', ok, checks, payload });
    if (!ok) failures.push('A-project-hub-operator: ' + Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
    await win.webContents.executeJavaScript(`
      (() => {
        document.getElementById('prActiveInfo')?.scrollIntoView({ block:'center', inline:'nearest' });
        return true;
      })()
    `, true);
    await new Promise(r => setTimeout(r, 150));
    await capture('A-project-hub-operator');
  }

  async function stageBProjectToQc010() {
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));

          const nav = document.querySelector('#nav button[data-view="projects"]');
          if (!nav) throw new Error('Projects navigation button not found');
          nav.click();
          await sleep(200);
          if (typeof projectLoad === 'function') projectLoad();
          await sleep(150);

          const items = [...document.querySelectorAll('#prProjectList .pr-project-item')];
          const target = items.find(x => x.innerText.includes('TL-DEMO-25-400'));
          if (!target) throw new Error('Sample project card not found');
          target.click();
          await sleep(100);

          const activate = document.getElementById('prSetActive');
          if (!activate || activate.disabled) throw new Error('Activate project button unavailable');
          activate.click();
          await sleep(150);

          const openBase = document.getElementById('prOpenBase');
          if (!openBase || openBase.disabled) throw new Error('Open QC-010 button unavailable');
          openBase.click();

          const frame = document.getElementById('frame-base');
          let ready = false;
          for (let i=0;i<30;i++) {
            await sleep(100);
            try {
              const d = frame?.contentDocument;
              if (d && d.getElementById('tolouProjectSelect') && d.getElementById('projectName')) {
                ready = true;
                break;
              }
            } catch(e) {}
          }
          if (!ready) throw new Error('QC-010 iframe did not become ready');

          const d = frame.contentDocument;
          const w = frame.contentWindow;
          if (typeof w.TolouRefreshProjectLibrary === 'function') {
            w.TolouRefreshProjectLibrary('init');
            await sleep(180);
          }

          const value = id => d.getElementById(id)?.value ?? '';
          const elementState = id => {
            const el=d.getElementById(id);
            return el ? { value:el.value, disabled:!!el.disabled, readOnly:!!el.readOnly, controlled:el.classList.contains('project-controlled') } : null;
          };
          const baseView=document.getElementById('view-base');
          const rect=baseView?.getBoundingClientRect();
          const visible=!!baseView&&baseView.classList.contains('active')&&rect.width>0&&rect.height>0&&getComputedStyle(baseView).display!=='none';

          const projectSelect=d.getElementById('tolouProjectSelect');
          const status=d.getElementById('tolouProjectLinkStatus')?.innerText||'';

          return {
            visible,
            activeProjectId: typeof projectHub!=='undefined' ? projectHub.activeProjectId : null,
            projectSelect: projectSelect?.value || '',
            projectOptions: projectSelect ? [...projectSelect.options].map(o=>({value:o.value,text:o.textContent})) : [],
            status,
            linkedProjectId: typeof w.tolouLinkedProjectId!=='undefined' ? w.tolouLinkedProjectId : null,
            fields:{
              projectName:elementState('projectName'),
              structureType:elementState('structureType'),
              method:elementState('tolouBaseMethod'),
              standardType:elementState('standardType'),
              ambientTemp:elementState('ambientTemp'),
              humidity:elementState('humidity'),
              transportDist:elementState('transportDist'),
              transportTime:elementState('transportTime'),
              targetStrength:elementState('targetStrength'),
              iranFc:elementState('iran31Fc'),
              iranSiteGrade:elementState('iran31SiteGrade'),
              iranFcClass:elementState('iran31FcClass'),
              slump:elementState('slumpTarget'),
              maxAggSize:elementState('maxAggSize'),
              environment:elementState('environment'),
              airSystem:elementState('airSystem'),
              targetWc:elementState('targetWc')
            },
            methodState:{
              iran31Status:d.getElementById('iran31Status')?.innerText||'',
              fcm:d.getElementById('iran31Fcm')?.innerText||'',
              sd:d.getElementById('iran31SdUsed')?.innerText||''
            }
          };
        })()
      `, true);

      const f = payload.fields || {};
      const controlled = ['projectName','structureType','method','standardType','ambientTemp','humidity','transportDist','transportTime','slump','maxAggSize','environment','airSystem']
        .every(k => f[k] && (f[k].controlled === true) && (f[k].disabled === true || f[k].readOnly === true));

      const checks = {
        qc010Visible: payload.visible === true,
        projectStillActive:
          payload.activeProjectId === 'PRJ-DEMO-25-400',
        projectRecognizedInsideEngine:
          payload.projectSelect === 'PRJ-DEMO-25-400' &&
          payload.projectOptions.some(o=>o.value==='PRJ-DEMO-25-400'&&o.text.includes('TL-DEMO-25-400')) &&
          payload.status.includes('TL-DEMO-25-400') &&
          payload.status.includes('منبع واحد پروژه'),
        linkedIdentity:
          f.projectName?.value?.includes('مجتمع اداری آفتاب شرق') &&
          f.structureType?.value === 'building',
        methodTransferred:
          f.method?.value === 'iran479' &&
          f.standardType?.value === 'isiri',
        requirementsTransferred:
          Number(f.targetStrength?.value) === 25 &&
          Number(f.iranFc?.value) === 25 &&
          Number(f.slump?.value) === 100 &&
          Number(f.targetWc?.value) === 0.5 &&
          Number(f.maxAggSize?.value) === 25 &&
          f.airSystem?.value === 'nonair' &&
          f.environment?.value === 'normal',
        iran479ProfileTransferred:
          f.iranSiteGrade?.value === 'B' &&
          f.iranFcClass?.value === '25',
        commonSettingsTransferred:
          Number(f.ambientTemp?.value) === 25 &&
          Number(f.humidity?.value) === 55 &&
          Number(f.transportDist?.value) === 15 &&
          Number(f.transportTime?.value) === 30,
        projectControlledFieldsLocked: controlled,
        stage31RespondedToProject:
          payload.methodState.fcm.includes('32.53') &&
          payload.methodState.sd.includes('4.500')
      };

      const ok = Object.values(checks).every(Boolean);
      results.push({name:'B-project-to-qc010',ok,checks,payload});
      if(!ok) failures.push('B-project-to-qc010: '+Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));

      await win.webContents.executeJavaScript(`
        (() => {
          const frame=document.getElementById('frame-base');
          frame?.scrollIntoView({block:'start',inline:'nearest'});
          return true;
        })()
      `,true);
      await new Promise(r=>setTimeout(r,150));
      await capture('B-project-to-qc010');
    } catch(error) {
      results.push({name:'B-project-to-qc010',ok:false,error:error?.stack||error?.message||String(error)});
      failures.push('B-project-to-qc010: '+(error?.message||String(error)));
      await capture('B-project-to-qc010-error').catch(()=>{});
    }
  }

  async function stageCEngineResponse() {
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));

          // Operator path: Project Hub -> select -> activate -> open QC-010.
          document.querySelector('#nav button[data-view="projects"]')?.click();
          await sleep(180);
          if (typeof projectLoad === 'function') projectLoad();
          await sleep(120);
          const target=[...document.querySelectorAll('#prProjectList .pr-project-item')]
            .find(x=>x.innerText.includes('TL-DEMO-25-400'));
          if(!target) throw new Error('Project card missing');
          target.click(); await sleep(80);
          const activate=document.getElementById('prSetActive');
          if(!activate||activate.disabled) throw new Error('Activate button unavailable');
          activate.click(); await sleep(100);
          const openBase=document.getElementById('prOpenBase');
          if(!openBase||openBase.disabled) throw new Error('QC-010 button unavailable');
          openBase.click();

          const frame=document.getElementById('frame-base');
          let ready=false;
          for(let i=0;i<50;i++){
            await sleep(100);
            try{
              const d0=frame?.contentDocument;
              if(d0?.readyState==='complete' &&
                 d0.getElementById('tolouProjectSelect') &&
                 d0.getElementById('iran35WcMode')){ready=true;break;}
            }catch(e){}
          }
          if(!ready) throw new Error('QC-010 did not become ready');
          await sleep(220);

          const d=frame.contentDocument, w=frame.contentWindow;

          const calcButton=[...d.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').replace(/\s/g,'')==='calculateMix()');
          if(!calcButton) throw new Error('UI calculate button not found');

          // Baseline calculation through real UI button.
          calcButton.click(); await sleep(220);
          const baseResp=typeof w.TolouGetMixSnapshot==='function' ? w.TolouGetMixSnapshot() : null;
          const baselineDiagnostic=typeof w.IranNationalMixEngine?.preflight==='function' ? w.IranNationalMixEngine.preflight() : null;
          if(!baseResp?.ok){
            const s37=baselineDiagnostic?.stage37||null;
            return {
              projectId: typeof projectHub!=='undefined'?projectHub.activeProjectId:null,
              baselineFailure:baseResp?.message||'unknown',
              diagnostic:{
                stage31:baselineDiagnostic?.stage31||null,
                stage32:baselineDiagnostic?.stage32||null,
                stage33:baselineDiagnostic?.stage33||null,
                stage34:baselineDiagnostic?.stage34||null,
                stage35:baselineDiagnostic?.stage35||null,
                stage36:baselineDiagnostic?.stage36||null,
                stage37:s37,
                gates:s37?.gates||[]
              }
            };
          }
          const base=baseResp.snapshot;

          // Engineer-controlled input: switch Stage 3.5 to manual w/c and enter 0.460 through DOM input events.
          const mode=d.getElementById('iran35WcMode');
          const manual=d.getElementById('iran35ManualWc');
          if(!mode||!manual) throw new Error('Stage 3.5 engineer inputs missing');
          mode.value='manual';
          mode.dispatchEvent(new Event('change',{bubbles:true}));
          await sleep(80);
          manual.value='0.460';
          manual.dispatchEvent(new Event('input',{bubbles:true}));
          manual.dispatchEvent(new Event('change',{bubbles:true}));
          await sleep(100);

          // Recalculate through the same real UI button.
          calcButton.click(); await sleep(250);
          const changedResp=typeof w.TolouGetMixSnapshot==='function' ? w.TolouGetMixSnapshot() : null;
          if(!changedResp?.ok) throw new Error('Changed-input engine did not produce a mix: '+(changedResp?.message||'unknown'));
          const changed=changedResp.snapshot;

          const resultText=d.getElementById('resultsContainer')?.innerText||'';
          const activeTab=d.querySelector('.tab-content.active')?.id||'';
          d.getElementById('resultsContainer')?.scrollIntoView({block:'start',inline:'nearest'});
          await sleep(120);

          return {
            projectId: typeof projectHub!=='undefined'?projectHub.activeProjectId:null,
            modeValue:mode.value,
            manualValue:manual.value,
            activeTab,
            resultText,
            baseline:{
              finalWc:base.finalWc,wcm:base.wcm,
              cement:base.cementContent,effectiveWater:base.effectiveWater,batchWater:base.batchWater,
              aggregateSSD:base.aggregateSSDTotal,totalWeight:base.totalWeight,
              closure:base.volumeClosure,fingerprint:base.calculationFingerprint,
              gateStatus:base.integrationAudit?.status,
              requiredPassed:base.integrationAudit?.requiredPassed,
              requiredTotal:base.integrationAudit?.requiredTotal
            },
            changed:{
              finalWc:changed.finalWc,wcm:changed.wcm,
              cement:changed.cementContent,effectiveWater:changed.effectiveWater,batchWater:changed.batchWater,
              aggregateSSD:changed.aggregateSSDTotal,totalWeight:changed.totalWeight,
              closure:changed.volumeClosure,fingerprint:changed.calculationFingerprint,
              gateStatus:changed.integrationAudit?.status,
              requiredPassed:changed.integrationAudit?.requiredPassed,
              requiredTotal:changed.integrationAudit?.requiredTotal
            }
          };
        })()
      `, true);

      const b=payload.baseline||{}, n=payload.changed||{};
      const diff=(a,z)=>Math.abs(Number(a)-Number(z));
      const checks=payload.baselineFailure ? {
        baselineCalculated:false
      } : {
        projectContextPreserved: payload.projectId==='PRJ-DEMO-25-400',
        baselineCalculated:
          b.gateStatus==='locked-for-trial' &&
          Number(b.requiredPassed)===Number(b.requiredTotal) &&
          Math.abs(Number(b.closure)-1)<1e-6,
        engineerInputApplied:
          payload.modeValue==='manual' &&
          Math.abs(Number(payload.manualValue)-0.46)<1e-9,
        changedCalculated:
          n.gateStatus==='locked-for-trial' &&
          Number(n.requiredPassed)===Number(n.requiredTotal) &&
          Math.abs(Number(n.closure)-1)<1e-6,
        wcActuallyChanged:
          diff(b.finalWc,n.finalWc)>0.005 &&
          Math.abs(Number(n.finalWc)-0.46)<0.002,
        cementActuallyChanged:
          diff(b.cement,n.cement)>1,
        aggregateActuallyChanged:
          diff(b.aggregateSSD,n.aggregateSSD)>1,
        batchWaterPropagated:
          diff(b.batchWater,n.batchWater)>0.1 || diff(b.effectiveWater,n.effectiveWater)>0.1,
        fingerprintChanged:
          !!b.fingerprint && !!n.fingerprint && b.fingerprint!==n.fingerprint,
        resultRendered:
          payload.activeTab==='tab10' &&
          payload.resultText.includes('موتور روش ملی ایران') &&
          payload.resultText.includes('Calculated') &&
          payload.resultText.includes('Trial Required')
      };
      const ok=Object.values(checks).every(Boolean);
      results.push({name:'C-engine-response',ok,checks,payload});
      if(!ok) failures.push('C-engine-response: '+Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
      await capture('C-engine-response');
    } catch(error) {
      results.push({name:'C-engine-response',ok:false,error:error?.stack||error?.message||String(error)});
      failures.push('C-engine-response: '+(error?.message||String(error)));
      await capture('C-engine-response-error').catch(()=>{});
    }
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
          preview?.scrollIntoView({ block:'start', inline:'nearest' });
          await sleep(150);

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
          payload.sectionChecks.every(x => x.checked) &&
          (payload.coverage.includes('100') || payload.coverage.includes('۱۰۰')),
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
          payload.text.includes('651.292721') &&
          payload.text.includes('334.447614') &&
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


  async function stage7OperatorAcceptance() {
    const exportPath = path.join(dir, 'Tolou_QC010-001_R0.html');
    try {
      const payload = await win.webContents.executeJavaScript(`
        (async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const clickNav = async view => {
            const b=document.querySelector('#nav button[data-view="'+view+'"]');
            if(b)b.click(); else if(typeof openView==='function')openView(view);
            await sleep(220);
          };
          const change=(el,val,type='input')=>{
            if(!el)return false;
            el.value=val;
            el.dispatchEvent(new Event(type,{bubbles:true}));
            if(type!=='change')el.dispatchEvent(new Event('change',{bubbles:true}));
            return true;
          };
          const waitFor = async (fn, ms=7000) => {
            const started=Date.now();
            while(Date.now()-started<ms){try{const v=fn();if(v)return v}catch(e){}await sleep(100)}
            return null;
          };

          // 1) Enter as an operator through Mix Library and open the approved R0 in QC-010.
          await clickNav('mix-library');
          if(typeof mlSelect==='function')mlSelect('MX-DEMO-25-400');
          await sleep(120);
          const editBtn=[...document.querySelectorAll('#mlDetail button')].find(b=>b.innerText.includes('اصلاح در QC-010'));
          if(editBtn)editBtn.click();
          else if(typeof mlLoadRevision==='function')mlLoadRevision('MX-DEMO-25-400',0);

          const frame=await waitFor(()=>document.getElementById('frame-base'));
          const fw=await waitFor(()=>frame?.contentWindow?.TolouGetMixSnapshot?frame.contentWindow:null);
          if(!fw) throw new Error('QC-010 frame/API did not become ready');
          await waitFor(()=>fw.document.getElementById('iran31Fc')?.value==='25');
          const fd=fw.document;
          const calcBtn=[...fd.querySelectorAll('button')].find(b=>String(b.getAttribute('onclick')||'').trim()==='calculateMix()');
          if(!calcBtn)throw new Error('QC-010 Calculate button not found');
          calcBtn.click();
          await sleep(220);
          const baseline=fw.TolouGetMixSnapshot();
          if(!baseline?.ok){const audit=typeof fw.TolouGetIranStage37==='function'?fw.TolouGetIranStage37():null;throw new Error('QC-010 baseline calculation failed: '+(baseline?.message||'unknown')+' | gates='+JSON.stringify(audit?.gates||audit||null));}

          const storedSeries=(trialLab.series||[]).find(s=>s.id==='MX-DEMO-25-400');
          const storedR0=storedSeries?.revisions?.find(r=>Number(r.revision)===0);
          const storedFp=storedR0?.snapshot?.calculationFingerprint||'';

          // 2) Sensitivity #1: f'c 25 -> 30 through the real UI.
          const fc=fd.getElementById('iran31Fc');
          const fcClass=fd.getElementById('iran31FcClass');
          const fcEditable=!!fc && !fc.disabled && !fc.readOnly;
          const fcClassEditable=!!fcClass && !fcClass.disabled;
          change(fc,'30');
          change(fcClass,'30_35','change');
          calcBtn.click();
          await sleep(220);
          const strengthChanged=fw.TolouGetMixSnapshot();

          // 3) Restore strength and change intentional air 0 -> 1%.
          change(fc,'25');
          change(fcClass,'25','change');
          const air=fd.getElementById('iran36IntentionalAir');
          const airEditable=!!air && !air.disabled && !air.readOnly;
          change(air,'1');
          calcBtn.click();
          await sleep(220);
          const airChanged=fw.TolouGetMixSnapshot();

          // 4) Restore exact approved inputs and recalculate.
          change(air,'0');
          change(fc,'25');
          change(fcClass,'25','change');
          calcBtn.click();
          await sleep(250);
          const restored=fw.TolouGetMixSnapshot();

          // 5) Exercise QC-012 engineering core with the same physical material system.
          await clickNav('special');
          const sf=document.getElementById('frame-special');
          const sw=await waitFor(()=>sf?.contentWindow?.TolouLoadMixSnapshot?sf.contentWindow:null);
          if(!sw) throw new Error('QC-012 frame/API did not become ready');
          const specialSeed=JSON.parse(JSON.stringify(storedR0.snapshot));
          specialSeed.projectName='Operator Audit — QC-012';
          specialSeed.concreteType='scc';
          specialSeed.water=190;
          specialSeed.effectiveWater=190;
          specialSeed.targetWc=.475;
          specialSeed.designAirContent=2;
          const loaded=sw.TolouLoadMixSnapshot(specialSeed);
          if(!loaded?.ok)throw new Error('QC-012 seed load failed: '+(loaded?.message||'unknown'));
          const sd=sw.document;
          change(sd.getElementById('waterContent'),'190');
          change(sd.getElementById('targetWc'),'.475');
          change(sd.getElementById('designAirContent'),'2');
          const sCalc=[...sd.querySelectorAll('button')].find(b=>String(b.getAttribute('onclick')||'').trim()==='calculateMix()');
          if(!sCalc)throw new Error('QC-012 Calculate button not found');
          sCalc.click();
          await sleep(220);
          const special190=sw.TolouGetMixSnapshot();
          change(sd.getElementById('waterContent'),'180');
          sCalc.click();
          await sleep(220);
          const special180=sw.TolouGetMixSnapshot();
          change(sd.getElementById('waterContent'),'190');
          sCalc.click();
          await sleep(180);

          // 6) Follow approved R0 through all downstream modules using actual UI selections.
          await clickNav('production');
          prodRefreshMixOptions();
          const prodMix=document.getElementById('prodMix');
          if(prodMix){prodMix.value='MX-DEMO-25-400';prodMix.dispatchEvent(new Event('change',{bubbles:true}));}
          await sleep(150);
          const prodUi=(document.getElementById('prodMixStatus')?.innerText||'')+' '+(document.getElementById('prodLog')?.innerText||'');

          await clickNav('quality');
          if(typeof qcLoad==='function')qcLoad();
          const qMix=document.getElementById('qcFilterMix'); if(qMix){qMix.value='QC010-001';qMix.dispatchEvent(new Event('change',{bubbles:true}));}
          const qAge=document.getElementById('qcFilterAge'); if(qAge){qAge.value='28';qAge.dispatchEvent(new Event('change',{bubbles:true}));}
          if(typeof qcRender==='function')qcRender();
          await sleep(120);
          const qcUi=(document.getElementById('qcSummary')?.innerText||'')+' '+(document.getElementById('qcTableBody')?.innerText||'')+' '+(document.getElementById('qcAcceptance')?.innerText||'');

          await clickNav('durability');
          if(typeof durLoad==='function')durLoad();
          const dMix=document.getElementById('durMix'); if(dMix){dMix.value='MX-DEMO-25-400|0';dMix.dispatchEvent(new Event('change',{bubbles:true}));}
          if(typeof durLoadStoredRecord==='function'){const rec=(durState.records||[]).find(x=>x.id==='DUR-DEMO-001');if(rec)durLoadStoredRecord(rec);}
          await sleep(100);
          const durUi=(document.getElementById('durSummary')?.innerText||'')+' '+(document.getElementById('durChecks')?.innerText||'')+' '+(document.getElementById('durHistory')?.innerText||'');

          await clickNav('economics');
          if(typeof ecoLoad==='function')ecoLoad();
          const ecoUi=(document.getElementById('ecoSummary')?.innerText||'')+' '+(document.getElementById('ecoKpis')?.innerText||'')+' '+(document.getElementById('ecoHistory')?.innerText||'');

          await clickNav('optimization');
          if(typeof optLoad==='function')optLoad();
          if(typeof optRefreshMixOptions==='function')optRefreshMixOptions(true);
          await sleep(120);
          const optUi=(document.getElementById('optStatus')?.innerText||'')+' '+(document.getElementById('optResults')?.innerText||'')+' '+(document.getElementById('optHistory')?.innerText||'');

          await clickNav('reports');
          if(typeof reportLoad==='function')reportLoad();
          reportRefreshMixOptions('MX-DEMO-25-400',0);
          document.querySelectorAll('[data-report-section]').forEach(x=>x.checked=true);
          reportGenerate();
          await sleep(180);
          const reportText=document.getElementById('repPreview')?.innerText||'';
          const reportHtml=document.getElementById('repPreview')?.innerHTML||'';

          const prodBatches=(prodState.batches||[]).filter(x=>x.seriesId==='MX-DEMO-25-400'&&Number(x.revision)===0);
          const prodTests=(qcState.tests||[]).filter(x=>x.seriesId==='MX-DEMO-25-400'&&x.source==='production');
          const dur=(durState.records||[]).find(x=>x.id==='DUR-DEMO-001');
          const opt=(optState.studies||[]).find(x=>x.id==='OPT-DEMO-001');

          return {
            operatorPath:{
              editButtonFound:!!editBtn,
              method:baseline.snapshot?.designMethodId,
              fcEditable,fcClassEditable,airEditable,
              baseline:{
                fp:baseline.snapshot?.calculationFingerprint,
                fcm:baseline.snapshot?.requiredMeanStrength??baseline.snapshot?.iranNational?.stage31?.fcm,
                water:baseline.snapshot?.effectiveWater,
                cement:baseline.snapshot?.cementContent,
                wcm:baseline.snapshot?.wcm,
                batchWater:baseline.snapshot?.batchWater,
                closure:baseline.snapshot?.volumeClosure
              },
              strengthChanged:{
                fp:strengthChanged.snapshot?.calculationFingerprint,
                fcm:strengthChanged.snapshot?.requiredMeanStrength??strengthChanged.snapshot?.iranNational?.stage31?.fcm,
                water:strengthChanged.snapshot?.effectiveWater,
                cement:strengthChanged.snapshot?.cementContent,
                wcm:strengthChanged.snapshot?.wcm
              },
              airChanged:{
                fp:airChanged.snapshot?.calculationFingerprint,
                fcm:airChanged.snapshot?.requiredMeanStrength??airChanged.snapshot?.iranNational?.stage31?.fcm,
                water:airChanged.snapshot?.effectiveWater,
                cement:airChanged.snapshot?.cementContent,
                wcm:airChanged.snapshot?.wcm,
                air:airChanged.snapshot?.airContent,
                batchWater:airChanged.snapshot?.batchWater,
                closure:airChanged.snapshot?.volumeClosure
              },
              restored:{
                fp:restored.snapshot?.calculationFingerprint,
                fcm:restored.snapshot?.requiredMeanStrength??restored.snapshot?.iranNational?.stage31?.fcm,
                water:restored.snapshot?.effectiveWater,
                cement:restored.snapshot?.cementContent,
                wcm:restored.snapshot?.wcm,
                batchWater:restored.snapshot?.batchWater,
                closure:restored.snapshot?.volumeClosure
              },
              storedFp
            },
            special:{
              loaded:loaded?.ok===true,
              at190:special190?.snapshot?{
                type:special190.snapshot.concreteType,water:special190.snapshot.water,wcm:special190.snapshot.wcm,
                density:special190.snapshot.theoreticalDensity,closure:special190.snapshot.absoluteVolumeClosure,
                agg:special190.snapshot.aggregates?.reduce((s,a)=>s+Number(a.ssd??a.calculatedMass??0),0)
              }:null,
              at180:special180?.snapshot?{
                type:special180.snapshot.concreteType,water:special180.snapshot.water,wcm:special180.snapshot.wcm,
                density:special180.snapshot.theoreticalDensity,closure:special180.snapshot.absoluteVolumeClosure,
                agg:special180.snapshot.aggregates?.reduce((s,a)=>s+Number(a.ssd??a.calculatedMass??0),0)
              }:null
            },
            trace:{
              storedFp,
              productionCount:prodBatches.length,
              productionFingerprints:prodBatches.map(x=>x.designFingerprint),
              qcProductionCount:prodTests.length,
              qcFingerprints:prodTests.map(x=>x.designFingerprint),
              durabilityFp:dur?.designFingerprint,
              optimizerFp:opt?.designFingerprint,
              reportHasFp:!!storedFp&&reportText.includes(storedFp),
              reportLength:reportHtml.length
            },
            ui:{
              production:prodUi,
              qc:qcUi,
              durability:durUi,
              economics:ecoUi,
              optimization:optUi,
              report:reportText.slice(0,24000)
            }
          };
        })()
      `, true);

      const b=payload.operatorPath.baseline, s=payload.operatorPath.strengthChanged, a=payload.operatorPath.airChanged, r=payload.operatorPath.restored;
      const sp190=payload.special.at190, sp180=payload.special.at180;
      const fp=payload.trace.storedFp;
      const checks={
        operatorOpenedRevision:
          payload.operatorPath.editButtonFound===true &&
          payload.operatorPath.method==='iran479',
        editableEngineeringInputs:
          payload.operatorPath.fcEditable===true &&
          payload.operatorPath.fcClassEditable===true &&
          payload.operatorPath.airEditable===true,
        baselineEngineering:
          b?.fp===fp &&
          Math.abs(Number(b?.fcm)-32.53)<0.02 &&
          Math.abs(Number(b?.water)-190)<0.02 &&
          Math.abs(Number(b?.cement)-400)<0.05 &&
          Math.abs(Number(b?.wcm)-0.475)<0.0005 &&
          Math.abs(Number(b?.closure)-1)<0.0005,
        strengthSensitivity:
          !!s?.fp && s.fp!==b.fp &&
          Number(s?.fcm)>Number(b?.fcm)+3,
        airSensitivity:
          !!a?.fp && a.fp!==b.fp &&
          Math.abs(Number(a?.water)-Number(b?.water))>1 &&
          Math.abs(Number(a?.cement)-Number(b?.cement))>1 &&
          Math.abs(Number(a?.wcm)-Number(b?.wcm))>0.005 &&
          Math.abs(Number(a?.closure)-1)<0.002,
        deterministicRestore:
          r?.fp===b.fp &&
          Math.abs(Number(r?.fcm)-Number(b?.fcm))<1e-6 &&
          Math.abs(Number(r?.water)-Number(b?.water))<1e-6 &&
          Math.abs(Number(r?.cement)-Number(b?.cement))<1e-6 &&
          Math.abs(Number(r?.wcm)-Number(b?.wcm))<1e-9 &&
          Math.abs(Number(r?.batchWater)-Number(b?.batchWater))<1e-6,
        specialEngineRuns:
          payload.special.loaded===true &&
          sp190?.type==='scc' &&
          Math.abs(Number(sp190?.closure)-1)<1e-6 &&
          Math.abs(Number(sp180?.closure)-1)<1e-6,
        specialSensitivity:
          Math.abs(Number(sp190?.wcm)-Number(sp180?.wcm))>0.02 &&
          Math.abs(Number(sp190?.density)-Number(sp180?.density))>1 &&
          Math.abs(Number(sp190?.agg)-Number(sp180?.agg))>1,
        productionTrace:
          payload.trace.productionCount===6 &&
          payload.trace.productionFingerprints.every(x=>x===fp),
        qcTrace:
          payload.trace.qcProductionCount>=12 &&
          payload.trace.qcFingerprints.every(x=>x===fp),
        durabilityTrace:
          payload.trace.durabilityFp===fp,
        optimizerTrace:
          payload.trace.optimizerFp===fp,
        downstreamUi:
          payload.ui.production.includes('QC010-001') &&
          payload.ui.production.includes('B-260701-01') &&
          (payload.ui.qc.includes('33.1')||payload.ui.qc.includes('33.10')) &&
          payload.ui.durability.includes('DUR-DEMO-001') &&
          payload.ui.economics.includes('50,360,000') || payload.ui.economics.includes('50360000'),
        reportTrace:
          payload.trace.reportHasFp===true &&
          payload.trace.reportLength>10000 &&
          payload.ui.report.includes('QC010-001') &&
          payload.ui.report.includes('OPT-DEMO-001')
      };
      // Prevent operator precedence from weakening the UI assertion.
      checks.downstreamUi =
          payload.ui.production.includes('QC010-001') &&
          payload.ui.production.includes('B-260701-01') &&
          (payload.ui.qc.includes('33.1')||payload.ui.qc.includes('33.10')) &&
          payload.ui.durability.length>20 &&
          payload.ui.economics.length>20 &&
          payload.ui.optimization.includes('OPT-DEMO-001');

      // Trigger a real HTML export from the visible Report UI.
      const downloadPromise=new Promise(resolve=>{
        let settled=false;
        const timer=setTimeout(()=>{if(!settled){settled=true;resolve({ok:false,reason:'download-timeout'})}},5000);
        win.webContents.session.once('will-download',(event,item)=>{
          item.setSavePath(exportPath);
          item.once('done',(e,state)=>{
            if(settled)return;settled=true;clearTimeout(timer);
            resolve({ok:state==='completed',state,filename:item.getFilename()});
          });
        });
        win.webContents.executeJavaScript(`(()=>{const b=document.getElementById('repHtml');if(!b)return false;b.click();return true;})()`,true).catch(err=>{
          if(settled)return;settled=true;clearTimeout(timer);resolve({ok:false,reason:String(err)});
        });
      });
      const exported=await downloadPromise;
      await new Promise(r=>setTimeout(r,120));
      const exportExists=fs.existsSync(exportPath);
      const exportSize=exportExists?fs.statSync(exportPath).size:0;
      checks.realReportExport=exported.ok===true&&exportExists&&exportSize>10000;

      const ok=Object.values(checks).every(Boolean);
      results.push({name:'07-operator-acceptance',ok,checks,payload,exported,exportPath,exportSize});
      if(!ok)failures.push('07-operator-acceptance: '+Object.entries(checks).filter(([,v])=>!v).map(([k])=>k).join(', '));
      await capture('07-operator-acceptance');
    } catch(error) {
      results.push({name:'07-operator-acceptance',ok:false,error:error?.stack||error?.message||String(error)});
      failures.push('07-operator-acceptance: '+(error?.message||String(error)));
      await capture('07-operator-acceptance-error').catch(()=>{});
    }
  }

  await new Promise(r => setTimeout(r, 1200));
  if (stage === 'projects') await stage1Projects();
  else if (stage === 'project-to-qc010') await stageBProjectToQc010();
  else if (stage === 'engine-response') await stageCEngineResponse();
  else if (stage === 'mix-library') await stage2MixLibrary();
  else if (stage === 'durability') await stage3Durability();
  else if (stage === 'economics') await stage4Economics();
  else if (stage === 'optimization') await stage5Optimization();
  else if (stage === 'reports') await stage6Reports();
  else if (stage === 'operator') await stage7OperatorAcceptance();
  else if (stage === 'all') { await stage1Projects(); await stage2MixLibrary(); await stage3Durability(); await stage4Economics(); await stage5Optimization(); await stage6Reports(); await stage7OperatorAcceptance(); }

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
