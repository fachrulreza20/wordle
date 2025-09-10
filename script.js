// ====== CONFIG ======
const maxRows = 6;
const wordLength = 5;

let secretWord = "";
let currentRow = 0;
let isReady = false;

// ====== INIT BOARD (6x5) ======
(function initBoard(){
  const board = document.getElementById("game-board");
  for (let r = 0; r < maxRows; r++){
    for (let c = 0; c < wordLength; c++){
      const d = document.createElement("div");
      d.className = "tile";
      d.id = `tile-${r}-${c}`;
      d.setAttribute("role","gridcell");
      board.appendChild(d);
    }
  }
})();

// ====== KEYBOARD ======
const keys = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M"]
];

(function createKeyboard(){
  const kb = document.getElementById("keyboard");
  keys.forEach(row=>{
    const r = document.createElement("div");
    r.className = "key-row";
    row.forEach(k=>{
      const b = document.createElement("button");
      b.className = "key";
      b.textContent = k;
      b.id = `key-${k}`;
      b.addEventListener("click", ()=>addLetter(k));
      r.appendChild(b);
    });
    kb.appendChild(r);
  });

  // Backspace + Enter row
  const r = document.createElement("div");
  r.className = "key-row";
  const back = document.createElement("button");
  back.className = "key";
  back.textContent = "⌫";
  back.title = "Backspace";
  back.addEventListener("click", backspace);

  const enter = document.createElement("button");
  enter.className = "key";
  enter.textContent = "⏎";
  enter.title = "Enter";
  enter.addEventListener("click", submitGuess);

  r.appendChild(back);
  r.appendChild(enter);
  kb.appendChild(r);
})();

// ====== INPUT HANDLERS ======
const inputEl = document.getElementById("guess-input");
const submitBtn = document.getElementById("submit-guess");
const playAgainBtn = document.getElementById("play-again");
const msg = document.getElementById("message");

inputEl.addEventListener("input", ()=> {
  inputEl.value = inputEl.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0, wordLength);
});
inputEl.addEventListener("keydown", (e)=>{
  if (e.key === "Enter") submitGuess();
});
submitBtn.addEventListener("click", submitGuess);
playAgainBtn.addEventListener("click", ()=>location.reload());

// on-screen keyboard helpers
function addLetter(ch){
  if (!isReady) return;
  if (inputEl.value.length < wordLength){
    inputEl.value += ch;
  }
}
function backspace(){
  inputEl.value = inputEl.value.slice(0,-1);
}

// ====== API HELPERS ======
async function fetchRandomWord(){
  // Random Word API (no key, CORS OK)
  const res = await fetch("https://random-word-api.herokuapp.com/word?length=5",{cache:"no-store"});
  const data = await res.json(); // e.g. ["plant"]
  return (data && data[0]) ? data[0].toUpperCase() : null;
}
async function validateWord(word){
  // Free Dictionary API — 200 if exists, 404 if not
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`, {cache:"no-store"});
  return res.ok;
}

// Load secretWord (keep trying until valid)
(async function initSecretWord(){
  msg.textContent = "Loading word...";
  submitBtn.disabled = true;

  for (let i=0; i<8; i++){
    try{
      const candidate = await fetchRandomWord();
      if (!candidate) continue;
      const ok = await validateWord(candidate);
      if (ok){
        secretWord = candidate.toUpperCase();
        console.log("Secret word:", secretWord); // dev
        msg.textContent = "Ready!";
        isReady = true;
        submitBtn.disabled = false;
        inputEl.focus();
        return;
      }
    }catch(_e){}
  }
  msg.textContent = "Failed to load word. Please refresh.";
})();

// ====== GAME LOGIC ======
async function submitGuess(){
  if (!isReady) return;
  const guess = inputEl.value.toUpperCase();

  if (guess.length !== wordLength){
    showMessage("Word must be 5 letters.");
    return;
  }

  // validate guess via dictionary API (to prevent nonsense words)
  const ok = await validateWord(guess);
  if (!ok){
    showMessage("❌ Not a valid English word!");
    return;
  }

  // render guess in the current row
  for (let i=0;i<wordLength;i++){
    const t = document.getElementById(`tile-${currentRow}-${i}`);
    t.textContent = guess[i];
  }

  colorize(guess);

  if (guess === secretWord){
    showMessage("🎉 You Win!");
    endGame();
    return;
  }

  currentRow++;
  inputEl.value = "";

  if (currentRow >= maxRows){
    showMessage(`❌ Game Over! The word was ${secretWord}`);
    endGame();
  }
}

function colorize(guess){
  for (let i=0;i<wordLength;i++){
    const t = document.getElementById(`tile-${currentRow}-${i}`);
    const ch = guess[i];

    if (ch === secretWord[i]){
      t.classList.add("correct");
      tintKey(ch,"correct");
    }else if (secretWord.includes(ch)){
      t.classList.add("present");
      tintKey(ch,"present");
    }else{
      t.classList.add("absent");
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

function showMessage(text){
  msg.textContent = text;
}

function endGame(){
  isReady = false;
  inputEl.disabled = true;
  submitBtn.disabled = true;
  playAgainBtn.hidden = false;
}
