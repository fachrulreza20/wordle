// ====== CONFIG ======
const maxRows = 6;
const wordLength = 5;

let secretWord = "";
let currentRow = 0;
let currentGuess = [];
let isReady = false;
let isSubmitting = false;

// ====== HELPERS UI ======
const boardEl = document.getElementById("game-board");
const submitBtn = document.getElementById("submit-guess");
const playAgainBtn = document.getElementById("play-again");
const msg = document.getElementById("message");
const translationEl = document.getElementById("translation");
const sigCanvas = document.getElementById("sig-canvas");

function showMessage(text){
  msg.textContent = text || "";
}

function showTranslation(text){
  translationEl.innerHTML = text || "";
}

function clearMessage(){
  msg.textContent = "";
}

function endGame(){
  isReady = false;
  isSubmitting = false;
  submitBtn.disabled = true;
  playAgainBtn.hidden = false;

  document.querySelectorAll(".key").forEach(key => {
    key.disabled = true;
  });
}

// ====== INIT BOARD (6x5) ======
(function initBoard(){
  for (let r = 0; r < maxRows; r++){
    for (let c = 0; c < wordLength; c++){
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${r}-${c}`;
      tile.setAttribute("role", "gridcell");
      boardEl.appendChild(tile);
    }
  }
})();

// ====== DIRECT TILE INPUT ======
function renderCurrentGuess(){
  for (let col = 0; col < wordLength; col++){
    const tile = document.getElementById(`tile-${currentRow}-${col}`);
    tile.textContent = currentGuess[col] || "";
  }

  submitBtn.disabled =
    !isReady ||
    isSubmitting ||
    currentGuess.length !== wordLength;
}

function addLetter(letter){
  if (!isReady || isSubmitting || currentGuess.length >= wordLength) return;

  currentGuess.push(letter);
  clearMessage();
  renderCurrentGuess();
}

function removeLetter(){
  if (!isReady || isSubmitting || currentGuess.length === 0) return;

  currentGuess.pop();
  clearMessage();
  renderCurrentGuess();
}

// ====== KEYBOARD (Backspace di sebelah M) ======
const rows = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M","⌫"]
];

(function createKeyboard(){
  const keyboard = document.getElementById("keyboard");

  rows.forEach(row => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";

    row.forEach(keyValue => {
      const button = document.createElement("button");
      button.className = "key";
      button.type = "button";

      if (keyValue === "⌫"){
        button.textContent = "⌫";
        button.title = "Backspace";
        button.setAttribute("aria-label", "Backspace");
        button.classList.add("key-wide");
        button.addEventListener("click", removeLetter);
      } else {
        button.textContent = keyValue;
        button.id = `key-${keyValue}`;
        button.setAttribute("aria-label", keyValue);
        button.addEventListener("click", () => addLetter(keyValue));
      }

      rowEl.appendChild(button);
    });

    keyboard.appendChild(rowEl);
  });
})();

// Physical keyboard tetap didukung
document.addEventListener("keydown", event => {
  if (!isReady || isSubmitting) return;

  if (/^[a-zA-Z]$/.test(event.key)){
    addLetter(event.key.toUpperCase());
  } else if (event.key === "Backspace"){
    event.preventDefault();
    removeLetter();
  } else if (event.key === "Enter"){
    event.preventDefault();
    submitGuess();
  }
});

submitBtn.addEventListener("click", submitGuess);
playAgainBtn.addEventListener("click", () => location.reload());

// ====== API & FALLBACK ======
const FALLBACK_WORDS = [
  "ALONE","SALON","SNAIL","BOARD","PLANT",
  "CHAIR","MOUSE","LIGHT","BRAVE","HOUSE",
  "CLOUD","GREEN","SMART","POINT","DRIVE"
];

async function fetchRandomWordFromVercel(){
  const response = await fetch(
    "https://random-word-api.vercel.app/api?words=1&length=5",
    { cache: "no-store" }
  );

  if (!response.ok) throw new Error("Vercel word API failed");

  const data = await response.json();
  return data?.[0] ? data[0].toUpperCase() : null;
}

async function fetchRandomWordFromHeroku(){
  const response = await fetch(
    "https://random-word-api.herokuapp.com/word?length=5",
    { cache: "no-store" }
  );

  if (!response.ok) throw new Error("Heroku word API failed");

  const data = await response.json();
  return data?.[0] ? data[0].toUpperCase() : null;
}

async function validateWord(word){
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`,
    { cache: "no-store" }
  );

  return response.ok;
}

async function fetchDictionaryEntry(word){
  try{
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`,
      { cache: "no-store" }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return Array.isArray(data) ? data[0] : null;
  } catch {
    return null;
  }
}

function pickSmartDefinition(entry){
  const meanings = entry?.meanings || [];

  for (const meaning of meanings){
    const definitions = meaning?.definitions || [];

    for (const item of definitions){
      if (item?.definition){
        return {
          pos: meaning.partOfSpeech || "",
          definition: item.definition,
          example: item.example || ""
        };
      }
    }
  }

  return null;
}

// ====== TRANSLATION (multi-fallback) ======
async function translateViaGoogle(word){
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(word)}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Google translation failed");

  const data = await response.json();
  return data?.[0]?.[0]?.[0] || "";
}

async function translateViaMyMemory(word){
  const url =
    `https://api.mymemory.translated.net/get` +
    `?q=${encodeURIComponent(word)}&langpair=en|id`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("MyMemory translation failed");

  const data = await response.json();
  return data?.responseData?.translatedText || "";
}

async function translateViaLibre(word){
  const response = await fetch("https://libretranslate.de/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: word,
      source: "en",
      target: "id",
      format: "text"
    })
  });

  if (!response.ok) throw new Error("LibreTranslate failed");

  const data = await response.json();
  return data?.translatedText || "";
}

async function translateToIndonesian(word){
  const translators = [
    translateViaGoogle,
    translateViaMyMemory,
    translateViaLibre
  ];

  for (const translator of translators){
    try{
      const translation = await translator(word);

      if (
        translation &&
        translation.trim() &&
        translation.toUpperCase() !== word.toUpperCase()
      ){
        return translation.trim();
      }
    } catch {
      // Coba API berikutnya.
    }
  }

  return "";
}

// ====== LOAD SECRET WORD ======
async function initSecretWord(){
  showMessage("Loading word...");
  showTranslation("");
  submitBtn.disabled = true;

  const fetchers = [
    fetchRandomWordFromVercel,
    fetchRandomWordFromHeroku
  ];

  for (let attempt = 0; attempt < 10; attempt++){
    try{
      const fetchWord = fetchers[attempt % fetchers.length];
      const candidate = await fetchWord();

      if (!candidate || candidate.length !== wordLength) continue;

      const valid = await validateWord(candidate);

      if (valid){
        secretWord = candidate;
        isReady = true;
        clearMessage();
        renderCurrentGuess();
        return;
      }
    } catch {
      // Coba lagi.
    }
  }

  secretWord =
    FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];

  isReady = true;
  clearMessage();
  renderCurrentGuess();
}

initSecretWord();

// ====== GAME LOGIC ======
async function submitGuess(){
  if (!isReady || isSubmitting) return;

  const guess = currentGuess.join("");

  clearMessage();

  if (guess.length !== wordLength){
    showMessage("Word must be 5 letters.");
    return;
  }

  isSubmitting = true;
  submitBtn.disabled = true;
  showMessage("Checking word...");

  let valid = false;

  try{
    valid = await validateWord(guess);
  } catch {
    showMessage("Unable to check the word. Please try again.");
    isSubmitting = false;
    renderCurrentGuess();
    return;
  }

  if (!valid){
    showMessage("❌ Not a valid English word!");
    isSubmitting = false;
    renderCurrentGuess();
    return;
  }

  clearMessage();
  colorize(guess);

  if (guess === secretWord){
    showMessage("🎉 You Win!");
    await revealTranslation();
    await endGameWithStats(true);
    return;
  }

  currentRow++;
  currentGuess = [];
  isSubmitting = false;

  if (currentRow >= maxRows){
    showMessage(`❌ Game Over! The word was ${secretWord}`);
    await revealTranslation();
    await endGameWithStats(false);
    return;
  }

  renderCurrentGuess();
}

// Wordle-compatible duplicate-letter evaluation
function colorize(guess){
  const result = Array(wordLength).fill("absent");
  const remaining = secretWord.split("");

  // First pass: exact matches
  for (let i = 0; i < wordLength; i++){
    if (guess[i] === secretWord[i]){
      result[i] = "correct";
      remaining[i] = null;
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < wordLength; i++){
    if (result[i] === "correct") continue;

    const foundIndex = remaining.indexOf(guess[i]);

    if (foundIndex !== -1){
      result[i] = "present";
      remaining[foundIndex] = null;
    }
  }

  for (let i = 0; i < wordLength; i++){
    const tile = document.getElementById(`tile-${currentRow}-${i}`);
    tile.classList.add(result[i]);
    tintKey(guess[i], result[i]);
  }
}

function tintKey(letter, status){
  const key = document.getElementById(`key-${letter}`);
  if (!key) return;

  if (status === "correct"){
    key.classList.remove("key-present", "key-absent");
    key.classList.add("key-correct");
  } else if (
    status === "present" &&
    !key.classList.contains("key-correct")
  ){
    key.classList.remove("key-absent");
    key.classList.add("key-present");
  } else if (
    !key.classList.contains("key-correct") &&
    !key.classList.contains("key-present")
  ){
    key.classList.add("key-absent");
  }
}

// ====== SMART DICTIONARY OUTPUT ======
async function revealTranslation(){
  showTranslation("<small>Loading meaning…</small>");

  const [entry, indo] = await Promise.all([
    fetchDictionaryEntry(secretWord),
    translateToIndonesian(secretWord)
  ]);

  const picked = entry ? pickSmartDefinition(entry) : null;

  let html =
    `<span class="flag">🇮🇩</span> Translation: ` +
    `<b>${secretWord}</b> → `;

  html += indo
    ? `<b>${indo}</b>`
    : `<i>(unavailable)</i>`;

  if (picked){
    html +=
      `<br><span class="flag">🇬🇧</span> ` +
      `<b>${picked.pos || "meaning"}</b>: ${picked.definition}`;

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
  try{
    const stored = JSON.parse(localStorage.getItem("wordleStats"));

    return stored || {
      played: 0,
      wins: 0,
      currentStreak: 0,
      bestStreak: 0
    };
  } catch {
    return {
      played: 0,
      wins: 0,
      currentStreak: 0,
      bestStreak: 0
    };
  }
}

function saveStats(stats){
  localStorage.setItem("wordleStats", JSON.stringify(stats));
}

function updateStatsDisplay(){
  const stats = loadStats();
  const winRate = stats.played
    ? Math.round((stats.wins / stats.played) * 100)
    : 0;

  document.getElementById("stats-body").innerHTML = `
    <div><span>${stats.played}</span>Played</div>
    <div><span>${stats.wins}</span>Wins</div>
    <div><span>${winRate}%</span>Win Rate</div>
    <div><span>${stats.currentStreak}</span>Streak</div>
    <div><span>${stats.bestStreak}</span>Best</div>
  `;
}

async function endGameWithStats(win){
  const stats = loadStats();

  stats.played++;

  if (win){
    stats.wins++;
    stats.currentStreak++;

    if (stats.currentStreak > stats.bestStreak){
      stats.bestStreak = stats.currentStreak;
    }
  } else {
    stats.currentStreak = 0;
  }

  saveStats(stats);
  updateStatsDisplay();
  endGame();
}

updateStatsDisplay();

// ====== SIGNATURE VIA CANVAS ======
(function renderSignature(){
  try{
    const context = sigCanvas.getContext("2d");

    const first = atob("ZmFjaHJ1bHJl");
    const second = atob("emEyMA==");
    const domain = atob("Z21haWwuY29t");
    const email = first + second + "@" + domain;

    const text = "by " + email;
    const paddingX = 10;
    const paddingY = 6;

    context.font =
      "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

    const width =
      Math.ceil(context.measureText(text).width) + paddingX * 2;
    const height = 22 + paddingY * 2;

    sigCanvas.width = width;
    sigCanvas.height = height;

    context.font =
      "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    context.fillStyle = "rgba(0,0,0,0.6)";
    context.textBaseline = "middle";
    context.fillText(text, paddingX, height / 2);
  } catch {
    // Signature is optional.
  }
})();
