fetch('http://127.0.0.1:8888/api/dungeon-buddy/scribe/summarize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: "Hey this is just a quick test session, the adventurers walked into the tavern, bartender said hi, and they left to find the sword." })
}).then(async r => {
  console.log("Status:", r.status);
  console.log(await r.text());
}).catch(console.error);
