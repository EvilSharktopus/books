const xlsx = require('xlsx');
const wb = xlsx.readFile('C:/Users/Owner/Downloads/Maddy\'s Book Reviews (Responses).xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
console.log(JSON.stringify(data[0], null, 2));
