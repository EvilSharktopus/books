import fs from "fs";

const PROJECT_ID = "personal-214d2";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function seed(userName, filename) {
  // 1. Find or create user
  let userId;
  const qBody = {
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: {
        fieldFilter: { field: { fieldPath: "name" }, op: "EQUAL", value: { stringValue: userName } }
      }
    }
  };
  let res = await fetch(`${BASE_URL}:runQuery`, {
    method: "POST", body: JSON.stringify(qBody)
  });
  let docs = await res.json();
  if (docs && docs.length > 0 && docs[0].document) {
    userId = docs[0].document.name.split("/").pop();
    console.log(`Found user ${userName}: ${userId}`);
  } else {
    // create user
    let cRes = await fetch(`${BASE_URL}/users`, {
      method: "POST", body: JSON.stringify({ fields: { name: { stringValue: userName } } })
    });
    let cDoc = await cRes.json();
    userId = cDoc.name.split("/").pop();
    console.log(`Created user ${userName}: ${userId}`);
  }

  // 2. Fetch existing books (assuming < 300 so no pagination needed for simple check)
  let bRes = await fetch(`${BASE_URL}/users/${userId}/books?pageSize=1000`);
  let bDocs = await bRes.json();
  let seen = new Set();
  if (bDocs.documents) {
    for (const d of bDocs.documents) {
      let f = d.fields;
      let t = f.title?.stringValue || "";
      let a = f.authors?.stringValue || "";
      let r = f.myRating?.integerValue || 0;
      let n = f.notes?.stringValue || "";
      seen.add(`${t}|${a}|${r}|${n}`);
    }
  }

  // 3. Import
  let lines = fs.readFileSync(filename, "utf-8").split("\n").filter(l => l.trim());
  let added = 0, skipped = 0;
  for (const line of lines) {
    let old = JSON.parse(line);
    let book = {
      title: old.bookTitle || "",
      authors: old.author || "",
      year: "", pages: "", cover: "", source: old.source || "",
      myRating: old.rating || 0,
      notes: old.comments || "",
      cried: false, type: old.type || "", authorCountry: "",
      dateAdded: old.submittedAt ? new Date(old.submittedAt).toISOString() : new Date().toISOString()
    };
    
    let key = `${book.title}|${book.authors}|${book.myRating}|${book.notes}`;
    if (seen.has(key)) { skipped++; continue; }
    
    let doc = {
      fields: {
        title: { stringValue: book.title },
        authors: { stringValue: book.authors },
        year: { stringValue: book.year },
        pages: { stringValue: book.pages },
        cover: { stringValue: book.cover },
        source: { stringValue: book.source },
        myRating: { integerValue: parseInt(book.myRating, 10) || 0 },
        notes: { stringValue: book.notes },
        cried: { booleanValue: book.cried },
        type: { stringValue: book.type },
        authorCountry: { stringValue: book.authorCountry },
        dateAdded: { timestampValue: book.dateAdded }
      }
    };
    
    await fetch(`${BASE_URL}/users/${userId}/books`, { method: "POST", body: JSON.stringify(doc) });
    seen.add(key);
    added++;
  }
  console.log(`Done for ${userName}: ${added} added, ${skipped} skipped.`);
}

(async () => {
  await seed("Hilary", "../data/seed-ratings.jsonl");
  await seed("Maddy", "data/maddy-seed.jsonl");
})().catch(console.error);
