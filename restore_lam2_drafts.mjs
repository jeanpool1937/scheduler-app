import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://nvrcsheavwwrcukhtvcw.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cmNzaGVhdnd3cmN1a2h0dmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzkyMDUsImV4cCI6MjA4NjMxNTIwNX0.0ndDO1K8c_WnP3FQumSCoWf-XGlBsrBfJXlCNMplGSE'
);

async function run() {
    try {
        const raw = fs.readFileSync('C:\\Users\\EPALLARC\\.gemini\\antigravity\\brain\\9c46c748-6d0c-4e80-af7c-cd6c97d74f6c\\.system_generated\\steps\\96\\output.txt', 'utf8');
        const toolOutput = JSON.parse(raw);
        const resultStr = toolOutput.result || '';
        const match = resultStr.match(/\[.*\]/s);
        if (!match) throw new Error("No JSON array found in result string");
        const jsonStr = match[0];
        const results = JSON.parse(jsonStr);

        const target = results.find(r => r.scenario_id === 'min_lost_sales');
        if (!target) throw new Error("min_lost_sales scenario not found");

        const data = target.result_data;

        const draftsToInsert = data.params_ids.map((id, index) => {
            return {
                id: id,
                process_id: 'laminador2',
                sku_code: data.params_skus[index],
                quantity: data.params_cant[index],
                metadata: {
                    description: data.params_desc[index]
                }
            };
        });

        console.log("Found", draftsToInsert.length, "drafts to restore.");

        await supabase.from('scheduler_sequencer_draft_items').delete().eq('process_id', 'laminador2');

        const { error } = await supabase.from('scheduler_sequencer_draft_items').insert(draftsToInsert);
        if (error) {
            console.error("DB Insert Error", error);
        } else {
            console.log("Successfully restored drafts for laminador2!");
        }

        // Let's also clean up the scheduler_sequencer_results so we are exactly in the pre-application state
        // Actually, we WANT the results to be there so the user sees the generated optimizacion, 
        // since they complained it disappeared! If we restore drafts, the existing results will now bind correctly.

    } catch (e) {
        console.error("Error:", e);
    }
}
run();
