const xlsx = require('xlsx');
const fs = require('fs');

const wb = xlsx.readFile('C:/Users/Owner/Downloads/Maddy\'s Book Reviews (Responses).xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const mapped = data.map(row => {
  // Convert Excel serial date to JS Date (rough approximation)
  let submittedAt = new Date();
  if (row["Timestamp"]) {
    submittedAt = new Date(Math.round((row["Timestamp"] - 25569) * 86400 * 1000));
  }

  return {
    bookTitle: row["Title"] || "",
    author: row["Author"] || "",
    source: row["Where'd You Hear About It?"] || "",
    rating: row["Rating"] || 0,
    comments: row["Comments"] || "",
    type: row["Type"] || "",
    submittedAt: submittedAt.toISOString()
  };
});

fs.writeFileSync('data/maddy-seed.jsonl', mapped.map(x => JSON.stringify(x)).join('\n'));
console.log(`Converted ${mapped.length} records.`);
