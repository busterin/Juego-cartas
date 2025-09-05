(() => {
  // ---------- Helpers ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;

  // ---------- Elements ----------
  const handEl = $('#hand');
  const slotsPlayer = $$('.slot[data-side="player"]');
  const slotsEnemy  = $$('.slot[data-side="enemy"]');

  const pHPEl = $('#pHP'), eHPEl = $('#eHP'), whoAtkEl = $('#whoAtk');
  const youTag = $('#youTag'), botTag = $('#botTag');

  const startOverlay = $('#startOverlay');
  const endOverlay = $('#endOverlay'); const endTitle = $('#endTitle'); const endLine = $('#endLine');
  const toasts = $('#toasts');

  const phaseBanner = $('#phaseBanner');
  const actionBar = $('#actionBar');
  const actionMsg = $('#actionMsg');
  const passBtn = $('#passBtn');
  const faceBtn = $('#faceBtn');

  // ZOOM overlay
  const zoomOverlay = $('#zoomOverlay');
  const zoomWrap = $('#zoomCardWrap');
  const closeZoomBtn = $('#closeZoomBtn');

  // ---------- State ----------
  const START_HP = 10;
  const LANES = 3;

  const state = {
    pHP: START_HP, eHP: START_HP,
    attacker: 'player',     // 'player' | 'enemy'
    resolving: false,
    phase: 'placing',       // 'placing' | 'action'
    lanes: Array.from({length: LANES}, () => ({ p: null, e: null })), // {hp, pw, name, art}
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    selectedAttackerLane: null
  };

  // ---------- Card model / decks ----------
  function makeRandomCard(){
    const hp = rand(2,7);
    const pw = rand(1,6);
    return { name:'', hp, pw, art:'' };
  }
  function makeDeckRandom(n=18){
    const d=[];
    for(let i=0;i<n;i++) d.push(makeRandomCard());
    for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
    return d;
  }

  // Always show Spiderman in opening hand
  const SPIDEY = { name:'Spiderman', hp:5, pw:6, art:'assets/Spiderman.png' };

  function drawToHand(){
    while(state.pHand.length<5 && state.pDeck.length) state.pHand.push(state.pDeck.pop());
    while(state.eHand.length<5 && state.eDeck.length) state.eHand.push(state.eDeck.pop());
  }

  // ---------- UI ----------
  const badgeHP = v => `<div class="badge b-hp" title="Vida">❤️<span>${v}</span></div>`;
  const badgePW = v => `<div class="badge b-pw" title="Fuerza">⚔️<span>${v}</span></div>`;

  function createCardEl(card, index){
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.index = String(index);
    el.dataset.hp = String(card.hp);
    el.dataset.pw = String(card.pw);
    el.dataset.name = card.name || '';
    el.dataset.art = card.art || '';
    el.innerHTML = `${badgeHP(card.hp)} ${badgePW(card.pw)} <div class="big">${card.hp}/${card.pw}</div><div class="label">${card.name ? card.name : 'Toca para ver / Arrastra para jugar'}</div>`;

    // Tap para abrir ZOOM (siempre con un toque)
    el.addEventListener('click', ()=>{
      openZoom({
        name: el.dataset.name || 'Carta',
        hp: parseInt(el.dataset.hp,10),
        pw: parseInt(el.dataset.pw,10),
        art: el.dataset.art || ''
      });
    });

    attachDragHandlers(el);
    return el;
  }

  function renderHand(){
    handEl.innerHTML = '';
    state.pHand.forEach((c,i)=> handEl.appendChild(createCardEl(c,i)));
  }

  function renderBoard(){
    for(let i=0;i<LANES;i++){
      const ps = slotsPlayer[i], es = slotsEnemy[i];
      ps.innerHTML = ''; es.innerHTML = ''; // evita superposiciones
      const p = state.lanes[i].p, e = state.lanes[i].e;

      if(p){
        const el = document.createElement('div');
        el.className = 'placed';
        if(state.phase==='action' && state.attacker==='player' && state.selectedAttackerLane===i) el.classList.add('attacker');
        el.innerHTML = `${badgeHP(p.hp)} ${badgePW(p.pw)} <div class="big">${p.hp}/${p.pw}</div>`;
        ps.appendChild(el);

        // Selección/deselección por toque en tu turno de acción
        if(state.phase==='action' && state.attacker==='player'){
          el.addEventListener('click', () => toggleSelectAttacker(i));
        }
      }
      if(e){
        const el = document.createElement('div');
        el.className = 'placed enemy';
        el.innerHTML = `${badgeHP(e.hp)} ${badgePW(e.pw)} <div class="big">${e.hp}/${e.pw}</div>`;
        es.appendChild(el);
      }
    }
  }

  function updateHP(){
    pHPEl.textContent = state.pHP;
    eHPEl.textContent = state.eHP;
  }
  function updateAttackerUI(){
    whoAtkEl.textContent = state.attacker === 'player' ? 'Tú' : '🤖';
    youTag.classList.toggle('you', state.attacker==='player');
    botTag.classList.toggle('bot', state.attacker==='enemy');
    youTag.textContent = 'TÚ TURNO';
    botTag.textContent = 'TURNO RIVAL';
  }
  function setBanner(text){ phaseBanner.textContent = text; }

  function toast(msg, color=''){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    if(color) t.style.borderColor = color;
    toasts.appendChild(t);
    setTimeout(()=> t.remove(), 1600);
  }

  function highlightPlayerSlots(on){
    slotsPlayer.forEach(s => s.classList.toggle('highlight', !!on));
  }
  function highlightEnemyTargets(on){
    for(let i=0;i<LANES;i++){
      const es = slotsEnemy[i];
      const hasEnemy = !!state.lanes[i].e;
      es.classList.toggle('targetable', !!on && hasEnemy);
      es.onclick = null; // limpia handlers antiguos
      if(on && hasEnemy && state.attacker==='player' && state.selectedAttackerLane!==null){
        es.onclick = () => resolveAttack(state.selectedAttackerLane, i);
      }
    }
  }

  // ---------- ZOOM ----------
  function openZoom(card){
    zoomWrap.innerHTML = `
      <div class="zoom-card">
        <div class="zoom-badge hp">❤️ ${card.hp}</div>
        <div class="zoom-badge pw">⚔️ ${card.pw}</div>
        <div class="art">${card.art ? `<img src="${card.art}" alt="${card.name}">` : ''}</div>
        <div class="name">${card.name || 'Carta'}</div>
      </div>
      <p class="zoom-text">Arrastra desde la mano para jugarla. Tocar solo abre esta vista.</p>
    `;
    zoomOverlay.classList.add('visible');
  }
  function closeZoom(){ zoomOverlay.classList.remove('visible'); }
  closeZoomBtn.addEventListener('click', closeZoom);
  zoomOverlay.addEventListener('click', (e)=>{ if(!e.target.closest('.zoom-panel')) closeZoom(); });

  // ---------- Drag & drop (con reemplazo) ----------
  let ghost=null, dragging=null, startRect=null;

  function attachDragHandlers(cardEl){
    cardEl.addEventListener('pointerdown', onDown, {passive:false});
  }
  function onDown(e){
    if(state.resolving || state.phase!=='placing') return;
    const el = e.currentTarget; dragging = el;
    el.setPointerCapture(e.pointerId);
    startRect = el.getBoundingClientRect();
    ghost = document.createElement('div');
    ghost.className='ghost';
    ghost.innerHTML = `${badgeHP(el.dataset.hp)} ${badgePW(el.dataset.pw)} <div class="big">${el.dataset.hp}/${el.dataset.pw}</div>`;
    document.body.appendChild(ghost);
    moveGhost(e.clientX,e.clientY);
    highlightPlayerSlots(true);
    closeZoom(); // por si estaba abierto

    const move = ev=> moveGhost(ev.clientX, ev.clientY);
    const up = ev=>{
      el.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up, true);

      const targetLane = laneIndexUnderPointer(ev.clientX, ev.clientY);
      highlightPlayerSlots(false);

      if(targetLane !== -1){
        const c=centerOf(slotsPlayer[targetLane]);
        ghost.style.left=c.x+'px'; ghost.style.top=c.y+'px';
        setTimeout(()=>{
          playFromHandToLane(parseInt(el.dataset.index,10), targetLane);
          removeGhost();
        }, 90);
      } else {
        ghost.style.left=(startRect.left+startRect.width/2)+'px';
        ghost.style.top =(startRect.top +startRect.height/2)+'px';
        setTimeout(removeGhost, 90);
      }
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
      const over = (x>=r.left && x<=r.right && y>=r.top && y<=r.bottom);
      if(over) return i;
    }
    return -1;
  }
  function centerOf(el){ const r=el.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }

  // ---------- Helpers de board ----------
  const anyCards = (side) => state.lanes.some(l => !!l[side]);
  const defenderHasNoCards = (defSide) => !anyCards(defSide);

  // ---------- Colocar / turno ----------
  function playFromHandToLane(handIndex, laneIndex){
    if(state.resolving || state.phase!=='placing') return;
    if(handIndex<0 || handIndex>=state.pHand.length) return;

    state.resolving = true;

    // Player places (con reemplazo)
    const pCard = state.pHand.splice(handIndex,1)[0];
    state.lanes[laneIndex].p = { ...pCard };
    renderHand(); renderBoard();

    // Enemy places (con reemplazo también)
    setTimeout(()=>{
      enemyPlaceCard();
      renderBoard();

      // Entrar en fase de acción (sin auto-ataque)
      enterActionPhase();
      state.resolving = false;
    }, 280);
  }

  function enemyPlaceCard(){
    if(!state.eHand.length) return;
    const laneChoice = rand(0,2); // con reemplazo: cualquiera

    // Elegir carta: si atacará, prioriza ⚔; si defenderá, prioriza ❤️
    let chosenIdx = 0, bestScore = -1;
    if(state.attacker==='enemy'){
      state.eHand.forEach((c,idx)=>{ const sc=c.pw*2 + c.hp; if(sc>bestScore){bestScore=sc; chosenIdx=idx;} });
    } else {
      state.eHand.forEach((c,idx)=>{ const sc=c.hp*2 + c.pw; if(sc>bestScore){bestScore=sc; chosenIdx=idx;} });
    }
    const eCard = state.eHand.splice(chosenIdx,1)[0];
    state.lanes[laneChoice].e = { ...eCard };
  }

  // ---------- Fase de acción ----------
  function enterActionPhase(){
    state.phase = 'action';
    state.selectedAttackerLane = null;
    setBanner(state.attacker==='player' ? 'Elige atacante y objetivo' : 'El rival decidirá su ataque');
    updateAttackerUI();
    renderBoard();

    if(state.attacker==='player'){
      actionBar.classList.remove('hidden');
      actionMsg.textContent = 'Toca una de tus cartas para atacar o pulsa Pasar';
      updateFaceButton();
      passBtn.onclick = () => { endActionPhase(); };
    } else {
      actionBar.classList.add('hidden');
      setTimeout(()=> {
        enemyAttack();
        endActionPhase();
      }, 600);
    }
  }

  function updateFaceButton(){
    // Daño directo solo si el defensor NO tiene cartas
    faceBtn.classList.toggle('hidden', !defenderHasNoCards('enemy'));
    faceBtn.onclick = () => {
      if(defenderHasNoCards('enemy')){
        if(state.selectedAttackerLane===null){ toast('Elige con qué carta atacas'); return; }
        resolveAttack(state.selectedAttackerLane, null);
      }
    };
  }

  function endActionPhase(){
    state.selectedAttackerLane = null;
    highlightEnemyTargets(false);
    actionBar.classList.add('hidden');

    // Robar y alternar atacante; volver a fase de colocación
    drawToHand();
    renderHand();
    state.attacker = (state.attacker==='player') ? 'enemy' : 'player';
    updateAttackerUI();
    state.phase = 'placing';
    setBanner('Coloca una carta');
  }

  // --- Selección/deselección del atacante (toggle) ---
  function toggleSelectAttacker(laneIdx){
    if(state.attacker!=='player' || state.phase!=='action') return;
    if(!state.lanes[laneIdx].p) return;

    if(state.selectedAttackerLane === laneIdx){
      // deseleccionar
      state.selectedAttackerLane = null;
      highlightEnemyTargets(false);
      renderBoard();
      updateFaceButton();
      return;
    }
    state.selectedAttackerLane = laneIdx;
    highlightEnemyTargets(true);
    renderBoard(); // para marcar la carta seleccionada
    updateFaceButton();
    toast('Elige objetivo');
  }

  // --- Resolución de ataque ---
  function resolveAttack(fromLane, targetLane){
    const A = state.lanes[fromLane].p;
    if(!A){ toast('No hay atacante'); return; }

    if(targetLane===null){
      if(!defenderHasNoCards('enemy')){ toast('El rival aún tiene cartas'); return; }
      state.eHP = Math.max(0, state.eHP - A.pw);
      updateHP();
      renderBoard();
      if(checkEnd()) return;
      endActionPhase();
      return;
    }

    const D = state.lanes[targetLane].e;
    if(!D){ toast('Objetivo inválido'); return; }

    const raw = Math.max(0, A.pw - D.pw);
    if(raw===0){
      toast('Bloqueado ⚔️→🛡', 'rgba(255,215,107,.9)');
    } else if(raw >= D.hp){
      const overflow = raw - D.hp;
      state.lanes[targetLane].e = null;
      state.eHP = Math.max(0, state.eHP - overflow);
      updateHP();
      toast(overflow>0 ? `¡Destruyes la carta! Exceso -${overflow} PV` : '¡Destruyes la carta!', 'rgba(123,255,154,.9)');
    } else {
      D.hp -= raw;
      toast(`Daño ${raw}`, 'rgba(123,255,154,.9)');
    }
    renderBoard();
    if(checkEnd()) return;
    endActionPhase();
  }

  // --- IA ataque ---
  function enemyAttack(){
    // Cara solo si jugador no tiene cartas
    if(!anyCards('player')){
      let bestLane = null, bestPw = -1;
      for(let i=0;i<LANES;i++){
        const c = state.lanes[i].e;
        if(c && c.pw > bestPw){ bestPw = c.pw; bestLane = i; }
      }
      if(bestLane!==null){
        state.pHP = Math.max(0, state.pHP - state.lanes[bestLane].e.pw);
        updateHP();
        toast(`El rival golpea directo -${state.lanes[bestLane].e.pw} PV`, 'rgba(255,108,132,.9)');
      }
      renderBoard();
      return;
    }

    // Si hay cartas, NO puede ir a cara: busca mejor objetivo
    let atkLane = null, tgtLane = null, bestScore = -1;
    for(let i=0;i<LANES;i++){
      const A = state.lanes[i].e;
      if(!A) continue;
      for(let j=0;j<LANES;j++){
        const D = state.lanes[j].p; if(!D) continue;
        const raw = Math.max(0, A.pw - D.pw);
        let score = 0;
        if(raw >= D.hp){
          const overflow = raw - D.hp;
          score = 100 + overflow; // destruir > dañar
        } else {
          score = raw;
        }
        if(score > bestScore){ bestScore = score; atkLane=i; tgtLane=j; }
      }
    }
    if(atkLane===null){ toast('El rival pasa'); return; }

    const A = state.lanes[atkLane].e;
    const D = state.lanes[tgtLane].p;
    const raw = Math.max(0, A.pw - D.pw);
    if(raw===0){
      toast('Bloqueas el ataque', 'rgba(255,215,107,.9)');
    } else if(raw >= D.hp){
      const overflow = raw - D.hp;
      state.lanes[tgtLane].p = null;
      state.pHP = Math.max(0, state.pHP - overflow);
      updateHP();
      toast(overflow>0 ? `Te destruye una carta (-${overflow} PV)` : 'Te destruye una carta', 'rgba(255,108,132,.9)');
    } else {
      D.hp -= raw;
      toast(`Recibes ${raw} de daño a carta`, 'rgba(255,108,132,.9)');
    }
    renderBoard();
  }

  // ---------- Fin de partida ----------
  function checkEnd(){
    if(state.pHP<=0 || state.eHP<=0){
      const win = state.pHP>0;
      endTitle.textContent = win ? '¡Victoria!' : 'Derrota';
      endLine.textContent = `Tú ${state.pHP} PV · Rival ${state.eHP} PV`;
      endOverlay.classList.add('visible');
      return true;
    }
    return false;
  }

  // ---------- New game / controls ----------
  function setBannerPlacing(){ setBanner('Coloca una carta'); }
  function newGame(){
    state.pHP = START_HP; state.eHP = START_HP; updateHP();
    state.attacker='player'; updateAttackerUI();
    state.phase='placing'; setBannerPlacing();
    state.lanes = Array.from({length: LANES}, () => ({ p:null, e:null }));

    // Tu mazo: mano inicial con Spiderman garantizado
    state.pDeck = makeDeckRandom(18);
    state.pHand = [ { ...SPIDEY } ]; // Spiderman en mano
    drawToHand();

    // Mazo enemigo
    state.eDeck = makeDeckRandom(18);
    state.eHand = [];
    drawToHand();

    renderHand(); renderBoard();
    state.resolving=false;
    state.selectedAttackerLane = null;
  }

  $('#resetBtn').addEventListener('click', ()=>{ newGame(); toast('Partida reiniciada'); });

  $('#startBtn').addEventListener('click', ()=>{ startOverlay.classList.remove('visible'); newGame(); });
  $('#howBtn').addEventListener('click', ()=>{ const d=$('#how'); d.open=!d.open; });
  $('#againBtn').addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  $('#menuBtn').addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); startOverlay.classList.add('visible'); });

  // Overlays: permitir clics en panel; bloquear fuera
  const gate = (e)=>{
    const anyVisible = startOverlay.classList.contains('visible') || endOverlay.classList.contains('visible') || zoomOverlay.classList.contains('visible');
    if(!anyVisible) return;
    if(e.target.closest('.overlay .panel, .zoom-panel')) return;
    e.stopPropagation(); e.preventDefault();
  };
  document.addEventListener('pointerdown', gate, {capture:true});
  document.addEventListener('click', gate, {capture:true});

  // ---------- Init (espera "Jugar") ----------
})();