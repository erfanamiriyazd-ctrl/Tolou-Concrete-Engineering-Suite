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
