(() => {
  // ---------- Helpers ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;

  // ---------- Elements ----------
  const handEl = $('#hand');
  const slotsPlayer = $$('.slot[data-side="player"]');
  const slotsEnemy  = $$('.slot[data-side="enemy"]');

  const roundNoEl = $('#roundNo');
  const pCoinsEl = $('#pCoins'), eCoinsEl = $('#eCoins');
  const pScoreEl = $('#pScore'), eScoreEl = $('#eScore');
  const phaseBanner = $('#phaseBanner');
  const passBtn = $('#passBtn');

  const startOverlay = $('#startOverlay');
  const endOverlay = $('#endOverlay'); const endTitle = $('#endTitle'); const endLine = $('#endLine');
  const toasts = $('#toasts');

  const zoomOverlay = $('#zoomOverlay'); const zoomWrap = $('#zoomCardWrap'); const closeZoomBtn = $('#closeZoomBtn');

  // ---------- State ----------
  const SLOTS = 6;          // 6 huecos por lado
  const HAND_SIZE = 5;
  const TARGET_SCORE = 30;   // fin opcional

  const state = {
    round: 1,
    pCoins: 3, eCoins: 3,     // empiezas con 3
    pScore: 0, eScore: 0,
    pDeck: [], eDeck: [],
    pHand: [], eHand: [],
    center: Array.from({length: SLOTS}, () => ({ p:null, e:null })), // columnas [0..5]
    turn: 'player', // 'player' | 'enemy'
    playerPassed: false,
    enemyPassed: false,
    resolving: false
  };

  // ---------- Cards ----------
  const SPIDEY = { name:'Spiderman', cost:3, pts:6, art:'assets/Spiderman.png' };

  function makeRandomCard(){
    const cost = rand(1,4);
    const pts  = rand(cost+1, cost+5);
    return { name:'', cost, pts, art:'' };
  }
  function makeDeckRandom(n=30){
    const d=[]; for(let i=0;i<n;i++) d.push(makeRandomCard());
    for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
    return d;
  }
  function drawToHand(){
    while(state.pHand.length<HAND_SIZE && state.pDeck.length) state.pHand.push(state.pDeck.pop());
    while(state.eHand.length<HAND_SIZE && state.eDeck.length) state.eHand.push(state.eDeck.pop());
  }

  // ---------- UI helpers ----------
  const tokenCost = v => `<div class="token t-cost">${v}</div>`;
  const tokenPts  = v => `<div class="token t-pts">${v}</div>`;
  const artHTML = src => `<div class="art">${src?`<img src="${src}" alt="">`:''}</div>`;

  // ===== ZOOM =====
  function openZoom(card){
    zoomWrap.innerHTML = `
      <div class="zoom-card">
        <div class="art">${card.art?`<img src="${card.art}" alt="${card.name}">`:''}</div>
        <div class="zoom-token cost">${card.cost}</div>
        <div class="zoom-token pts">${card.pts}</div>
        <div class="name">${card.name||'Carta'}</div>
      </div>
      <p class="muted">Arrastra desde la mano para jugarla. Tocar solo abre esta vista.</p>
    `;
    zoomOverlay.classList.add('visible');
  }
  function closeZoom(){ zoomOverlay.classList.remove('visible'); }
  $('#closeZoomBtn').addEventListener('click', closeZoom);
  $('#zoomOverlay').addEventListener('click', e=>{ if(!e.target.closest('.zoom-panel')) closeZoom(); });

  // ===== Hand (abanico dinámico, ajustado al ancho visible) =====
  function createHandCardEl(card, index, total){
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.index = String(index);
    el.dataset.cost = String(card.cost);
    el.dataset.pts  = String(card.pts);
    el.dataset.name = card.name || '';
    el.dataset.art  = card.art  || '';

    el.innerHTML = `
      ${artHTML(el.dataset.art)}
      ${tokenCost(card.cost)} ${tokenPts(card.pts)}
      <div class="label">${card.name || 'Carta'}</div>
    `;

    // Posición en abanico: distribuimos entre márgenes 10%..90% (para que NUNCA se salga)
    const margin = 10; // %
    let leftPct;
    if (total === 1) leftPct = 50;
    else leftPct = margin + (index)*( (100 - margin*2) / (total-1) );

    const mid = (total - 1) / 2;
    const angle = (index - mid) * 8; // grados

    // Pasamos a variables CSS para hover consistente
    el.style.setProperty('--x', `calc(${leftPct}% - 50%)`);
    el.style.setProperty('--rot', `${angle}deg`);

    // Zoom al tocar
    el.addEventListener('click', ()=> openZoom({name:el.dataset.name||'Carta', cost:+el.dataset.cost, pts:+el.dataset.pts, art:el.dataset.art||''}));

    // Drag
    attachDragHandlers(el);
    return el;
  }

  function renderHand(){
    handEl.innerHTML = '';
    const n = state.pHand.length;
    state.pHand.forEach((c,i)=> handEl.appendChild(createHandCardEl(c,i,n)));
  }

  // ===== Board =====
  function renderBoard(){
    for(let i=0;i<SLOTS;i++){
      const ps = slotsPlayer[i], es = slotsEnemy[i];
      ps.innerHTML = ''; es.innerHTML = '';
      const p = state.center[i].p, e = state.center[i].e;

      if(p){
        const div = document.createElement('div');
        div.className = 'placed';
        div.innerHTML = `${artHTML(p.art)} ${tokenCost(p.cost)} ${tokenPts(p.pts)} <div class="name">${p.name||''}</div>`;
        ps.appendChild(div);
      }
      if(e){
        const div = document.createElement('div');
        div.className = 'placed enemy';
        div.innerHTML = `${artHTML(e.art)} ${tokenCost(e.cost)} ${tokenPts(e.pts)} <div class="name">${e.name||''}</div>`;
        es.appendChild(div);
      }
    }
  }

  function updateHUD(){
    roundNoEl.textContent = state.round;
    pCoinsEl.textContent = state.pCoins;
    eCoinsEl.textContent = state.eCoins;
    pScoreEl.textContent = state.pScore;
    eScoreEl.textContent = state.eScore;
  }

  function setBanner(text){ phaseBanner.textContent = text; }
  function toast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toasts.appendChild(t);
    setTimeout(()=> t.remove(), 1500);
  }

  function highlightPlayerSlots(on){ $$('.slot[data-side="player"]').forEach(s=>s.classList.toggle('highlight', !!on)); }

  // ===== Drag & Drop =====
  let ghost=null, dragging=null;
  function attachDragHandlers(cardEl){ cardEl.addEventListener('pointerdown', onDown, {passive:false}); }
  function onDown(e){
    if(state.turn!=='player' || state.resolving) return;
    const el = e.currentTarget; dragging = el;
    el.setPointerCapture(e.pointerId);

    // ghost
    ghost = document.createElement('div');
    ghost.className='ghost';
    ghost.innerHTML = `
      ${artHTML(el.dataset.art)}
      ${tokenCost(el.dataset.cost)} ${tokenPts(el.dataset.pts)}
      <div class="label">${el.dataset.name||'Carta'}</div>
    `;
    document.body.appendChild(ghost);
    moveGhost(e.clientX,e.clientY);
    highlightPlayerSlots(true);
    closeZoom();

    const move = ev=> moveGhost(ev.clientX, ev.clientY);
    const up = ev=>{
      el.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up, true);

      const targetLane = laneIndexUnderPointer(ev.clientX, ev.clientY);
      highlightPlayerSlots(false);

      if(targetLane !== -1){
        const i = parseInt(el.dataset.index,10);
        tryPlayFromHandToSlot(i, targetLane);
      }
      removeGhost();
      dragging=null;
    };
    window.addEventListener('pointermove', move, {passive:false});
    window.addEventListener('pointerup', up, {passive:false, capture:true});
    e.preventDefault();
  }
  function moveGhost(x,y){ if(!ghost) return; ghost.style.left=x+'px'; ghost.style.top=y+'px'; }
  function removeGhost(){ ghost?.remove(); ghost=null; }
  function laneIndexUnderPointer(x,y){
    for(let i=0;i<SLOTS;i++){
      const r = slotsPlayer[i].getBoundingClientRect();
      if(x>=r.left && x<=r.right && y>=r.top && y<=r.bottom) return i;
    }
    return -1;
  }

  // ===== Reglas de colocación (persistentes) =====
  const canAfford = (card) => state.pCoins >= card.cost;
  const playerOccupancy = () => state.center.filter(c => !!c.p).length;
  const enemyOccupancy  = () => state.center.filter(c => !!c.e).length;

  function tryPlayFromHandToSlot(handIndex, slotIndex){
    if(handIndex<0 || handIndex>=state.pHand.length) return;
    const card = state.pHand[handIndex];
    if(!canAfford(card)){ toast('No tienes monedas suficientes'); return; }

    const slot = state.center[slotIndex];
    if(!slot.p && playerOccupancy() >= SLOTS){
      toast('Ya tienes 6 cartas en juego'); return;
    }

    // paga coste
    state.pCoins -= card.cost;

    // colocas/reemplazas tu carta; NO afecta a la del rival
    state.center[slotIndex].p = {...card};

    // quitar de la mano + robar 1 si hay
    state.pHand.splice(handIndex,1);
    if(state.pDeck.length) state.pHand.push(state.pDeck.pop());

    renderHand(); renderBoard(); updateHUD();
  }

  // ===== IA Rival =====
  function enemyTurn(){
    state.resolving = true;
    state.enemyPassed = false;

    // +1 moneda al empezar SU turno
    state.eCoins += 1; updateHUD();

    const canPlay = () => state.eHand.some(c => c.cost <= state.eCoins) &&
                          enemyOccupancy() < SLOTS;

    const tryPlayOnce = ()=>{
      if(!canPlay()) return false;

      // mejor carta asequible (puntos/coste)
      let bestIdx=-1, bestScore=-1;
      state.eHand.forEach((c,i)=>{
        if(c.cost<=state.eCoins){
          const sc=c.pts*2 - c.cost;
          if(sc>bestScore){bestScore=sc; bestIdx=i;}
        }
      });
      const card = state.eHand[bestIdx];

      // elegir slot: vacío si hay; si lleno (6), reemplaza el peor propio si mejora
      let target = -1, worstIdx=-1, worstPts=Infinity;
      for(let i=0;i<SLOTS;i++){
        if(!state.center[i].e){ target=i; break; }
      }
      if(target===-1){
        for(let i=0;i<SLOTS;i++){
          const e = state.center[i].e;
          if(e && e.pts < worstPts){ worstPts=e.pts; worstIdx=i; }
        }
        if(card.pts > worstPts) target=worstIdx; else return false;
      }

      // pagar y jugar
      state.eCoins -= card.cost;
      state.center[target].e = {...card};

      state.eHand.splice(bestIdx,1);
      if(state.eDeck.length) state.eHand.push(state.eDeck.pop());

      renderBoard(); updateHUD();
      return true;
    };

    const loop = ()=>{
      if(!tryPlayOnce()){
        state.enemyPassed = true;
        setTimeout(endEnemyPhase, 700); // pausa visible
        return;
      }
      setTimeout(loop, 300);
    };
    loop();
  }
  function endEnemyPhase(){ state.resolving = false; checkBothPassedThenScore(); }

  // ===== Puntuación (cartas persisten) =====
  const bothHavePassed = () => state.playerPassed && state.enemyPassed;

  function floatScore(label, who){
    const div = document.createElement('div');
    div.className = `score-float ${who}`;
    div.textContent = label;
    document.querySelector('.board').appendChild(div);
    setTimeout(()=> div.remove(), 1200);
  }

  function scoreTurn(){
    let pTurn=0, eTurn=0;
    state.center.forEach(c=>{
      if(c.p) pTurn += c.p.pts;
      if(c.e) eTurn += c.e.pts;
    });

    if(pTurn>0) floatScore(`+${pTurn}`, 'you');
    if(eTurn>0) floatScore(`+${eTurn}`, 'enemy');

    setTimeout(()=>{
      state.pScore += pTurn; state.eScore += eTurn;
      updateHUD();

      // siguiente ronda → empieza el jugador (+1 moneda)
      state.round += 1;
      state.playerPassed = false; state.enemyPassed = false;
      state.turn = 'player';
      state.pCoins += 1;

      // robar hasta 5
      while(state.pHand.length<HAND_SIZE && state.pDeck.length) state.pHand.push(state.pDeck.pop());
      while(state.eHand.length<HAND_SIZE && state.eDeck.length) state.eHand.push(state.eDeck.pop());

      setBanner('Nueva ronda: juega cartas mientras tengas monedas');

      if(state.pScore >= TARGET_SCORE || state.eScore >= TARGET_SCORE){
        endTitle.textContent = state.pScore>=TARGET_SCORE ? '¡Victoria!' : 'Derrota';
        endLine.textContent = `Puntos: Tú ${state.pScore} · 🤖 ${state.eScore}`;
        endOverlay.classList.add('visible');
      }
    }, 450);
  }
  function checkBothPassedThenScore(){ if(bothHavePassed()) scoreTurn(); }

  // ===== New game =====
  function newGame(){
    state.round=1;
    state.pCoins=3; state.eCoins=3;
    state.pScore=0; state.eScore=0;
    state.playerPassed=false; state.enemyPassed=false; state.turn='player';
    state.center = Array.from({length: SLOTS}, () => ({ p:null, e:null }));

    // mazos y manos (Spiderman garantizado en tu mano)
    state.pDeck = makeDeckRandom(30);
    state.pHand = [{ name:'Spiderman', cost:3, pts:6, art:'assets/Spiderman.png' }];
    drawToHand();

    state.eDeck = makeDeckRandom(30);
    state.eHand = []; drawToHand();

    // Al comenzar tu primer turno: +1 moneda
    state.pCoins += 1;

    renderBoard(); renderHand(); updateHUD();
    setBanner('Arrastra cartas a tus huecos (máx. 6)');
  }

  // ===== Events =====
  $('#startBtn')?.addEventListener('click', ()=>{ startOverlay.classList.remove('visible'); newGame(); });
  $('#againBtn')?.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  $('#menuBtn')?.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); startOverlay.classList.add('visible'); });
  $('#resetBtn').addEventListener('click', ()=> newGame());

  passBtn.addEventListener('click', ()=>{
    if(state.turn!=='player' || state.resolving) return;
    state.playerPassed = true;
    state.turn = 'enemy';
    setBanner('Turno rival…');
    enemyTurn();
  });

  // bloquear clicks fuera de paneles cuando overlay
  const gate = (e)=>{
    const anyVisible = startOverlay.classList.contains('visible') || endOverlay.classList.contains('visible') || zoomOverlay.classList.contains('visible');
    if(!anyVisible) return;
    if(e.target.closest('.overlay .panel, .zoom-panel')) return;
    e.stopPropagation(); e.preventDefault();
  };
  document.addEventListener('pointerdown', gate, {capture:true});
  document.addEventListener('click', gate, {capture:true});
})();