const fs = require('fs');
const file = 'src/components/planner/ComparisonDashboard.tsx';
let data = fs.readFileSync(file, 'utf8');

// Fix implicitly any arrow functions like "a =>"
// But avoid messing with functions that are already typed like "(val: any) =>"
data = data.replace(/(\w+) =>/g, '($1: any) =>');
data = data.replace(/\(sum, a\)/g, '(sum: any, a: any)');
data = data.replace(/\(sum, i\)/g, '(sum: any, i: any)');
data = data.replace(/\(sum, p\)/g, '(sum: any, p: any)');
data = data.replace(/\(s, p\)/g, '(s: any, p: any)');
data = data.replace(/\(sum, sku\)/g, '(sum: any, sku: any)');

// Fix type any record
data = data.replace(/const row: any = \{ name: m \};/g, 'const row: Record<string, any> = { name: m };');

// Fix AlertTriangle missing
data = data.replace(/([a-zA-Z]+) size=\{/g, (match, icon) => {
    if (icon === 'AlertTriangle' && !data.includes('AlertTriangle')) {
        return 'AlertTriangle size={'; // Wait, let's just add the import back if not there
    }
    return match;
});

if (data.includes('AlertTriangle') && !data.includes('import { AlertTriangle')) {
    data = data.replace(/import \{([\s\S]*?)DollarSign/m, 'import { AlertTriangle, $1DollarSign');
}

fs.writeFileSync(file, data);
