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
  const LANES = 3;
  const HAND_SIZE = 5;
  const TARGET_SCORE = 30; // fin opcional

  const state = {
    round: 1,
    pCoins: 3, eCoins: 3,           // empiezas con 3
    pScore: 0, eScore: 0,
    pDeck: [], eDeck: [],
    pHand: [], eHand: [],
    lanes: Array.from({length: LANES}, () => ({ p:null, e:null })), // {cost, pts, name, art}
    turn: 'player', // 'player' | 'enemy'
    playerPassed: false,
    enemyPassed: false,
    resolving: false
  };

  // ---------- Cards ----------
  const SPIDEY = { name:'Spiderman', cost:3, pts:6, art:'assets/Spiderman.png' };

  function makeRandomCard(){
    const cost = rand(1,4);
    const pts  = rand(cost+1, cost+5); // puntos algo mayores que el coste
    return { name:'', cost, pts, art:'' };
  }
  function makeDeckRandom(n=24){
    const d=[]; for(let i=0;i<n;i++) d.push(makeRandomCard());
    for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
    return d;
  }
  function drawToHand(){
    while(state.pHand.length<HAND_SIZE && state.pDeck.length) state.pHand.push(state.pDeck.pop());
    while(state.eHand.length<HAND_SIZE && state.eDeck.length) state.eHand.push(state.eDeck.pop());
  }

  // ---------- UI ----------
  const badgeCost = v => `<div class="badge b-cost">${v}</div>`;
  const badgePts  = v => `<div class="badge b-pts">${v}</div>`;
  const artHTML = src => `<div class="art">${src?`<img src="${src}" alt="">`:''}</div>`;

  function createHandCardEl(card, index){
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.index = String(index);
    el.dataset.cost = String(card.cost);
    el.dataset.pts  = String(card.pts);
    el.dataset.name = card.name || '';
    el.dataset.art  = card.art  || '';
    el.innerHTML = `
      ${artHTML(el.dataset.art)}
      ${badgeCost(card.cost)} ${badgePts(card.pts)}
      <div class="label">${card.name || 'Carta'}</div>
    `;
    // Zoom al tocar
    el.addEventListener('click', ()=> openZoom({name:el.dataset.name||'Carta', cost:+el.dataset.cost, pts:+el.dataset.pts, art:el.dataset.art||''}));
    // Drag
    attachDragHandlers(el);
    return el;
  }

  function renderHand(){
    handEl.innerHTML = '';
    state.pHand.forEach((c,i)=> handEl.appendChild(createHandCardEl(c,i)));
    handEl.style.visibility = 'visible';
    handEl.scrollTo({left:0, behavior:'instant'});
  }

  function renderBoard(){
    for(let i=0;i<LANES;i++){
      const ps = slotsPlayer[i], es = slotsEnemy[i];
      ps.innerHTML = ''; es.innerHTML = ''; // limpieza
      const p = state.lanes[i].p, e = state.lanes[i].e;

      if(p){
        const div = document.createElement('div');
        div.className = 'placed';
        div.innerHTML = `${artHTML(p.art)} ${badgeCost(p.cost)} ${badgePts(p.pts)} <div class="name">${p.name||''}</div>`;
        ps.appendChild(div);
      }
      if(e){
        const div = document.createElement('div');
        div.className = 'placed enemy';
        div.innerHTML = `${artHTML(e.art)} ${badgeCost(e.cost)} ${badgePts(e.pts)} <div class="name">${e.name||''}</div>`;
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

  function toast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toasts.appendChild(t);
    setTimeout(()=> t.remove(), 1500);
  }

  function setBanner(text){ phaseBanner.textContent = text; }
  function highlightPlayerSlots(on){ $$('.slot[data-side="player"]').forEach(s=>s.classList.toggle('highlight', !!on)); }

  // ---------- Zoom (números sin iconos también) ----------
  function openZoom(card){
    zoomWrap.innerHTML = `
      <div class="zoom-card">
        <div class="art">${card.art?`<img src="${card.art}" alt="${card.name}">`:''}</div>
        <div class="zoom-badge cost">${card.cost}</div>
        <div class="zoom-badge pts">${card.pts}</div>
        <div class="name">${card.name||'Carta'}</div>
      </div>
      <p class="zoom-text">Arrastra desde la mano para jugarla. Tocar solo abre esta vista.</p>
    `;
    zoomOverlay.classList.add('visible');
  }
  function closeZoom(){ zoomOverlay.classList.remove('visible'); }
  closeZoomBtn.addEventListener('click', closeZoom);
  zoomOverlay.addEventListener('click', e=>{ if(!e.target.closest('.zoom-panel')) closeZoom(); });

  // ---------- Drag ----------
  let ghost=null, dragging=null;
  function attachDragHandlers(cardEl){ cardEl.addEventListener('pointerdown', onDown, {passive:false}); }
  function onDown(e){
    if(state.turn!=='player' || state.resolving) return;
    const el = e.currentTarget; dragging = el;
    el.setPointerCapture(e.pointerId);

    // ghost con arte (sin deformar)
    ghost = document.createElement('div');
    ghost.className='ghost';
    ghost.innerHTML = `
      ${artHTML(el.dataset.art)}
      ${badgeCost(el.dataset.cost)} ${badgePts(el.dataset.pts)}
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
        tryPlayFromHandToLane(i, targetLane);
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
    for(let i=0;i<LANES;i++){
      const r = slotsPlayer[i].getBoundingClientRect();
      if(x>=r.left && x<=r.right && y>=r.top && y<=r.bottom) return i;
    }
    return -1;
  }

  // ---------- Rules: play (sin destrucción por choque) ----------
  const canAfford = (card) => state.pCoins >= card.cost;

  function tryPlayFromHandToLane(handIndex, laneIndex){
    if(handIndex<0 || handIndex>=state.pHand.length) return;
    const card = state.pHand[handIndex];
    if(!canAfford(card)){ toast('No tienes monedas suficientes'); return; }

    // paga coste
    state.pCoins -= card.cost; updateHUD();

    // NO destruimos al rival: solo colocas/reemplazas tu propia carta
    state.lanes[laneIndex].p = {...card};

    // quitar de la mano + robar 1 si hay
    state.pHand.splice(handIndex,1);
    if(state.pDeck.length) state.pHand.push(state.pDeck.pop());

    renderHand(); renderBoard(); updateHUD();
  }

  // ---------- Enemy AI (sin destrucción por choque) ----------
  function enemyTurn(){
    state.resolving = true;
    state.enemyPassed = false;

    // +1 moneda al empezar SU turno
    state.eCoins += 1; updateHUD();

    const playable = () => state.eHand.some(c => c.cost <= state.eCoins);

    const tryPlayOnce = ()=>{
      if(!playable()) return false;
      // mejor carta asequible (puntos altos / coste)
      let bestIdx=-1, bestScore=-1;
      state.eHand.forEach((c,i)=>{
        if(c.cost<=state.eCoins){
          const sc=c.pts*2 - c.cost;
          if(sc>bestScore){bestScore=sc; bestIdx=i;}
        }
      });
      const card = state.eHand[bestIdx];

      // carril preferido: hueco propio, si no, reemplazar si mejora
      let laneChoice = 0, laneScore=-1;
      for(let i=0;i<LANES;i++){
        const E = state.lanes[i].e;
        let sc = 0;
        if(!E) sc = 100; else sc = Math.max(0, card.pts - E.pts); // reemplaza si mejora
        if(sc>laneScore){ laneScore=sc; laneChoice=i; }
      }

      // pagar y jugar
      state.eCoins -= card.cost;
      state.lanes[laneChoice].e = {...card};

      state.eHand.splice(bestIdx,1);
      if(state.eDeck.length) state.eHand.push(state.eDeck.pop());

      renderBoard(); updateHUD();
      return true;
    };

    const loop = ()=>{
      if(!tryPlayOnce()){
        state.enemyPassed = true;
        // Pausa clara para “ver qué jugó” antes de puntuar
        setTimeout(endEnemyPhase, 600);
        return;
      }
      setTimeout(loop, 300);
    };
    loop();
  }

  function endEnemyPhase(){
    state.resolving = false;
    checkBothPassedThenScore();
  }

  // ---------- Turn flow / scoring ----------
  const bothHavePassed = () => state.playerPassed && state.enemyPassed;

  function floatScore(label, who){
    const div = document.createElement('div');
    div.className = `score-float ${who}`;
    div.textContent = label;
    $('.board').appendChild(div);
    setTimeout(()=> div.remove(), 1200);
  }

  function animateVanishBoard(){
    $$('.placed').forEach(el => el.classList.add('vanish'));
    return new Promise(res => setTimeout(res, 750));
  }

  function scoreRoundAndCleanup(){
    // sumar puntos de cartas que siguen
    let pRound=0, eRound=0;
    state.lanes.forEach(l=>{
      if(l.p) pRound += l.p.pts;
      if(l.e) eRound += l.e.pts;
    });

    // Floats vistosos
    if(pRound>0) floatScore(`+${pRound}`, 'you');
    if(eRound>0) floatScore(`+${eRound}`, 'enemy');

    // Pausa para leer +puntos
    setTimeout(async ()=>{
      await animateVanishBoard();

      state.pScore += pRound; state.eScore += eRound;

      // limpiar tablero
      state.lanes = Array.from({length: LANES}, () => ({ p:null, e:null }));

      // comprobar fin
      if(state.pScore >= TARGET_SCORE || state.eScore >= TARGET_SCORE){
        endTitle.textContent = state.pScore>=TARGET_SCORE ? '¡Victoria!' : 'Derrota';
        endLine.textContent = `Puntos: Tú ${state.pScore} · 🤖 ${state.eScore}`;
        endOverlay.classList.add('visible');
        renderBoard(); updateHUD(); return;
      }

      // nueva ronda → jugador empieza y gana +1 moneda por comenzar SU turno
      state.round += 1;
      state.playerPassed = false; state.enemyPassed = false;
      state.turn = 'player';
      state.pCoins += 1;                 // +1 por turno del jugador

      // robar hasta 5
      while(state.pHand.length<HAND_SIZE && state.pDeck.length) state.pHand.push(state.pDeck.pop());
      while(state.eHand.length<HAND_SIZE && state.eDeck.length) state.eHand.push(state.eDeck.pop());

      renderBoard(); renderHand(); updateHUD();
      setBanner('Nueva ronda: arrastra cartas mientras tengas monedas');
    }, 400);
  }

  function checkBothPassedThenScore(){
    if(!bothHavePassed()) return;
    scoreRoundAndCleanup();
  }

  // ---------- New game ----------
  function newGame(){
    state.round=1;
    state.pCoins=3; state.eCoins=3;
    state.pScore=0; state.eScore=0;
    state.playerPassed=false; state.enemyPassed=false; state.turn='player';
    state.lanes = Array.from({length: LANES}, () => ({ p:null, e:null }));

    // mazos y manos (Spiderman garantizado en tu mano)
    state.pDeck = makeDeckRandom(28);
    state.pHand = [{...SPIDEY}]; drawToHand();

    state.eDeck = makeDeckRandom(28);
    state.eHand = []; drawToHand();

    // Al comenzar tu primer turno: +1 moneda
    state.pCoins += 1;

    renderBoard(); renderHand(); updateHUD();
    setBanner('Arrastra cartas mientras tengas monedas');
  }

  // ---------- Events ----------
  $('#startBtn').addEventListener('click', ()=>{ startOverlay.classList.remove('visible'); newGame(); });
  $('#againBtn').addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  $('#menuBtn').addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); startOverlay.classList.add('visible'); });
  $('#resetBtn').addEventListener('click', ()=> newGame());

  passBtn.addEventListener('click', ()=>{
    if(state.turn!=='player' || state.resolving) return;
    state.playerPassed = true;
    // turno rival
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