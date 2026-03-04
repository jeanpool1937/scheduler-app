import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = Object.fromEntries(
    envFile.split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('='))
        .filter(parts => parts.length >= 2)
        .map(([k, ...v]) => [k.trim(), v.join('=').trim()])
);

const supabaseUrl = process.env.VITE_SUPABASE_URL || envVars['VITE_SUPABASE_URL'];
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upload() {
    console.log('Reading Excel file...');
    const wb = XLSX.readFile('Maestro_Costos.xlsx');
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} records in Excel`);

    const recordsToInsert = [];

    for (const row of data as any[]) {
        const sap = row['Codigo SAP']?.toString().trim();
        const lamInput = row['COD-Lam'] || row['Codigo Lam'] || row['LINEA'];

        if (!sap || !lamInput) continue;

        // Normalizar el codigo laminador a LAM1, LAM2, LAM3
        let lam = '';
        const lamRaw = lamInput.toString().toUpperCase().replace(/\s/g, '');
        if (lamRaw.includes('LAM1')) lam = 'LAM1';
        else if (lamRaw.includes('LAM2')) lam = 'LAM2';
        else if (lamRaw.includes('LAM3')) lam = 'LAM3';
        else lam = lamRaw;

        if (!lam) continue;

        const id = `${sap}-${lam}`;

        // Parse numeric fields safely
        const ritmo = parseFloat(row['Ritmo t/h (Lam)']) || 0;
        const costo = parseFloat(row['COSTO TOTAL LAM (Sin.CF)']) || 0;
        const cambio = parseFloat(row['Cambio de Medida (Horas)']) || 0;
        const familia = row['ID Familia TCM']?.toString() || '';
        const desc = row['Descripcion']?.toString() || '';

        recordsToInsert.push({
            id,
            codigo_sap: sap,
            codigo_lam: lam,
            descripcion: desc,
            id_familia_tcm: familia,
            ritmo_th: ritmo,
            costo_total_lam_sin_cf: costo,
            cambio_medida_horas: cambio
        });
    }

    console.log(`Prepared ${recordsToInsert.length} distinct records to insert (grouped by SKU-LAM)`);

    if (recordsToInsert.length === 0) {
        console.log('No valid records found in Excel to upload.');
        return;
    }

    // Borrar tabla primero para reemplazar todo
    const { error: delError } = await supabase.from('scheduler_maestro_costos').delete().neq('id', 'NO_ID_JUST_DELETE_ALL');
    if (delError) {
        console.error('Error emptying table:', delError);
    }

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);
        const { error: insertErr } = await supabase.from('scheduler_maestro_costos').upsert(batch);
        if (insertErr) {
            console.error(`Error inserting batch ${i}:`, insertErr);
        } else {
            console.log(`Inserted batch ${i} to ${i + batch.length - 1}`);
        }
    }

    console.log('Upload finished successfully!');
}

upload().catch(err => {
    console.error(err);
});
