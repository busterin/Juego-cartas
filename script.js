// --- Elementos base
const startBtn = document.getElementById("startBtn");
const startOverlay = document.getElementById("startOverlay");
const dialogue = document.getElementById("dialogue");
const dialogueText = document.getElementById("dialogueText");
const nextDialogue = document.getElementById("nextDialogue");
const hud = document.getElementById("hud");
const gameBoard = document.getElementById("gameBoard");
const attackBtn = document.getElementById("attackBtn");
const hint = document.getElementById("hint");

const playerZone = document.getElementById("playerZone");
const enemyZone  = document.getElementById("enemyZone");

// --- Diálogo (asegurar visibilidad del texto)
const dialogueLines = [
  "¡Bienvenido al combate!",
  "Coloca tus cartas y lucha."
];
let dialogueIndex = 0;

function showDialogue(lineIdx=0){
  dialogueIndex = lineIdx;
  dialogueText.textContent = dialogueLines[dialogueIndex] || "";
  dialogue.classList.remove("hidden"); // z-index asegura visibilidad
}
function nextDialog(){
  dialogueIndex++;
  if (dialogueIndex < dialogueLines.length){
    dialogueText.textContent = dialogueLines[dialogueIndex];
  } else {
    dialogue.classList.add("hidden");
    hud.classList.remove("hidden");
    gameBoard.classList.remove("hidden");
  }
}

// --- Inicio
startBtn.addEventListener("click", () => {
  startOverlay.classList.add("hidden");
  showDialogue(0);
});
nextDialogue.addEventListener("click", nextDialog);

// --- Estado de juego
const state = {
  mode: "idle",          // "idle" | "select-attacker"
  attackerId: null
};

function setMode(mode){
  state.mode = mode;
  state.attackerId = null;
  // UI
  clearSelections();
  if (mode === "select-attacker") {
    hint.textContent = "Elige una carta del jugador para atacar";
    markPlayerCardsSelectable(true);
  } else {
    hint.textContent = "";
    markPlayerCardsSelectable(false);
  }
}

attackBtn.addEventListener("click", () => {
  // Evitar dobles activaciones
  if (state.mode === "select-attacker") { setMode("idle"); return; }
  setMode("select-attacker");
});

// --- Creación de cartas
let uid = 0;
function createCard(name, side="player"){
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = `${side}-${uid++}`;
  card.dataset.side = side;
  card.title = name;

  // Contenido simple (puedes sustituir por <img> si tienes artes)
  card.textContent = name;

  // Zoom: solo cuando no estamos eligiendo atacante
  card.addEventListener("click", (ev) => {
    if (state.mode === "select-attacker") return; // desactivar zoom durante selección
    card.classList.toggle("zoom");
  });

  // Golpe visual
  card.addEventListener("hit", () => {
    const effect = document.createElement("div");
    effect.className = "hit-effect";
    card.appendChild(effect);
    setTimeout(() => effect.remove(), 280);
  });

  return card;
}

// Cartas iniciales
["Guerrera", "Sanadora", "Arquera"].forEach(n => playerZone.appendChild(createCard(n, "player")));
["Slime", "Esqueleto"].forEach(n => enemyZone.appendChild(createCard(n, "enemy")));

// --- Delegación de eventos para selección robusta (evita fallos “a ratos”)
playerZone.addEventListener("click", (e) => {
  const el = e.target.closest(".card");
  if (!el) return;

  if (state.mode === "select-attacker") {
    // Quitar zoom si estuviera, para evitar conflictos de capas/click
    el.classList.remove("zoom");
    clearSelections();
    el.classList.add("selected");
    state.attackerId = el.dataset.id;
    hint.textContent = `Atacante: ${el.title}. (Pulsa otra vez ATACAR para cancelar)`;
    // Aquí podrías continuar con selección de objetivo enemigo si procede…
    // Por ahora, simulamos un golpe visual al azar:
    simulateRandomHit();
    // Volvemos a modo idle
    setMode("idle");
  }
});

// --- Ayudas visuales
function markPlayerCardsSelectable(on){
  playerZone.querySelectorAll(".card").forEach(c => {
    c.classList.toggle("selectable", on);
    if (on) c.classList.remove("zoom"); // evita conflictos de hitbox
  });
}
function clearSelections(){
  document.querySelectorAll(".selected").forEach(c => c.classList.remove("selected"));
}

// --- Simulación de golpe (demo)
function simulateRandomHit(){
  const enemies = enemyZone.querySelectorAll(".card");
  if (!enemies.length) return;
  const tgt = enemies[Math.floor(Math.random()*enemies.length)];
  tgt.dispatchEvent(new Event("hit"));
}

// --- Seguridad extra contra “borde negro” durante zoom
// Forzamos reflow tras toggles de zoom para estabilizar AA en algunos navegadores.
document.addEventListener("transitionend", (e) => {
  if (e.target.classList && e.target.classList.contains("card")) {
    // Acceso forzado al offsetTop = reflow
    void e.target.offsetTop;
  }
});

// --- Tick de demo: golpe aleatorio cada 3s
setInterval(() => {
  const cards = document.querySelectorAll(".card");
  if (cards.length) cards[Math.floor(Math.random()*cards.length)].dispatchEvent(new Event("hit"));
}, 3000);