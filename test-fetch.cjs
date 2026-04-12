async function run() {
  try {
    const start = Date.now();
    const res = await fetch("http://127.0.0.1:7777/api/dungeon-buddy/oracle/forge-character", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ 
        description: "A dark knight", 
        mode: "text", 
        constraints: { 
          races: [{id: "human"}], 
          classes: [{id: "fighter", allowedSkills: ["acrobatics"], numChoices: 2}], 
          backgrounds: ["acolyte"] 
        } 
      })
    });
    console.log("Status:", res.status, "Time:", Date.now() - start, "ms");
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}
run();
