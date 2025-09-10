const startBtn = document.getElementById("startBtn");
const startOverlay = document.getElementById("startOverlay");
const dialogue = document.getElementById("dialogue");
const gameBoard = document.getElementById("gameBoard");
const nextDialogue = document.getElementById("nextDialogue");
const dialogueText = document.getElementById("dialogueText");

let dialogueLines = [
  "¡Bienvenido al combate!",
  "Coloca tus cartas y lucha."
];
let dialogueIndex = 0;

startBtn.addEventListener("click", () => {
  startOverlay.classList.add("hidden");
  dialogue.classList.remove("hidden");
  dialogueText.textContent = dialogueLines[dialogueIndex];
});

nextDialogue.addEventListener("click", () => {
  dialogueIndex++;
  if (dialogueIndex < dialogueLines.length) {
    dialogueText.textContent = dialogueLines[dialogueIndex];
  } else {
    dialogue.classList.add("hidden");
    gameBoard.classList.remove("hidden");
  }
});

// Crear cartas de ejemplo
function createCard(name) {
  const card = document.createElement("div");
  card.className = "card";
  card.textContent = name;

  card.addEventListener("click", () => {
    card.classList.toggle("zoom");
  });

  // efecto al ser golpeada
  card.addEventListener("hit", () => {
    const effect = document.createElement("div");
    effect.className = "hit-effect";
    card.appendChild(effect);
    setTimeout(() => effect.remove(), 300);
  });

  return card;
}

// Añadir cartas al jugador
const playerZone = document.getElementById("playerZone");
["Guerrera", "Sanadora"].forEach(name => {
  playerZone.appendChild(createCard(name));
});

// Simulación de golpe cada 3s
setInterval(() => {
  const cards = document.querySelectorAll(".card");
  if (cards.length > 0) {
    const random = cards[Math.floor(Math.random() * cards.length)];
    random.dispatchEvent(new Event("hit"));
  }
}, 3000);