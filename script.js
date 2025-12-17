// ====== CONFIG ======
const maxRows = 6;
const wordLength = 5;

let secretWord = "";
let currentRow = 0;
let isReady = false;

// ====== HELPERS UI ======
const boardEl = document.getElementById("game-board");
const inputEl = document.getElementById("guess-input");
const submitBtn = document.getElementById("submit-guess");
const playAgainBtn = document.getElementById("play-again");
const msg = document.getElementById("message");
const translationEl = document.getElementById("translation");
const sigCanvas = document.getElementById("sig-canvas");

function showMessage(text){ msg.textContent = text || ""; }
function showTranslation(text){ translationEl.innerHTML = text || ""; }
function clearMessage(){ msg.textContent = ""; }
function endGame(){
  isReady = false;
  inputEl.disabled = true;
  submitBtn.disabled = true;
  playAgainBtn.hidden = false;
}

// ====== INIT BOARD (6x5) ======
(function initBoard(){
  for (let r = 0; r < maxRows; r++){
    for (let c = 0; c < wordLength; c++){
      const d = document.createElement("div");
      d.className = "tile";
      d.id = `tile-${r}-${c}`;
      d.setAttribute("role","gridcell");
      boardEl.appendChild(d);
    }
  }
})();

// ====== KEYBOARD (Backspace di sebelah M) ======
const rows = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M","⌫"]
];

(function createKeyboard(){
  const kb = document.getElementById("keyboard");
  rows.forEach(row=>{
    const r = document.createElement("div"); r.className = "key-row";

    row.forEach(k=>{
      const b = document.createElement("button");
      b.className = "key";

      if (k === "⌫"){
        b.textContent = "⌫";
        b.title = "Backspace";
        b.classList.add("key-wide");
        b.addEventListener("click", ()=> inputEl.value = inputEl.value.slice(0,-1));
      } else {
        b.textContent = k;
        b.id = `key-${k}`;
        b.addEventListener("click", ()=>{
          if(isReady && inputEl.value.length < wordLength) inputEl.value += k;
        });
      }

      r.appendChild(b);
    });

    kb.appendChild(r);
  });
})();


// ====== INPUT ======
inputEl.addEventListener("input", ()=> {
  inputEl.value = inputEl.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0, wordLength);
});
inputEl.addEventListener("keydown", (e)=>{ if(e.key==="Enter") submitGuess(); });
submitBtn.addEventListener("click", submitGuess);
playAgainBtn.addEventListener("click", ()=>location.reload());

// ====== API & FALLBACK ======
const FALLBACK_WORDS = ["ALONE","SALON","SNAIL","BOARD","PLANT","CHAIR","MOUSE","LIGHT","BRAVE","HOUSE","CLOUD","GREEN","SMART","POINT","DRIVE"];

async function fetchRandomWordFromVercel(){
  const res = await fetch("https://random-word-api.vercel.app/api?words=1&length=5", {cache:"no-store"});
  const data = await res.json();
  return (data && data[0]) ? data[0].toUpperCase() : null;
}
async function fetchRandomWordFromHeroku(){
  const res = await fetch("https://random-word-api.herokuapp.com/word?length=5", {cache:"no-store"});
  const data = await res.json();
  return (data && data[0]) ? data[0].toUpperCase() : null;
}
async function validateWord(word){
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`, {cache:"no-store"});
  return res.ok;
}

async function fetchDictionaryEntry(word){
  try{
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`, {cache:"no-store"});
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data[0] : null;
  }catch{
    return null;
  }
}

function pickSmartDefinition(entry){
  // pilih definisi pertama yang paling “berguna”
  const meanings = entry?.meanings || [];
  for (const m of meanings){
    const defs = m?.definitions || [];
    for (const d of defs){
      if (d?.definition) {
        return {
          pos: m.partOfSpeech || "",
          definition: d.definition,
          example: d.example || ""
        };
      }
    }
  }
  return null;
}


// ====== TRANSLATION (multi-fallback) ======
async function translateViaGoogle(word){
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(word)}`;
  const res = await fetch(url, {cache:"no-store"});
  if (!res.ok) throw new Error("google failed");
  const data = await res.json();
  const translated = data?.[0]?.[0]?.[0] || "";
  return translated;
}
async function translateViaMyMemory(word){
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|id`;
  const res = await fetch(url, {cache:"no-store"});
  if (!res.ok) throw new Error("mymemory failed");
  const data = await res.json();
  return data?.responseData?.translatedText || "";
}
async function translateViaLibre(word){
  const res = await fetch("https://libretranslate.de/translate", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({q: word, source:"en", target:"id", format:"text"})
  });
  if (!res.ok) throw new Error("libre failed");
  const data = await res.json();
  return data?.translatedText || "";
}
async function translateToIndonesian(word){
  const chain = [translateViaGoogle, translateViaMyMemory, translateViaLibre];
  for (const fn of chain){
    try{
      const t = await fn(word);
      if (t && t.trim() && t.toUpperCase() !== word.toUpperCase()) return t.trim();
    }catch(_e){}
  }
  return "";
}

// Load secret word, validate, then ready
async function initSecretWord(){
  showMessage("Loading word...");
  showTranslation("");
  submitBtn.disabled = true;

  const fetchers = [fetchRandomWordFromVercel, fetchRandomWordFromHeroku];

  for (let attempt = 0; attempt < 10; attempt++){
    try{
      const fn = fetchers[attempt % fetchers.length];
      const candidate = await fn();
      if (!candidate) continue;
      const ok = await validateWord(candidate);
      if (ok){
        secretWord = candidate;
        isReady = true;
        submitBtn.disabled = false;
        clearMessage(); // jangan tampil "Ready!"
        inputEl.focus();
        return;
      }
    }catch(e){}
  }

  // Fallback lokal
  secretWord = FALLBACK_WORDS[Math.floor(Math.random()*FALLBACK_WORDS.length)];
  isReady = true;
  submitBtn.disabled = false;
  clearMessage();
  inputEl.focus();
}
initSecretWord();

// ====== GAME LOGIC ======
async function submitGuess(){
  if (!isReady) return;

  const guess = inputEl.value.toUpperCase();
  clearMessage(); // pastikan pesan lama hilang kalau guess valid

  if (guess.length !== wordLength){
    showMessage("Word must be 5 letters.");
    return;
  }

  const valid = await validateWord(guess).catch(()=>false);
  if (!valid){
    showMessage("❌ Not a valid English word!");
    return;
  }

  // render row
  for (let i=0;i<wordLength;i++){
    const t = document.getElementById(`tile-${currentRow}-${i}`);
    t.textContent = guess[i];
  }

  colorize(guess);

if (guess === secretWord){
  showMessage("🎉 You Win!");
  await revealTranslation();
  await endGameWithStats(true);   // <-- pakai stats
  return;
}

  currentRow++;
  inputEl.value = "";

if (currentRow >= maxRows){
  showMessage(`❌ Game Over! The word was ${secretWord}`);
  await revealTranslation();
  await endGameWithStats(false);  // <-- pakai stats
}
}

function colorize(guess){
  for (let i=0;i<wordLength;i++){
    const tile = document.getElementById(`tile-${currentRow}-${i}`);
    const ch = guess[i];

    if (ch === secretWord[i]){
      tile.classList.add("correct");
      tintKey(ch,"correct");
    } else if (secretWord.includes(ch)){
      tile.classList.add("present");
      tintKey(ch,"present");
    } else {
      tile.classList.add("absent");
      tintKey(ch,"absent");
    }
  }
}

function tintKey(letter, status){
  const k = document.getElementById(`key-${letter}`);
  if (!k) return;
  if (status === "correct"){
    k.classList.remove("key-present","key-absent");
    k.classList.add("key-correct");
  } else if (status === "present" && !k.classList.contains("key-correct")){
    k.classList.remove("key-absent");
    k.classList.add("key-present");
  } else if (!k.classList.contains("key-correct") && !k.classList.contains("key-present")){
    k.classList.add("key-absent");
  }
}

// ====== Translation output with 🇮🇩 flag ======
async function revealTranslation(){
  showTranslation("<small>Loading meaning…</small>");

  // 1) Kamus (paling penting)
  const entry = await fetchDictionaryEntry(secretWord);
  const picked = entry ? pickSmartDefinition(entry) : null;

  // 2) Terjemahan (bonus, boleh gagal / boleh salah)
  const indo = await translateToIndonesian(secretWord);

  // 3) Render output (selalu tampilkan definisi jika ada)
  let html = `<span class="flag">🇮🇩</span> Translation: <b>${secretWord}</b> → `;
  html += indo ? `<b>${indo}</b>` : `<i>(unavailable)</i>`;

  if (picked){
    html += `<br><span class="flag">🇬🇧</span> <b>${picked.pos || "meaning"}</b>: ${picked.definition}`;
    if (picked.example){
      html += `<br><small>Example: “${picked.example}”</small>`;
    }
  } else {
    html += `<br><small>(Dictionary meaning unavailable)</small>`;
  }

  showTranslation(html);
}


// ====== STATISTICS ======
function loadStats(){
  let stats = JSON.parse(localStorage.getItem("wordleStats"));
  if (!stats){
    stats = { played: 0, wins: 0, currentStreak: 0, bestStreak: 0 };
  }
  return stats;
}

function saveStats(stats){
  localStorage.setItem("wordleStats", JSON.stringify(stats));
}

function updateStatsDisplay(){
  const stats = loadStats();
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  document.getElementById("stats-body").innerHTML = `
    <div><span>${stats.played}</span>Played</div>
    <div><span>${stats.wins}</span>Wins</div>
    <div><span>${winRate}%</span>Win Rate</div>
    <div><span>${stats.currentStreak}</span>Streak</div>
    <div><span>${stats.bestStreak}</span>Best</div>
  `;
}

// update stats setelah game selesai
async function endGameWithStats(win){
  let stats = loadStats();
  stats.played++;
  if (win){
    stats.wins++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.bestStreak){
      stats.bestStreak = stats.currentStreak;
    }
  }else{
    stats.currentStreak = 0;
  }
  saveStats(stats);
  updateStatsDisplay();
  endGame(); // panggil endGame yang sudah ada
}

// Panggil sekali saat load
updateStatsDisplay();


// ====== Signature (email) via canvas, diobfusikasi ======
(function renderSignature(){
  try{
    const ctx = sigCanvas.getContext("2d");
    // potongan base64 agar tidak ada email utuh di source
    const a = atob("ZmFjaHJ1bHJl");   // 'fachrulre'
    const b = atob("emEyMA==");        // 'za20'
    const c = atob("Z21haWwuY29t");    // 'gmail.com'
    const email = a + b + "@" + c;     // fachrulreza20@gmail.com

    // ukuran & render
    const text = "by " + email;
    const paddingX = 10, paddingY = 6;
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const w = Math.ceil(ctx.measureText(text).width) + paddingX*2;
    const h = 22 + paddingY*2;
    sigCanvas.width = w; sigCanvas.height = h;

    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.textBaseline = "middle";
    ctx.fillText(text, paddingX, h/2);
  }catch(_e){}
})();
