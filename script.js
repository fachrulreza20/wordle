let secretWord = "";
let currentRow = 0;
let currentCol = 0;
const maxRows = 6;
const wordLength = 5;

// --- Inisialisasi board kosong (6x5) ---
function initBoard() {
  const board = document.getElementById("game-board");
  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < wordLength; c++) {
      const tile = document.createElement("div");
      tile.classList.add("tile");
      tile.setAttribute("id", `tile-${r}-${c}`);
      board.appendChild(tile);
    }
  }
}
initBoard();

// --- Ambil kata random dari API ---
fetch("https://wordle-list.malted.dev/choice")
  .then(res => res.json())
  .then(data => {
    secretWord = data.word.toUpperCase();
    console.log("Secret word:", secretWord); // debug
  });

// --- Event submit manual ---
document.getElementById("submit-guess").addEventListener("click", () => {
  const input = document.getElementById("guess-input");
  processGuess(input.value.toUpperCase());
});

// --- Proses guess ---
function processGuess(guess) {
  if (guess.length !== wordLength) {
    document.getElementById("message").textContent = "Word must be 5 letters.";
    return;
  }

  fetch(`https://wordle-list.malted.dev/valid?word=${guess.toLowerCase()}`)
    .then(res => res.json())
    .then(data => {
      if (!data.valid) {
        document.getElementById("message").textContent = "❌ Not a valid word!";
        return;
      }

      // Isi ke board row sekarang
      for (let i = 0; i < wordLength; i++) {
        const tile = document.getElementById(`tile-${currentRow}-${i}`);
        tile.textContent = guess[i];
      }

      checkGuess(guess);

      if (guess === secretWord) {
        document.getElementById("message").textContent = "🎉 You Win!";
        disableInput();
        return;
      }

      currentRow++;
      if (currentRow >= maxRows) {
        document.getElementById("message").textContent = `❌ Game Over! The word was ${secretWord}`;
        disableInput();
      }

      document.getElementById("guess-input").value = "";
    });
}

// --- Cek hasil tebakan ---
function checkGuess(guess) {
  for (let i = 0; i < wordLength; i++) {
    const tile = document.getElementById(`tile-${currentRow}-${i}`);
    const letter = guess[i];

    if (letter === secretWord[i]) {
      tile.classList.add("correct");
      updateKeyboard(letter, "correct");
    } else if (secretWord.includes(letter)) {
      tile.classList.add("present");
      updateKeyboard(letter, "present");
    } else {
      tile.classList.add("absent");
      updateKeyboard(letter, "absent");
    }
  }
}

// --- Nonaktifkan input setelah selesai ---
function disableInput() {
  document.getElementById("guess-input").disabled = true;
  document.getElementById("submit-guess").disabled = true;
}

// --- Keyboard Virtual ---
const keys = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["Z","X","C","V","B","N","M"]
];

function createKeyboard() {
  const keyboard = document.getElementById("keyboard");
  keys.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.classList.add("key-row");
    row.forEach(key => {
      const button = document.createElement("button");
      button.textContent = key;
      button.classList.add("key");
      button.setAttribute("id", `key-${key}`);
      button.addEventListener("click", () => {
        let input = document.getElementById("guess-input");
        if (input.value.length < wordLength) {
          input.value += key;
        }
      });
      rowDiv.appendChild(button);
    });
    keyboard.appendChild(rowDiv);
  });

  // Tombol backspace & enter
  const lastRow = document.createElement("div");
  lastRow.classList.add("key-row");

  const backBtn = document.createElement("button");
  backBtn.textContent = "⌫";
  backBtn.classList.add("key");
  backBtn.addEventListener("click", () => {
    let input = document.getElementById("guess-input");
    input.value = input.value.slice(0, -1);
  });

  const enterBtn = document.createElement("button");
  enterBtn.textContent = "⏎";
  enterBtn.classList.add("key");
  enterBtn.addEventListener("click", () => {
    processGuess(document.getElementById("guess-input").value.toUpperCase());
  });

  lastRow.appendChild(backBtn);
  lastRow.appendChild(enterBtn);
  keyboard.appendChild(lastRow);
}
createKeyboard();

// --- Update warna keyboard ---
function updateKeyboard(letter, status) {
  const keyBtn = document.getElementById(`key-${letter}`);
  if (!keyBtn) return;

  if (status === "correct") {
    keyBtn.classList.remove("key-present", "key-absent");
    keyBtn.classList.add("key-correct");
  } else if (status === "present" && !keyBtn.classList.contains("key-correct")) {
    keyBtn.classList.remove("key-absent");
    keyBtn.classList.add("key-present");
  } else if (!keyBtn.classList.contains("key-correct") && !keyBtn.classList.contains("key-present")) {
    keyBtn.classList.add("key-absent");
  }
}
