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
Three aggregate fractions are used: fine sand, 4.75–12.5 mm pea gravel, and 12.5–25 mm almond gravel. At every INSO 302 control sieve used in the sample material profiles, the stored percent passing is the arithmetic midpoint of the profile's lower and upper bounds. The Aggregate Intelligence case uses a 44.5 / 35.0 / 20.5 mass split and the Iran-479 B25 target curve.

## End-to-end populated modules
Project Hub → Material Intelligence → Aggregate Intelligence → QC-010 snapshot → Trial Mix Lab → approval evidence → Production/Batching → QC statistics → Durability → Cost/Sustainability QA data → Optimization study.

All people, companies, plant names, price inputs and carbon factors are explicitly fictitious/QA data. Price/GWP factors are not commercial estimates or EPD values.

## Data safety
The sample seeder merges fixed sample IDs into the existing stores only on first seed. It does not clear localStorage, and a marker prevents re-seeding on every launch. Existing user data remains intact.

Marker: `Tolou_sample_project_v1`
Project ID: `PRJ-DEMO-25-400`
Mix Series ID: `MX-DEMO-25-400`
