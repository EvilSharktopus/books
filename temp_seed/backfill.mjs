import fs from "fs";

const PROJECT_ID = "personal-214d2";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function backfillUser(userName) {
  let userId;
  const qBody = {
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: { fieldFilter: { field: { fieldPath: "name" }, op: "EQUAL", value: { stringValue: userName } } }
    }
  };
  let res = await fetch(`${BASE_URL}:runQuery`, { method: "POST", body: JSON.stringify(qBody) });
  let docs = await res.json();
  if (docs && docs.length > 0 && docs[0].document) {
    userId = docs[0].document.name.split("/").pop();
    console.log(`Found user ${userName}: ${userId}`);
  } else {
    return;
  }

  let bRes = await fetch(`${BASE_URL}/users/${userId}/books?pageSize=1000`);
  let bDocs = await bRes.json();
  if (!bDocs.documents) return;

  for (const d of bDocs.documents) {
    let f = d.fields;
    if (f.cover?.stringValue) continue; // Already has cover

    let title = f.title?.stringValue || "";
    let author = f.authors?.stringValue || "";
    if (!title) continue;

    let query = `${title} ${author}`.trim();

    try {
      let gRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`);
      let gData = await gRes.json();
      let cover = "", avgRating = null, year = "", pages = "";

      if (gData.items && gData.items.length > 0) {
        let b = gData.items[0].volumeInfo;
        cover = b.imageLinks?.smallThumbnail?.replace("http://", "https://") || "";
        avgRating = b.averageRating || null;
        year = b.publishedDate?.slice(0, 4) || "";
        pages = b.pageCount ? String(b.pageCount) : "";
      } else {
        let oRes = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=1&fields=key,first_publish_year,number_of_pages_median,cover_i,ratings_average`);
        let oData = await oRes.json();
        if (oData.docs && oData.docs.length > 0) {
          let od = oData.docs[0];
          if (od.cover_i) cover = `https://covers.openlibrary.org/b/id/${od.cover_i}-S.jpg`;
          if (od.ratings_average) avgRating = Math.round(od.ratings_average * 10) / 10;
          if (od.first_publish_year) year = String(od.first_publish_year);
          if (od.number_of_pages_median) pages = String(od.number_of_pages_median);
        }
      }

      if (cover || avgRating || year || pages) {
        let updateMask = [];
        if (cover) { f.cover = { stringValue: cover }; updateMask.push("cover"); }
        if (avgRating !== null && !f.avgRating) { f.avgRating = { doubleValue: avgRating }; updateMask.push("avgRating"); }
        if (year && !f.year?.stringValue) { f.year = { stringValue: year }; updateMask.push("year"); }
        if (pages && !f.pages?.stringValue) { f.pages = { stringValue: pages }; updateMask.push("pages"); }

        if (updateMask.length > 0) {
          let updateUrl = `https://firestore.googleapis.com/v1/${d.name}?${updateMask.map(m => `updateMask.fieldPaths=${m}`).join('&')}`;
          await fetch(updateUrl, { method: "PATCH", body: JSON.stringify({ name: d.name, fields: f }) });
          console.log(`Updated ${title} (cover: ${!!cover}, rating: ${avgRating})`);
        }
      }
      
      // Delay to avoid Google Books rate limiting
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.log(`Error searching ${title}: ${e.message}`);
    }
  }
}

(async () => {
  await backfillUser("Hilary");
  await backfillUser("Maddy");
  console.log("Backfill complete!");
})().catch(console.error);
