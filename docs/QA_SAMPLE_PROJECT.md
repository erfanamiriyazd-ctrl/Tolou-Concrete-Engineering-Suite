# Tolou QA Sample Project — C25 / Type II / Cement 400

This Windows QA build seeds one complete fictitious project **once** through the desktop preload layer. The Stage 6.5 Golden Baseline is not modified.

## Fixed design brief
- Normal concrete / QC-010
- Iranian National Method (Publication 479 workflow)
- Type II Portland cement
- Cement content: 400 kg/m³
- Target strength: 25 MPa
- Effective water: 190 kg/m³
- w/cm: 0.475
- Slump target: 100 mm
- NMSA: 25 mm
- Non-air-entrained; nominal entrapped air: 2%

## Aggregate QA basis
Three aggregate fractions are used: fine sand, 4.75–12.5 mm pea gravel, and 12.5–25 mm almond gravel. At every INSO 302 control sieve used in the sample material profiles, the stored percent passing is the arithmetic midpoint of the profile's lower and upper bounds. The Aggregate Intelligence case uses a 44 / 37 / 19 mass split and the Iran-479 B25 target curve. This split is a constrained near-optimum for the stored midpoint gradations within the sample source bounds.

## End-to-end populated modules
Project Hub → Material Intelligence → Aggregate Intelligence → QC-010 snapshot → Trial Mix Lab → approval evidence → Production/Batching → QC statistics → Durability → Cost/Sustainability QA data → Optimization study.

All people, companies, plant names, price inputs and carbon factors are explicitly fictitious/QA data. Price/GWP factors are not commercial estimates or EPD values.

## Data safety
The sample seeder merges fixed sample IDs into the existing stores only on first seed. It does not clear localStorage, and a marker prevents re-seeding on every launch. Existing user data remains intact.

Marker: `Tolou_sample_project_v1`
Project ID: `PRJ-DEMO-25-400`
Mix Series ID: `MX-DEMO-25-400`


## Stage validation status
- Stage 1 — Project Hub + Material Intelligence: COMPLETE
  - Project code/name/status/scope and fictitious parties populated.
  - f'c = 25 MPa, slump = 100 mm, max w/cm = 0.50.
  - Iran 479 selected as the base design method.
  - Workshop/site grade = B and Iran strength class = 25 MPa.
  - Dmax = 25 mm, normal environment, non-air-entrained system.
  - Type II cement, mixing water, fine aggregate, 4.75–12.5 mm coarse aggregate, and 12.5–25 mm coarse aggregate are present as revisioned Material Intelligence records.
  - Supplier/source/lot/test date and engineering properties are populated with fictitious QA data.


## Stage 2 — Aggregate Intelligence — COMPLETE
- Fine aggregate, 4.75–12.5 mm coarse aggregate, and 12.5–25 mm coarse aggregate are linked to Material Intelligence revisions.
- At every explicit INSO 302 control sieve stored in each source profile, percent passing equals the arithmetic midpoint of the stored lower/upper limits.
- Fine aggregate FM = 2.80 from the stored midpoint gradation.
- Aggregate blend target = Iran Publication 479, Dmax 25 mm, Curve B.
- Blend calculation basis = volume, derived from mass fractions and source specific gravities.
- Final QA blend = 44% fine / 37% pea gravel / 19% almond gravel by mass.
- The final split was checked against the same RMSE objective used by Aggregate Intelligence and is a constrained near-optimum inside the configured source bounds.
- Measured DRUW = 1680 kg/m³ is populated so combined SG, packing and voids are available.
- The saved Aggregate Case is linked to project PRJ-DEMO-25-400 and embedded in the QC-010 mix snapshot through aggregateBlendBinding.


## Stage 3 — QC-010 / Iran 479 engineering snapshot — COMPLETE
- f'c = 25 MPa.
- Workshop/site grade = B; SD used = 4.5 MPa.
- Required mean strength: Eq. 3-1 = 32.53 MPa; Eq. 3-2 = 31.485 MPa; governing fcm = 32.53 MPa.
- Slump target = 100 mm.
- Type II cement = 400 kg/m³.
- Effective water = 190 kg/m³; w/cm = 0.475.
- Entrapped air = 2%; intentional air = 0%.
- Absolute-volume aggregate remainder = 0.663015873 m³.
- With the Stage-2 44/37/19 aggregate split, SSD aggregate masses are approximately 774.510 / 651.293 / 334.448 kg/m³.
- Moisture correction uses 3.5/1.5/1.2% moisture and 1.5/1.0/0.8% absorption for fine/pea/almond fractions.
- Aggregate free water = approximately 19.813 kg/m³, therefore water to add at batching = approximately 170.187 kg/m³.
- Total SSD aggregate mass = approximately 1760.251 kg/m³ and total batch mass remains mass-balanced.
- Stage 3.7 integration gate is stored as locked-for-trial with all 8 required gates populated.
- Stage 3.1–3.6 objects now contain the fields consumed by the engineering dossier/report layer, avoiding blank QA report cells for the sample project.
- Seed dataset version was incremented so an already-seeded QA installation can receive the corrected sample dataset without modifying the Golden Baseline.


## Stage 4 — Trial Mix Laboratory — COMPLETE
- Five laboratory trial batches are linked to revision R0 of mix series MX-DEMO-25-400.
- The locked Stage-3 design remains unchanged: Type II cement = 400 kg/m³, design effective water = 190 kg/m³, design w/cm = 0.475, Dmax = 25 mm, and aggregate split = 44/37/19 by mass.
- Trial sensitivity points use effective-water levels 184 / 188 / 190 / 192 / 196 kg/m³, corresponding to w/cm = 0.460 / 0.470 / 0.475 / 0.480 / 0.490.
- Each trial now stores measured aggregate moisture, SSD-to-wet batch conversion, aggregate free water, water-to-add, 45 L batch masses, material lots, mixing sequence, fresh properties, measured yield, specimen sets and engineering evaluation.
- Trial-day moisture remains near the Stage-3 material basis and does not alter the approved aggregate blend or material revisions.
- 28-day strengths = 34.6 / 33.8 / 33.2 / 32.6 / 31.7 MPa.
- Mean 28-day strength = 33.18 MPa, sample SD ≈ 1.11 MPa and COV ≈ 3.35%.
- The R0 design point at w/cm = 0.475 gives 33.2 MPa, above the Stage-3 required mean strength fcm = 32.53 MPa.
- All trial points remain above the specified strength f'c = 25 MPa, within max w/cm = 0.50, slump acceptance 80–120 mm and air acceptance 1–3%.
- Calibration evidence now distinguishes specified-strength acceptance from the Stage-3 required design mean strength.
- Sample dataset version incremented to 4 so previously seeded QA installations receive the corrected Stage-4 evidence.


## Stage 5 — Approval / Revision Integrity — COMPLETE
- Approval is now tied to the exact locked R0 design snapshot and the Stage-4 trial evidence fingerprint.
- Stale calibration extrema were corrected; the 28-day trial range is 31.7–34.6 MPa.
- Mandatory approval gates explicitly verify: locked design snapshot, minimum trial count, specified strength, required mean strength fcm, max w/cm, slump range, air range, and evidence fingerprint presence.
- Required mean strength gate uses Stage-3 fcm = 32.53 MPa; Stage-4 mean = 33.18 MPa, therefore the design-mean gate passes.
- All five 28-day trial results exceed f'c = 25 MPa.
- All trial w/cm values remain <= 0.500.
- All slump values remain within 80–120 mm and air contents within 1–3%.
- Approval record stores reviewer role, design fingerprint, evidence fingerprint, calibration version, trial IDs, all gate results and the engineering disposition.
- R0 is allowed to proceed to controlled production only while material revisions, aggregate blend, cement content, design w/cm and acceptance requirements remain unchanged; any such change requires a new revision and new evidence review.


## Stage 6 — Production / Batching — COMPLETE
- Six controlled production batches are linked to approved revision R0 and its exact design/evidence fingerprints.
- Each batch volume = 7 m³; total sample production volume = 42 m³.
- Production uses the same Type II cement, material revisions, aggregate blend 44/37/19, design w/cm = 0.475 and max project w/cm = 0.500.
- Daily aggregate moisture is stored per fraction and used to calculate wet aggregate target masses, aggregate free water and corrected batch water.
- Cement, aggregate and water target/actual masses carry explicit weighing deviations, tolerances and within-tolerance flags.
- Every batch stores material lot traceability, operator, QC inspector, plant, line, truck, density, slump, air, temperature, yield and approval linkage.
- Production release gates verify approval integrity, weighing tolerances, w/cm, slump, air and relative yield.
- Relative-yield acceptance window for the QA dataset = 0.98–1.02.
- All six batches pass the configured production-release gates and are released under R0.
- 28-day production strengths = 33.1 / 33.6 / 32.9 / 33.8 / 32.4 / 33.3 MPa.
- Mean production 28-day strength = 33.18 MPa, consistent with the Stage-3 required mean strength fcm = 32.53 MPa and the Stage-4 trial mean = 33.18 MPa.
- Sample dataset version incremented to 5 so previously seeded QA installations receive the corrected Stage-6 production evidence.


## Stage 7 — QC / Strength Statistics — COMPLETE
- QC now stores both 7-day and 28-day results for all five laboratory trials and all six controlled production batches.
- Trial and production records are linked to project PRJ-DEMO-25-400, mix series MX-DEMO-25-400, revision R0, design fingerprint and approval evidence fingerprint.
- Production QC records are also linked back to the originating production batch and its release-gate status.
- Material lot traceability is preserved for cement, water, fine aggregate, pea gravel and almond gravel.
- Statistical summaries are stored separately for Trial 7d, Trial 28d, Production 7d, Production 28d and combined 28d populations.
- Production 28-day strengths = 33.1 / 33.6 / 32.9 / 33.8 / 32.4 / 33.3 MPa.
- Production 28-day mean = 33.18 MPa; sample SD ≈ 0.50 MPa; COV ≈ 1.51%.
- All six production 28-day results exceed f'c = 25 MPa.
- Production mean remains above Stage-3 fcm = 32.53 MPa.
- QC trend data stores delta from specified strength, delta from required design mean and a rolling three-result mean where available.
- The sample QC disposition is stable-controlled only when production strength, batch release controls and traceability all pass.
- Sample dataset version incremented to 6 so previously seeded QA installations receive the completed Stage-7 QC dataset.


## Stage 8 — Durability — COMPLETE
- Durability analysis is now linked to approved revision R0, its design fingerprint, approval evidence fingerprint and Stage-7 QC disposition.
- The stored QA exposure scenario remains F0 / S0 / W0 / C0 and is explicitly labeled as a non-aggressive sample scenario rather than an independent standards-compliance claim.
- Durability checks separately evaluate design integrity, QC stability, design w/cm, specified strength, production mean strength, cement type, chloride data and calcium-chloride use.
- Design w/cm = 0.475 passes the project maximum w/cm = 0.500.
- Specified strength = 25 MPa meets the project minimum = 25 MPa.
- Production 28-day mean remains above Stage-3 fcm = 32.53 MPa.
- Type II cement is traceable to Material Intelligence revision 1 and lot CII-260518-A.
- QA chloride input = 0.080% of cementitious materials is retained, but no numeric project chloride limit exists; therefore chloride is correctly classified as not-evaluable rather than automatically passing.
- Overall durability disposition is acceptable-with-open-items for the defined QA scenario because there are no blocking failures, while chloride compliance remains open pending a numeric project/standard limit.
- Revalidation triggers are stored for material revisions, aggregate blend, cement type/content, w/cm, exposure classification, chloride limit and QC-status changes.
- Sample dataset version incremented to 7.


## Stage 9 — Cost & Sustainability — COMPLETE
- Cost and carbon calculations are tied to the exact approved R0 design, its design/evidence fingerprints, Stage-7 production QC disposition and Stage-8 durability disposition.
- The 1 m³ basis uses the approved R0 constituent masses: Type II cement 400 kg/m³, effective water 190 kg/m³ and the Stage-3 SSD aggregate masses/blend 44/37/19.
- Every cost/carbon row is linked to its Material Intelligence ID, code, revision and QA lot identifier.
- Performance normalization now uses Stage-7 production 28-day mean strength = 33.18 MPa rather than the laboratory Trial mean.
- The module stores cost/MPa, carbon/MPa and cement kg/MPa as engineering comparison indicators.
- Numeric price and GWP factors have 100% computational coverage, but all factors are explicitly marked illustrative-only.
- Verified commercial coverage = 0% because no approved quotation/price source is attached.
- Verified environmental-claim coverage = 0% because no verified EPD/LCA source is attached.
- The record explicitly warns that factor completeness is not equivalent to commercial or environmental verification.
- Outputs are valid for QA calculation-path testing only and must not be used for procurement, pricing, EPD/LCA declarations or environmental claims until the illustrative factors are replaced with approved sources.
- Revalidation triggers include material revision/lot changes, mix revision changes, price/currency updates, GWP/EPD/LCA updates and production-QC performance changes.
- Sample dataset version incremented to 8.


### Stage 9 project price update
Project-provided IRR prices have replaced the illustrative price factors for the current QA project:
- Type II cement: 36,000,000 IRR/ton.
- Fine aggregate (sand): 5,291,000 IRR/ton.
- Coarse aggregate (pea gravel): 5,030,300 IRR/ton.
- Coarse aggregate (almond gravel): 5,030,300 IRR/ton using the same coarse-aggregate price basis supplied for the project.
- Water: 1,300,000 IRR/m³, converted to 1,300 IRR/kg for the 190 kg/m³ design-water basis.
- Pumping: 2,400,000 IRR/m³.
- Current R0 material cost is approximately 23.70 million IRR/m³; including pumping, current total is approximately 26.10 million IRR/m³.
- Transport, overhead and other unprovided costs remain zero and are not implied to be included.
- Commercial price coverage for the entered material factors is now project-priced; GWP factors remain illustrative-only and unverified for EPD/LCA use.
- Sample dataset version = 9.


### Stage 9 Iran-1405 sourced operating-cost estimates
Additional operating-cost assumptions were added using current Iranian 1405 sources and the project transport-distance setting:
- Official road freight index: 16,680 IRR/ton-km.
- Project haul distance: 15 km.
- Inbound material transport estimate: approximately 540,495 IRR/m³.
- Concrete delivery transport proxy: approximately 588,033 IRR/m³, based on concrete mass and the same ton-km rate.
- Industrial electricity tariff basis: 3,605 IRR/kWh for industry below 1 MW.
- Batching electricity consumption assumption: 0.9 kWh/m³, derived from Iranian 60 m³/h batching-plant power specifications; resulting electricity cost ≈ 3,245 IRR/m³.
- Loader fuel assumption: 17 L/h at 60 m³/h; 80,700 IRR/L diesel proxy; resulting loader fuel cost ≈ 22,865 IRR/m³.
- Direct labor model uses 1405 market salary medians for driver, QC and technical operator plus 23% employer insurance and 70% plant utilization; resulting direct labor cost ≈ 212,603 IRR/m³.
- These items are tagged sourced-engineering-estimate/proxy where applicable and are not represented as invoice-grade audited costs.
- Current modeled total cost including project material prices, pumping and the sourced operating-cost estimates is approximately 27.47 million IRR/m³.
- Maintenance, depreciation, finance cost, tax/VAT, administration and unprovided site-specific overhead remain excluded until project-specific data is available.
- Sample dataset version = 10.


### Stage 9 cost reconciliation to actual ex-plant price
User-provided commercial anchors:
- Actual ex-plant concrete price, excluding pumping and VAT: 36,800,000 IRR/m³.
- Actual delivery freight: 6,800,000 IRR/m³.
- VAT: 10%.

The previously modeled known ex-plant cost base equals 24,482,713 IRR/m³. The balancing gap to the actual ex-plant price is therefore 12,317,287 IRR/m³.

For cost-model closure only, the gap is allocated across previously unfilled cost centers:
- Depreciation: 40% = 4,926,914.80 IRR/m³.
- Plant/admin overhead: 25% = 3,079,321.75 IRR/m³.
- Maintenance: 20% = 2,463,457.40 IRR/m³.
- Finance/working capital: 15% = 1,847,593.05 IRR/m³.

These are balancing allocations, not independently measured/audited cost-center values.

Commercial totals:
- Ex-plant concrete: 36,800,000 IRR/m³.
- Delivered before VAT: 43,600,000 IRR/m³.
- VAT @10%: 4,360,000 IRR/m³.
- Delivered incl. VAT: 47,960,000 IRR/m³.
- Delivered incl. VAT + pumping: 50,360,000 IRR/m³.
- Pumping remains a separate project-provided 2,400,000 IRR/m³ line item; no pumping VAT is assumed because none was provided.
- Sample dataset version = 11.


## Stage 10 — Optimization — COMPLETE
- The optimizer was rebuilt because the previous implementation used stale illustrative prices and held aggregate masses fixed while varying cement/water.
- Optimization is now restricted to the validated calibration domain supported by Stage-4 trials: cement fixed at 400 kg/m³ and w/cm from 0.460 to 0.490.
- Independent cement-content optimization is explicitly disabled because the trial evidence does not validate cement-content variation.
- Candidate w/cm values = 0.460 / 0.465 / 0.470 / 0.475 / 0.480 / 0.485 / 0.490.
- For every candidate, aggregate SSD masses are recalculated from the absolute-volume remainder while preserving the 44/37/19 mass split and the same aggregate specific gravities.
- Strength prediction uses the calibrated relationship fc28 = a + b*(1/w/cm), based on the five Stage-4 trial points.
- Feasibility gates include calibration-domain membership, required mean strength fcm = 32.53 MPa, max w/cm = 0.500, water range 175–205 kg/m³ and positive absolute-volume closure.
- Cost calculations now use the project-provided IRR prices plus the current reconciled operating-cost model.
- Optimization cost objective is ex-plant cost and is project-grounded.
- Carbon remains an exploratory objective only because GWP factors are not EPD/LCA verified.
- The optimizer stores the R0 baseline candidate at w/cm = 0.475 for direct comparison.
- No candidate is auto-selected; engineering review is mandatory.
- Revalidation triggers cover trial calibration, mix revision, QC, durability, prices/operating cost and GWP/EPD changes.
- Sample dataset version incremented to 12.
