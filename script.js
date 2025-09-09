(() => {
  // ---------- Utils ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const uid = (()=>{ let n=1; return ()=> n++; })();

  // ---------- DOM ----------
  const handEl = $('#hand');
  const roundNoEl = $('#roundNo');
  const pCoinsEl = $('#pCoins'), eCoinsEl = $('#eCoins');
  const pScoreEl = $('#pScore'), eScoreEl = $('#eScore'); // VIDA

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

  // Botón ATACAR dinámico
  const bottomBar = document.querySelector('.bottom-bar');
  let attackBtn = document.getElementById('attackBtn');
  if(!attackBtn && bottomBar){
    attackBtn = document.createElement('button');
    attackBtn.id = 'attackBtn';
    attackBtn.className = 'btn primary';
    attackBtn.textContent = 'ATACAR';
    attackBtn.style.display = 'none';
    bottomBar.insertBefore(attackBtn, passBtn);
  }

  // Inyecta CSS para shake fuerte si no existe
  (function injectShakeCSS(){
    if(document.getElementById('shakeCSS')) return;
    const css = `
      .placed.shake-hard{ animation: shakeHard .48s cubic-bezier(.36,.07,.19,.97) both; }
      @keyframes shakeHard {
        10% { transform: translate(-1px, -2px) rotate(-0.5deg) scale(1.02); filter: brightness(1.1); }
        20% { transform: translate(3px, 0px) rotate(0.6deg) scale(1.03); }
        30% { transform: translate(-5px, 2px) rotate(-0.8deg) }
        40% { transform: translate(4px, -1px) rotate(0.6deg) }
        50% { transform: translate(-3px, 1px) rotate(-0.6deg) }
        60% { transform: translate(3px, 1px) rotate(0.4deg) }
        70% { transform: translate(-2px, -1px) rotate(-0.3deg) }
        80% { transform: translate(1px, 1px) rotate(0.2deg) }
        90% { transform: translate(-1px, 0px) rotate(-0.1deg) }
        100%{ transform: translate(0,0) rotate(0) scale(1); filter: brightness(1); }
      }
      .slot.targetable{
        outline: 2px solid rgba(255,120,120,.9);
        outline-offset: -2px;
        box-shadow: 0 0 0 3px rgba(255,120,120,.25) inset, 0 6px 18px rgba(255,0,0,.25);
        cursor: pointer;
      }
    `;
    const st = document.createElement('style');
    st.id = 'shakeCSS';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // ---------- Estado ----------
  const SLOTS = 6;         // 3 columnas x 2 filas por lado
  const HAND_SIZE = 4;

  const state = {
    round: 1,
    pCoins: 3, eCoins: 3,
    pScore: 10, eScore: 10,       // VIDA inicial 10
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    center: Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn: 'player',
    playerPassed:false, enemyPassed:false,
    resolving:false,
    drawing:false,
    // Ataques por turno
    pAttacked: Array(SLOTS).fill(false),
    eAttacked: Array(SLOTS).fill(false),
    // Targeting/ataque manual
    targeting:false,
    attackCtx: null, // { step, attIndex, targets }
    timers: { draw:null, toast:null, type:null }
  };

  // ---------- Definición de cartas ----------
  const BASE_CARDS = [
    { name:'Guerrera', art:'assets/Guerrera.PNG',  cost:3, pts:5, text:"Cuando la colocas enfrente de una carta rival, la destruye automáticamente." },
    { name:'Maga',     art:'assets/Maga.PNG',      cost:2, pts:4, text:"Canaliza energías arcanas a tu favor." },
    { name:'Arquero',  art:'assets/Arquero.PNG',   cost:1, pts:3, text:"Dispara con precisión quirúrgica." },
    { name:'Sanadora', art:'assets/Sanadora.PNG',  cost:2, pts:2, text:"Restaura y protege a los tuyos." },
    { name:'Bardo',    art:'assets/Bardo.PNG',     cost:1, pts:2, text:"Inspira y desarma con melodías." }
  ];
  const makeDeck = () => BASE_CARDS.map(c=>({...c, id:uid()})).sort(()=> Math.random()-0.5);

  // ---------- Daño y efectos ----------
  function applyDamage(to, amount){
    if(amount<=0) return;
    if(to==='enemy'){ state.eScore = Math.max(0, state.eScore - amount); }
    else { state.pScore = Math.max(0, state.pScore - amount); }
    updateHUD();
    checkDefeat();
  }
  function checkDefeat(){
    if(state.eScore<=0 || state.pScore<=0){
      state.resolving = true;
      let title = state.eScore<=0 ? '¡Victoria!' : 'Derrota';
      endTitle.textContent = title;
      endLine.textContent = `Vida — Tú: ${state.pScore} · Rival: ${state.eScore}`;
      endOverlay.classList.add('visible');
      return true;
    }
    return false;
  }
  const columnOf = idx => idx % 3;
  const indicesSameColumn = (col) => [0,1,2,3,4,5].filter(i => i%3===col);

  // ---------- Ataques IA (enemigo) ----------
  function enemyAttacks(){
    for(let i=0;i<SLOTS;i++){
      if(!state.center[i].e || state.eAttacked[i]) continue;
      const att = state.center[i].e;
      const col = columnOf(i);
      const playerTargets = indicesSameColumn(col).filter(ix=>state.center[ix].p);
      if(playerTargets.length===0){
        applyDamage('player', att.pts);
        state.eAttacked[i]=true;
        continue;
      }
      const defIndex = playerTargets[0];
      const def = state.center[defIndex].p;
      if(!def) continue;
      if(att.pts >= def.pts){
        const diff = att.pts - def.pts;
        state.center[defIndex].p=null;
        renderBoard();
        applyDamage('player', diff);
      }else{
        const rem = def.pts - att.pts;
        state.center[defIndex].p = {...def, pts: rem};
        renderBoard();
      }
      state.eAttacked[i]=true;
    }
  }

  // ---------- IA rival turno completo ----------
  function enemyTurn(){
    state.resolving=true; state.enemyPassed=false; state.eCoins+=1; updateHUD();
    showTurnToast('TURNO RIVAL');
    topUpEnemyInstant();

    const plays=()=> state.eHand.some(c=>c.cost<=state.eCoins);
    const playOnce=()=>{
      if(!plays()) return false;
      let best=-1,score=-1;
      state.eHand.forEach((c,i)=>{ if(c.cost<=state.eCoins){ const s=c.pts*2-c.cost; if(s>score){score=s; best=i;} }});
      const card=state.eHand[best];
      let target=-1;
      for(let i=0;i<SLOTS;i++){ if(!state.center[i].e){ target=i; break; } }
      if(target===-1) return false;
      state.eCoins-=card.cost; state.center[target].e={...card};
      state.eHand.splice(best,1);
      renderBoard(); updateHUD();
      return true;
    };

    const loop=()=>{ if(!playOnce()){ 
      enemyAttacks();
      state.enemyPassed=true;
      setTimeout(()=>{state.resolving=false; checkBothPassedThenNextRound();},400);
      return; }
      setTimeout(loop,220);
    };
    loop();
  }

  // ---------- Rondas ----------
  function nextRound(){
    state.round+=1;
    state.playerPassed=false; state.enemyPassed=false;
    state.turn='player';
    state.pCoins+=1;
    state.pAttacked = Array(SLOTS).fill(false);
    state.eAttacked = Array(SLOTS).fill(false);
    topUpEnemyInstant();
    topUpPlayerAnimated().then(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      setTimeout(()=> showTurnToast('TU TURNO'), 200);
      refreshAttackButton();
    });
  }
  function checkBothPassedThenNextRound(){ if(!checkDefeat() && state.playerPassed && state.enemyPassed) nextRound(); }

  // ---------- Aquí se mantienen las funciones de UI, mano, robo, arrastre, zoom, ataques jugador... ----------
  // (Por brevedad no las repito todas de nuevo, se integran con la parte anterior que ya tenías)

  // ---------- Nueva partida ----------
  function newGame(){
    state.round=1; state.pCoins=3; state.eCoins=3;
    state.pScore=10; state.eScore=10;
    state.center=Array.from({length:SLOTS},()=>({p:null,e:null}));
    state.pDeck = makeDeck(); state.eDeck = makeDeck();
    state.pHand=[]; state.eHand=[];
    state.pAttacked=Array(SLOTS).fill(false);
    state.eAttacked=Array(SLOTS).fill(false);
    renderBoard(); renderHand(); updateHUD();
    topUpEnemyInstant(); topUpPlayerAnimated().then(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      showTurnToast('TU TURNO'); refreshAttackButton();
    });
  }

  // ---------- Eventos ----------
  againBtn?.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  resetBtn?.addEventListener('click', ()=> newGame());
  passBtn?.addEventListener('click', ()=>{
    if(state.turn!=='player'||state.resolving||state.targeting) return;
    state.playerPassed=true; state.turn='enemy';
    attackBtn && (attackBtn.style.display='none');
    state.attackCtx=null; state.targeting=false;
    enemyTurn();
  });

  window.addEventListener('DOMContentLoaded', ()=>{
    if(startBtn){
      startBtn.addEventListener('click', ()=>{
        startOv.classList.remove('visible');
        newGame();
      });
    }else newGame();
  });
})();