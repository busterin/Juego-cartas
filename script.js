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

  // ---------- State ----------
  const START_HP = 10;
  const LANES = 3;

  const state = {
    pHP: START_HP, eHP: START_HP,
    attacker: 'player',  // 'player' | 'enemy' alterna cada turno
    resolving: false,
    lanes: Array.from({length: LANES}, () => ({ p: null, e: null })), // {hp, pw}
    pDeck: [], eDeck: [], pHand: [], eHand: []
  };

  // ---------- Decks / hands ----------
  function makeDeck(){
    // 18 cartas: Vida 2–7, Fuerza 1–6 (distribución simple)
    const d=[];
    for(let i=0;i<18;i++){
      const hp = rand(2,7);
      const pw = rand(1,6);
      d.push({hp, pw});
    }
    // Fisher–Yates
    for(let i=d.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]];
    }
    return d;
  }

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
    el.innerHTML = `${badgeHP(card.hp)} ${badgePW(card.pw)} <div class="big">${card.hp}/${card.pw}</div><div class="label">Arrastra</div>`;
    attachDragHandlers(el);
    el.addEventListener('click', ()=>{
      // tap rápido: elegir línea disponible si hay solo una; si hay varias, resaltarlas
      const free = freePlayerLanes();
      if(state.resolving) return;
      if(!free.length){ toast('No tienes huecos en tus líneas'); return; }
      if(free.length===1){ playFromHandToLane(parseInt(el.dataset.index,10), free[0]); }
      else {
        // resaltar slots y esperar drag; o jugar al primero por comodidad
        toast('Elige una línea (arrastra)');
        highlightPlayerSlots(true);
      }
    });
    return el;
  }

  function renderHand(){
    handEl.innerHTML = '';
    state.pHand.forEach((c,i)=> handEl.appendChild(createCardEl(c,i)));
  }

  function renderBoard(){
    // Limpia slots y vuelve a pintar cartas persistentes
    for(let i=0;i<LANES;i++){
      const ps = slotsPlayer[i], es = slotsEnemy[i];
      ps.innerHTML = ''; es.innerHTML = '';
      const p = state.lanes[i].p, e = state.lanes[i].e;
      if(p){
        const el = document.createElement('div');
        el.className = 'placed';
        el.innerHTML = `${badgeHP(p.hp)} ${badgePW(p.pw)} <div class="big">${p.hp}/${p.pw}</div>`;
        ps.appendChild(el);
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
  }

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

  // ---------- Drag & drop ----------
  let ghost=null, dragging=null, startRect=null;

  function attachDragHandlers(cardEl){
    cardEl.addEventListener('pointerdown', onDown, {passive:false});
  }
  function onDown(e){
    if(state.resolving) return;
    const el = e.currentTarget; dragging = el;
    el.setPointerCapture(e.pointerId);
    startRect = el.getBoundingClientRect();
    ghost = document.createElement('div');
    ghost.className='ghost';
    ghost.innerHTML = `${badgeHP(el.dataset.hp)} ${badgePW(el.dataset.pw)} <div class="big">${el.dataset.hp}/${el.dataset.pw}</div>`;
    document.body.appendChild(ghost);
    moveGhost(e.clientX,e.clientY);
    highlightPlayerSlots(true);

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
        }, 100);
      } else {
        ghost.style.left=(startRect.left+startRect.width/2)+'px';
        ghost.style.top =(startRect.top +startRect.height/2)+'px';
        setTimeout(removeGhost, 110);
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

  function freePlayerLanes(){
    const arr=[];
    for(let i=0;i<LANES;i++){ if(!state.lanes[i].p) arr.push(i); }
    return arr;
  }
  function freeEnemyLanes(){
    const arr=[];
    for(let i=0;i<LANES;i++){ if(!state.lanes[i].e) arr.push(i); }
    return arr;
  }

  // ---------- Play flow ----------
  function playFromHandToLane(handIndex, laneIndex){
    if(state.resolving) return;
    if(handIndex<0 || handIndex>=state.pHand.length) return;

    if(state.lanes[laneIndex].p){
      toast('Esa línea ya está ocupada'); return;
    }
    state.resolving = true;

    // Player places
    const pCard = state.pHand.splice(handIndex,1)[0];
    state.lanes[laneIndex].p = { ...pCard };
    renderHand(); renderBoard();

    // Enemy places
    setTimeout(()=>{
      enemyPlaceCard();
      renderBoard();

      // Resolve attacks for current attacker
      setTimeout(()=>{
        resolveTurnDamage();
        if(checkEnd()) return;

        // Draw new cards
        drawToHand();
        renderHand();

        // Alternate attacker and end
        state.attacker = (state.attacker==='player') ? 'enemy' : 'player';
        updateAttackerUI();
        state.resolving = false;
      }, 450);
    }, 350);
  }

  function enemyPlaceCard(){
    const free = freeEnemyLanes();
    if(!state.eHand.length || !free.length){ return; }

    // Simple heuristic: si enemigo ataca, intenta poner en una línea vacía enfrente de un hueco para pegar a PV;
    // si defiende, intenta oponerse donde tú tengas carta.
    let laneChoice = null;

    if(state.attacker==='enemy'){
      // Prefiere una línea donde tú NO tienes carta (para daño directo)
      const candidate = free.find(i => !state.lanes[i].p);
      laneChoice = (candidate!==undefined) ? candidate : free[rand(0, free.length-1)];
    } else {
      // Prefiere una línea donde tú SÍ tienes carta y su slot está libre
      const options = free.filter(i => !!state.lanes[i].p);
      laneChoice = options.length ? options[rand(0, options.length-1)] : free[rand(0, free.length-1)];
    }

    // Elegir carta: si ataca, prioriza ⚔; si defiende, prioriza ❤️.
    let chosenIdx = 0, bestScore = -1;
    if(state.attacker==='enemy'){
      state.eHand.forEach((c,idx)=>{ const sc=c.pw*2 + c.hp; if(sc>bestScore){bestScore=sc; chosenIdx=idx;} });
    } else {
      state.eHand.forEach((c,idx)=>{ const sc=c.hp*2 + c.pw; if(sc>bestScore){bestScore=sc; chosenIdx=idx;} });
    }

    const eCard = state.eHand.splice(chosenIdx,1)[0];
    state.lanes[laneChoice].e = { ...eCard };
  }

  // ---------- Damage resolution ----------
  function resolveTurnDamage(){
    const atk = state.attacker;           // 'player' | 'enemy'
    const def = atk==='player' ? 'enemy' : 'player';

    for(let i=0;i<LANES;i++){
      const lane = state.lanes[i];
      const A = atk==='player' ? lane.p : lane.e;
      if(!A) continue; // no ataca si no hay carta

      const D = def==='player' ? lane.p : lane.e;

      if(D){
        // Daño = max(0, atk.pw - def.pw)
        const raw = Math.max(0, A.pw - D.pw);
        if(raw===0){ continue; }
        if(raw >= D.hp){
          const overflow = raw - D.hp;
          // destruir carta defensora
          if(def==='player'){ lane.p = null; state.pHP = Math.max(0, state.pHP - overflow); }
          else { lane.e = null; state.eHP = Math.max(0, state.eHP - overflow); }
        }else{
          // reducir vida persistente
          D.hp -= raw;
        }
      } else {
        // Sin defensor: daño directo = ⚔ atacante
        if(def==='player'){ state.pHP = Math.max(0, state.pHP - A.pw); }
        else { state.eHP = Math.max(0, state.eHP - A.pw); }
      }
    }

    updateHP();
    renderBoard();
  }

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
  function newGame(){
    state.pHP = START_HP; state.eHP = START_HP; updateHP();
    state.attacker='player'; updateAttackerUI();
    state.lanes = Array.from({length: LANES}, () => ({ p:null, e:null }));
    state.pDeck = makeDeck(); state.eDeck = makeDeck();
    state.pHand=[]; state.eHand=[];
    drawToHand(); renderHand(); renderBoard();
    state.resolving=false;
  }

  $('#resetBtn').addEventListener('click', ()=>{ newGame(); toast('Partida reiniciada'); });

  $('#startBtn').addEventListener('click', ()=>{ startOverlay.classList.remove('visible'); newGame(); });
  $('#howBtn').addEventListener('click', ()=>{ const d=$('#how'); d.open=!d.open; });
  $('#againBtn').addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  $('#menuBtn').addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); startOverlay.classList.add('visible'); });

  // Permitir clics dentro del panel de overlay; bloquear fuera
  const gate = (e)=>{
    const anyVisible = startOverlay.classList.contains('visible') || endOverlay.classList.contains('visible');
    if(!anyVisible) return;
    if(e.target.closest('.overlay .panel')) return;
    e.stopPropagation(); e.preventDefault();
  };
  document.addEventListener('pointerdown', gate, {capture:true});
  document.addEventListener('click', gate, {capture:true});

  // ---------- Init (espera "Jugar") ----------
})();
