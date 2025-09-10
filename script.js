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

function showMessage(text){ msg.textContent = text; }
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

// ====== KEYBOARD ======
const rows = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M"]
];

(function createKeyboard(){
  const kb = document.getElementById("keyboard");
  rows.forEach(row=>{
    const r = document.createElement("div"); r.className = "key-row";
    row.forEach(k=>{
      const b = document.createElement("button");
      b.className = "key"; b.textContent = k; b.id = `key-${k}`;
      b.addEventListener("click", ()=>{
        if(isReady && inputEl.value.length<wordLength) inputEl.value += k;
      });
      r.appendChild(b);
    });
    kb.appendChild(r);
  });

  // HANYA Backspace (tidak ada Enter button)
  const r = document.createElement("div"); r.className = "key-row";
  const back = document.createElement("button");
  back.className="key"; back.textContent="⌫"; back.title="Backspace";
  back.addEventListener("click", ()=> inputEl.value = inputEl.value.slice(0,-1));
  r.appendChild(back);
  kb.appendChild(r);
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
        console.log("Secret word:", secretWord);
        isReady = true;
        submitBtn.disabled = false;
        clearMessage();           // <-- tidak menampilkan "Ready!"
        inputEl.focus();
        return;
      }
    }catch(e){}
  }

  // Fallback lokal
  secretWord = FALLBACK_WORDS[Math.floor(Math.random()*FALLBACK_WORDS.length)];
  console.warn("Using fallback word:", secretWord);
  isReady = true;
  submitBtn.disabled = false;
  clearMessage();                 // tetap kosong
  inputEl.focus();
}
initSecretWord();

// ====== GAME LOGIC ======
async function submitGuess(){
  if (!isReady) return;

  const guess = inputEl.value.toUpperCase();

  // Bersihkan pesan agar "Not a valid..." tidak stay saat guess valid
  clearMessage();

  if (guess.length !== wordLength){
    showMessage("Word must be 5 letters.");
    return;
  }

  const valid = await validateWord(guess).catch(()=>false);
  if (!valid){
    showMessage("❌ Not a valid English word!");
    return;
  }

  for (let i=0;i<wordLength;i++){
    const t = document.getElementById(`tile-${currentRow}-${i}`);
    t.textContent = guess[i];
  }

  colorize(guess);

  if (guess === secretWord){
    showMessage("🎉 You Win!");
    await revealTranslation();
    endGame();
    return;
  }

  currentRow++;
  inputEl.value = "";

  if (currentRow >= maxRows){
    showMessage(`❌ Game Over! The word was ${secretWord}`);
    await revealTranslation();
    endGame();
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

async function revealTranslation(){
  showTranslation("<small>Translating…</small>");
  const indo = await translateToIndonesian(secretWord);
  if (indo){
    showTranslation(`Translation: <b>${secretWord}</b> → <b>${indo}</b>`);
  }else{
    showTranslation(`Translation: <b>${secretWord}</b> → <i>(unavailable)</i>`);
  }
}
