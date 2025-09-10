let secretWord = "";
let currentRow = 0;
const maxRows = 6;

// Ambil kata random dari Wordle-List API
fetch("https://wordle-list.malted.dev/choice")
  .then(res => res.json())
  .then(data => {
    secretWord = data.word.toUpperCase();
    console.log("Secret word:", secretWord); // debug
  });

document.getElementById("submit-guess").addEventListener("click", () => {
  const input = document.getElementById("guess-input");
  const guess = input.value.toUpperCase();

  if (guess.length !== 5) {
    document.getElementById("message").textContent = "Word must be 5 letters.";
    return;
  }

  // Validasi dengan API
  fetch(`https://wordle-list.malted.dev/valid?word=${guess.toLowerCase()}`)
    .then(res => res.json())
    .then(data => {
      if (!data.valid) {
        document.getElementById("message").textContent = "❌ Not a valid word!";
        return;
      }

      addRow(guess);
      checkGuess(guess);

      if (guess === secretWord) {
        document.getElementById("message").textContent = "🎉 You Win!";
        return;
      }

      currentRow++;
      if (currentRow >= maxRows) {
        document.getElementById("message").textContent = `❌ Game Over! The word was ${secretWord}`;
      }

      input.value = "";
    });
});

function addRow(word) {
  const board = document.getElementById("game-board");
  for (let i = 0; i < word.length; i++) {
    const tile = document.createElement("div");
    tile.classList.add("tile");
    tile.textContent = word[i];
    board.appendChild(tile);
  }
}

function checkGuess(guess) {
  const board = document.getElementById("game-board");
  const startIndex = currentRow * 5;

  for (let i = 0; i < guess.length; i++) {
    const tile = board.children[startIndex + i];
    if (guess[i] === secretWord[i]) {
      tile.classList.add("correct");
    } else if (secretWord.includes(guess[i])) {
      tile.classList.add("present");
    } else {
      tile.classList.add("absent");
    }
  }
}
