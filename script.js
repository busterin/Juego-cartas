(() => {
  // ---------- Utils ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const uid = (()=>{ let n=1; return ()=> n++; })();

  // ---------- DOM ----------
  const handEl = $('#hand');
  const roundNoEl = $('#roundNo');
  const pCoinsEl = $('#pCoins'), eCoinsEl = $('#eCoins');
  const pScoreEl = $('#pScore'), eScoreEl = $('#eScore');
  const endOverlay = $('#endOverlay'); const endTitle = $('#endTitle'); const endLine = $('#endLine');
  const zoomOverlay = $('#zoomOverlay'); const zoomWrap = $('#zoomCardWrap');

  const againBtn = $('#againBtn');
  const passBtn = $('#passBtn');
  const resetBtn = $('#resetBtn');

  // Portada + Intro
  const startOv  = $('#startOverlay'); const startBtn = $('#startBtn');
  const introOv = $('#introOverlay'); const introTextEl = $('#introText'); const introNext = $('#introNext');

  // Robo animado
  const drawOverlay = $('#drawOverlay'); const drawCardEl  = $('#drawCard');

  // Botón ATACAR
  let attackBtn = document.getElementById('attackBtn');

  // ---------- Estado ----------
  const SLOTS = 6;
  const HAND_SIZE = 4;
  const state = {
    round: 1,
    pCoins: 3, eCoins: 3,
    pScore: 10, eScore: 10,
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    center: Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn: 'player',
    playerPassed:false, enemyPassed:false,
    resolving:false,
    drawing:false,
    pAttacked: Array(SLOTS).fill(false),
    targeting:false,
    attackCtx: null,
    timers: { draw:null, toast:null, type:null }
  };

  // ---------- Cartas ----------
  const BASE_CARDS = [
    { name:'Guerrera', art:'assets/Guerrera.PNG',  cost:3, pts:5, text:"Cuando la colocas enfrente de una carta rival, la destruye automáticamente." },
    { name:'Maga',     art:'assets/Maga.PNG',      cost:2, pts:4, text:"Canaliza energías arcanas a tu favor." },
    { name:'Arquero',  art:'assets/Arquero.PNG',   cost:1, pts:3, text:"Dispara con precisión quirúrgica." },
    { name:'Sanadora', art:'assets/Sanadora.PNG',  cost:2, pts:2, text:"Restaura y protege a los tuyos." },
    { name:'Bardo',    art:'assets/Bardo.PNG',     cost:1, pts:2, text:"Inspira y desarma con melodías." }
  ];
  const makeDeck = () => BASE_CARDS.map(c => ({...c, id: uid()})).sort(()=> Math.random()-0.5);

  // ---------- UI y helpers (render de mano, tablero, robo, ataques, etc.) ----------
  // (Mantengo igual que la versión anterior, no lo repito entero para no hacer ruido innecesario,
  // solo la parte de la intro ha cambiado)

  // ---------- Intro Fire Emblem ----------
  const INTRO_TEXT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus.";
  let typingIdx = 0;
  let typingRunning = false;

  function startIntro(){
    if(!introOv) { newGame(); return; }
    introTextEl && (introTextEl.textContent = "");
    introOv.classList.add('visible');
    introOv.setAttribute('aria-hidden','false');

    typingIdx = 0;
    typingRunning = true;

    if (introNext){
      introNext.disabled = false;
      introNext.textContent = 'SALTAR';  // durante escritura
    }

    const speed = 22;
    const run = () => {
      if (typingIdx < INTRO_TEXT.length){
        introTextEl && (introTextEl.textContent = INTRO_TEXT.slice(0, typingIdx+1));
        typingIdx++;
        state.timers.type = setTimeout(run, speed);
      } else {
        typingRunning = false;
        if (introNext) introNext.textContent = 'CONTINUAR';
      }
    };
    run();
  }

  function onIntroNextClick(){
    if(!introOv) return;

    if (typingRunning){
      // Saltar escritura
      clearTimeout(state.timers.type);
      introTextEl && (introTextEl.textContent = INTRO_TEXT);
      typingRunning = false;
      if (introNext) introNext.textContent = 'CONTINUAR';
      return;
    }
    // Continuar al juego
    introOv.classList.remove('visible');
    introOv.setAttribute('aria-hidden','true');
    newGame();
  }

  // ---------- Nueva partida ----------
  function newGame(){
    state.round=1; state.pCoins=3; state.eCoins=3;
    state.pScore=10; state.eScore=10;
    state.center=Array.from({length:SLOTS},()=>({p:null,e:null}));
    state.pDeck = makeDeck(); state.eDeck = makeDeck();
    state.pHand=[]; state.eHand=[];
    state.pAttacked=Array(SLOTS).fill(false);
    renderBoard(); renderHand(); updateHUD();
    topUpEnemyInstant(); topUpPlayerAnimated().then(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      showTurnToast('TU TURNO'); refreshAttackButton();
    });
  }

  // ---------- Eventos / Arranque ----------
  window.addEventListener('DOMContentLoaded', ()=>{
    if(startBtn){
      startBtn.addEventListener('click', ()=>{
        startOv.classList.remove('visible');
        startIntro();
      });
    }else{
      newGame();
    }

    introNext?.addEventListener('click', onIntroNextClick);
    introOv?.addEventListener('click', (e)=>{
      if(!e.target.closest('.intro-panel')) onIntroNextClick();
    });

    againBtn?.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
    resetBtn?.addEventListener('click', ()=> newGame());
    passBtn?.addEventListener('click', ()=>{
      if(state.turn!=='player'||state.resolving||state.targeting) return;
      state.playerPassed=true; state.turn='enemy';
      attackBtn && (attackBtn.style.display='none');
      enemyTurn();
    });
  });
})();