(() => {
  // ---------- Utils ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // ---------- DOM ----------
  const handEl = $('#hand');
  const roundNoEl = $('#roundNo');
  const pCoinsEl = $('#pCoins'), eCoinsEl = $('#eCoins');
  const pScoreEl = $('#pScore'), eScoreEl = $('#eScore');

  const endOverlay = $('#endOverlay'); const endTitle = $('#endTitle'); const endLine = $('#endLine');
  const zoomOverlay = $('#zoomOverlay'); const zoomWrap = $('#zoomCardWrap');

  const againBtn = $('#againBtn'); const passBtn  = $('#passBtn'); const resetBtn = $('#resetBtn');

  const startOv  = $('#startOverlay'); const startBtn = $('#startBtn');

  const introOv = $('#introOverlay'); const introContinue = $('#introContinue');

  const drawOverlay = $('#drawOverlay'); const drawCardEl  = $('#drawCard'); const turnToast = $('#turnToast');

  // ---------- Estado ----------
  const SLOTS = 6;                  // 6 por lado (3x2)
  const HAND_SIZE = 4, MAX_ROUNDS = 8;
  const state = {
    round: 1, pCoins: 3, eCoins: 3, pScore: 0, eScore: 0,
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    center: Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn: 'player', playerPassed:false, enemyPassed:false, resolving:false
  };

  // ---------- Cartas fijas ----------
  const CARDS = [
    { name:'Guerrera', art:'assets/Guerrera.PNG',  cost:3, pts:5,
      text:"Cuando la colocas enfrente de una carta rival, la destruye automáticamente." },
    { name:'Maga',     art:'assets/Maga.PNG',      cost:2, pts:4, text:"Canaliza energías arcanas a tu favor." },
    { name:'Arquero',  art:'assets/Arquero.PNG',   cost:1, pts:3, text:"Dispara con precisión quirúrgica." },
    { name:'Sanadora', art:'assets/Sanadora.PNG',  cost:2, pts:2, text:"Restaura y protege a los tuyos." },
    { name:'Bardo',    art:'assets/Bardo.PNG',     cost:1, pts:2, text:"Inspira y desarma con melodías." }
  ];

  const tokenCost = v => `<div class="token t-cost" aria-label="Coste ${v}">${v}</div>`;
  const tokenPts  = v => `<div class="token t-pts" aria-label="Puntos ${v}">${v}</div>`;
  const artHTML = (src, alt='') => `<div class="art">${src?`<img src="${src}" alt="${alt}">`:''}</div>`;

  // ---------- Limpieza ----------
  function purgeTransientNodes(){
    document.querySelectorAll('.fly-card, .ghost').forEach(n=>n.remove());
    drawOverlay?.classList.remove('visible');
  }

  // ---------- Zoom ----------
  function openZoom(card){
    zoomWrap.innerHTML = `
      <div class="zoom-card" role="dialog" aria-label="${card.name}">
        <div class="art">${card.art?`<img src="${card.art}" alt="${card.name}">`:''}</div>
        <div class="zoom-token cost" aria-label="Coste ${card.cost}">${card.cost}</div>
        <div class="zoom-token pts" aria-label="Puntos ${card.pts}">${card.pts}</div>
        <div class="name">${card.name}</div>
        <div class="desc">${card.text}</div>
      </div>`;
    zoomOverlay.classList.add('visible');
  }
  function closeZoom(){ zoomOverlay.classList.remove('visible'); }
  zoomOverlay.addEventListener('click', e=>{ if(!e.target.closest('.zoom-card')) closeZoom(); });

  // ---------- Imagenes listas ----------
  function whenImagesReady(root, cb){
    const imgs = Array.from(root.querySelectorAll('img'));
    if (imgs.length === 0){ cb(); return; }
    let remaining = imgs.length;
    const done = () => { remaining--; if (remaining <= 0) cb(); };
    imgs.forEach(img=>{
      if (img.complete) done();
      else { img.addEventListener('load', done, {once:true}); img.addEventListener('error', done, {once:true}); }
    });
  }

  // ---------- Layout mano ----------
  function layoutHand(){
    const n = handEl.children.length; if (!n) return;

    const contRect = handEl.getBoundingClientRect();
    const contW = handEl.clientWidth || contRect.width || window.innerWidth;
    const cardW = handEl.children[0]?.getBoundingClientRect().width || 0;
    if (!contW || !cardW) return;

    const EDGE = 8;
    const bearEl  = document.querySelector('.portrait.player .frame.hex');
    const demonEl = document.querySelector('.portrait.enemy  .frame.hex');

    let startCenter = EDGE + cardW/2;
    if (bearEl){
      const bearLeftInHand = bearEl.getBoundingClientRect().left - contRect.left;
      startCenter = Math.max(EDGE + cardW/2, bearLeftInHand + cardW/2);
    }
    let endCenter = contW - EDGE - cardW/2;
    if (demonEl){
      const demonRightInHand = demonEl.getBoundingClientRect().right - contRect.left;
      endCenter = Math.min(contW - EDGE - cardW/2, demonRightInHand - cardW/2);
    }
    if (endCenter < startCenter) endCenter = startCenter;

    const centers = [];
    if (n === 1){
      centers.push((startCenter + endCenter)/2);
    } else {
      const step = (endCenter - startCenter) / (n - 1);
      for (let i=0;i<n;i++) centers.push(startCenter + i*step);
    }

    const mid = (n - 1) / 2;
    [...handEl.children].forEach((el, i) => {
      const cx = centers[i], tx = Math.round(cx - contW/2);
      el.style.setProperty('--x', `${tx}px`);
      el.style.setProperty('--off', `0px`);
      el.style.setProperty('--rot', `${(i - mid) * 1.2}deg`);
      el.style.zIndex = 10 + i;
    });
  }
  function layoutHandSafe(){ layoutHand(); requestAnimationFrame(layoutHand); setTimeout(layoutHand, 60); whenImagesReady(handEl, layoutHand); }

  // ---------- FX ----------
  function addExplosion(slotEl){
    if(!slotEl) return;
    const ex = document.createElement('div');
    ex.className = 'explosion';
    slotEl.appendChild(ex);
    setTimeout(()=> ex.remove(), 600);
  }
  const isGuerrera = c => c && c.name === 'Guerrera';
  function destroyWithFX(targetSide, laneIndex, killedName){
    const slotSel = `.slot[data-side="${targetSide}"][data-lane="${laneIndex}"]`;
    const slotEl = document.querySelector(slotSel);
    const placed = slotEl?.querySelector('.placed');
    if(placed){ placed.classList.add('destroy'); }
    addExplosion(slotEl);
    setTimeout(()=>{ renderBoard(); }, 330);
    const who = targetSide === 'enemy' ? '😈' : '🛡️';
    showTurnToast(`${who} ${killedName||'Carta'} destruida`, 900, 'warn');
  }
  function applyOnPlaceEffects(side, laneIndex, card){
    if (isGuerrera(card)) {
      const cell = state.center[laneIndex];
      if (side === 'player' && cell.e){
        const killed = cell.e; destroyWithFX('enemy', laneIndex, killed.name);
        setTimeout(()=>{ cell.e = null; }, 300);
      } else if (side === 'enemy' && cell.p){
        const killed = cell.p; destroyWithFX('player', laneIndex, killed.name);
        setTimeout(()=>{ cell.p = null; }, 300);
      }
    }
  }

  // ---------- Mano ----------
  function createHandCardEl(card,i){
    const el=document.createElement('div');
    el.className='card';
    el.dataset.index=i; el.dataset.cost=card.cost; el.dataset.pts=card.pts;
    el.dataset.name=card.name||''; el.dataset.art=card.art||''; el.dataset.text=card.text||'';
    el.setAttribute('role','listitem');
    el.setAttribute('aria-label', `${card.name}, coste ${card.cost}, ${card.pts} puntos`);
    el.innerHTML=`
      ${artHTML(card.art, card.name)}
      ${tokenCost(card.cost)}${tokenPts(card.pts)}
      <div class="name-top">${card.name||''}</div>
      <div class="desc">${card.text||''}</div>
    `;

    el.addEventListener('click', ()=> openZoom(card));
    attachDragHandlers(el);
    return el;
  }
  function renderHand(){
    handEl.innerHTML='';
    state.pHand.forEach((c,i)=> handEl.appendChild(createHandCardEl(c,i)));
    layoutHandSafe();
  }

  // ---------- Robo animado ----------
  function showDrawLarge(card, cb){
    drawCardEl.innerHTML = `
      <div class="zoom-card" aria-label="Carta robada: ${card.name}">
        <div class="art"><img src="${card.art}" alt="${card.name}"></div>
        <div class="zoom-token cost">${card.cost}</div>
        <div class="zoom-token pts">${card.pts}</div>
        <div class="name">${card.name}</div>
        <div class="desc">${card.text||''}</div>
      </div>`;
    drawOverlay.classList.add('visible');
    setTimeout(()=>{ drawOverlay.classList.remove('visible'); cb && setTimeout(cb, 250); }, 900);
  }
  function flyCardToHand(card, onDone){
    const idx = state.pHand.length - 1;
    const targetEl = handEl.children[idx];
    if(!targetEl){ onDone && onDone(); return; }

    const r = targetEl.getBoundingClientRect();
    const targetX = r.left + r.width/2, targetY = r.top + r.height/2;
    targetEl.style.opacity = '0';

    const fly = document.createElement('div');
    fly.className = 'fly-card';
    fly.innerHTML = `<div class="art"><img src="${card.art}" alt="${card.name}"></div>`;
    document.body.appendChild(fly);

    const startX = window.innerWidth/2, startY = window.innerHeight/2;
    const flyW = parseFloat(getComputedStyle(fly).width);
    const scale = r.width / flyW;

    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
      fly.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px) scale(${scale})`;
    }); });

    setTimeout(()=>{ fly.remove(); targetEl.style.opacity = ''; layoutHandSafe(); onDone && onDone(); }, 500);
  }
  function drawOneAnimated(done){
    if(!state.pDeck.length){ done && done(); return; }
    const card = state.pDeck.pop();
    showDrawLarge(card, ()=>{
      state.pHand.push(card); renderHand();
      requestAnimationFrame(()=> flyCardToHand(card, done));
    });
  }
  function topUpPlayerAnimated(done){
    const step = () => {
      if(state.pHand.length >= HAND_SIZE || !state.pDeck.length){ done && done(); return; }
      drawOneAnimated(step);
    };
    step();
  }
  function topUpEnemyInstant(){
    while(state.eHand.length < HAND_SIZE && state.eDeck.length){
      state.eHand.push(state.eDeck.pop());
    }
  }

  // ---------- Tablero ----------
  function renderBoard(){
    for(let i=0;i<SLOTS;i++){
      const ps= document.querySelector(`.slot[data-side="player"][data-lane="${i}"]`);
      const es= document.querySelector(`.slot[data-side="enemy"][data-lane="${i}"]`);
      if (!ps || !es) continue;
      ps.innerHTML=''; es.innerHTML='';

      const p=state.center[i].p, e=state.center[i].e;
      ps.classList.toggle('occupied', !!p);
      es.classList.toggle('occupied', !!e);

      if(p){
        const d=document.createElement('div');
        d.className='placed';
        d.setAttribute('aria-label', `${p.name} con ${p.pts} puntos`);
        d.innerHTML = `${artHTML(p.art, p.name)}${tokenPts(p.pts)}<div class="name-top">${p.name}</div><div class="desc">${p.text}</div>`;
        d.addEventListener('click', ()=> openZoom(p));
        ps.appendChild(d);
      }
      if(e){
        const d=document.createElement('div');
        d.className='placed enemy';
        d.setAttribute('aria-label', `${e.name} con ${e.pts} puntos`);
        d.innerHTML = `${artHTML(e.art, e.name)}${tokenPts(e.pts)}<div class="name-top">${e.name}</div><div class="desc">${e.text}</div>`;
        d.addEventListener('click', ()=> openZoom(e));
        es.appendChild(d);
      }
    }
  }

  // ---------- HUD ----------
  function updateHUD(){
    roundNoEl.textContent=state.round;
    pCoinsEl.textContent=state.pCoins; eCoinsEl.textContent=state.eCoins;
    pScoreEl.textContent=state.pScore; eScoreEl.textContent=state.eScore;
  }

  // ---------- Drag & drop ----------
  let ghost=null;
  function attachDragHandlers(el){
    el.addEventListener('pointerdown', onDown, {passive:false});
    function onDown(e){
      if(state.turn!=='player'||state.resolving) return;
      const src = e.currentTarget;
      src.setPointerCapture(e.pointerId);

      ghost = document.createElement('div');
      ghost.className = 'ghost';
      ghost.innerHTML = `${artHTML(src.dataset.art, src.dataset.name||'')}${tokenCost(src.dataset.cost)}${tokenPts(src.dataset.pts)}<div class="name-top">${src.dataset.name||''}</div><div class="desc">${src.dataset.text||''}</div>`;
      document.body.appendChild(ghost);
      moveGhost(e.clientX, e.clientY);

      const move = ev => { ev.preventDefault(); moveGhost(ev.clientX, ev.clientY); };
      const finish = ev => {
        try { src.releasePointerCapture(e.pointerId); } catch(_) {}
        window.removeEventListener('pointermove', move, {passive:false});
        window.removeEventListener('pointerup', finish, true);
        window.removeEventListener('pointercancel', finish, true);

        const lane = laneUnder(ev.clientX, ev.clientY);
        if(lane !== -1) tryPlayFromHandToSlot(+src.dataset.index, lane);

        if (ghost) { ghost.remove(); ghost = null; }
        layoutHandSafe();
      };

      window.addEventListener('pointermove', move, {passive:false});
      window.addEventListener('pointerup', finish, {passive:false, capture:true});
      window.addEventListener('pointercancel', finish, {passive:false, capture:true});
    }
  }
  const moveGhost=(x,y)=>{ if(!ghost) return; ghost.style.left=x+'px'; ghost.style.top=y+'px'; };
  function laneUnder(x,y){
    for(let i=0;i<SLOTS;i++){
      const el = document.querySelector(`.slot[data-side="player"][data-lane="${i}"]`);
      if(!el) continue;
      const r = el.getBoundingClientRect();
      if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) return i;
    }
    return -1;
  }

  // ---------- Toast ----------
  let toastTimer=null;
  function showTurnToast(text, ms=1200, variant='normal'){
    if(!turnToast) return;
    turnToast.textContent = text;
    turnToast.classList.toggle('warn', variant==='warn');
    turnToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> turnToast.classList.remove('show'), ms);
  }

  // ---------- Reglas ----------
  const canAfford = c => state.pCoins>=c.cost;

  function insufficientFeedback(handIndex){
    const el = handEl.children[handIndex];
    if(el){
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    }
    showTurnToast('Monedas insuficientes', 900, 'warn');
  }

  function tryPlayFromHandToSlot(handIndex, slotIndex){
    if(handIndex<0||handIndex>=state.pHand.length) return;
    const card=state.pHand[handIndex];

    if (state.center[slotIndex].p) return;
    if(!canAfford(card)) { insufficientFeedback(handIndex); return; }

    state.pCoins -= card.cost;
    state.center[slotIndex].p = {...card};

    applyOnPlaceEffects('player', slotIndex, card);

    state.pHand.splice(handIndex,1);
    renderHand(); renderBoard(); updateHUD();

    if(state.pDeck.length){
      drawOneAnimated(()=>{ renderHand(); updateHUD(); });
    }
  }

  // ---------- IA rival ----------
  function enemyTurn(){
    state.resolving=true; state.enemyPassed=false;
    updateHUD(); showTurnToast('TURNO RIVAL');

    const canPlay=()=> state.eHand.some(c=>c.cost<=state.eCoins);

    function pickBestCardIndex(){
      let best=-1,score=-1;
      state.eHand.forEach((c,i)=>{ if(c.cost<=state.eCoins){ const s=c.pts*2-c.cost; if(s>score){score=s; best=i;} }});
      return best;
    }
    function pickBestLane(){
      let bestLane = -1, bestPts = -1;
      for(let i=0;i<SLOTS;i++){
        const lane = state.center[i];
        if(!lane.e && lane.p && lane.p.pts > bestPts){ bestPts = lane.p.pts; bestLane = i; }
      }
      if(bestLane !== -1) return bestLane;
      for(let i=0;i<SLOTS;i++){ if(!state.center[i].e) return i; }
      return -1;
    }

    const tryPlayOnce=()=>{
      if(!canPlay()) return false;

      const bestIdx = pickBestCardIndex();
      if(bestIdx === -1) return false;

      const target = pickBestLane();
      if(target===-1) return false;

      const card = state.eHand[bestIdx];
      state.eCoins -= card.cost;
      state.center[target].e = {...card};

      applyOnPlaceEffects('enemy', target, card);

      state.eHand.splice(bestIdx,1);
      if(state.eDeck.length) state.eHand.push(state.eDeck.pop());

      renderBoard(); updateHUD();
      return true;
    };

    const loop=()=>{ if(!tryPlayOnce()){ state.enemyPassed=true; setTimeout(()=>{state.resolving=false; checkBothPassedThenScore();},500); return; } setTimeout(loop,220); };
    loop();
  }

  // ---------- Puntuación / Fin ----------
  function endGame(){
    state.resolving = true;
    let title = 'Empate';
    if(state.pScore > state.eScore) title = '¡Victoria!';
    else if(state.eScore > state.pScore) title = 'Derrota';
    endTitle.textContent = title;
    endLine.textContent = `Puntos — Tú: ${state.pScore} · Rival: ${state.eScore}`;
    endOverlay.classList.add('visible');
  }
  const bothPassed=()=> state.playerPassed && state.enemyPassed;

  function scoreTurn(){
    let p=0,e=0;
    state.center.forEach(c=>{ if(c.p) p+=c.p.pts; if(c.e) e+=c.e.pts; });
    state.pScore+=p; state.eScore+=e; updateHUD();

    if(state.round === MAX_ROUNDS){ setTimeout(endGame, 300); return; }

    state.round+=1; state.playerPassed=false; state.enemyPassed=false; state.turn='player';
    state.pCoins+=1; state.eCoins+=1; updateHUD();

    topUpEnemyInstant();
    topUpPlayerAnimated(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      setTimeout(()=> showTurnToast('TU TURNO'), 200);
    });
  }
  function checkBothPassedThenScore(){ if(bothPassed()) scoreTurn(); }

  // ---------- Nueva partida ----------
  function newGame(){
    purgeTransientNodes();
    state.round=1; state.pCoins=3; state.eCoins=3; state.pScore=0; state.eScore=0;
    state.playerPassed=false; state.enemyPassed=false; state.turn='player';
    state.center=Array.from({length:SLOTS},()=>({p:null,e:null}));

    state.pDeck = [...CARDS].sort(()=> Math.random()-0.5);
    state.eDeck = [...CARDS].sort(()=> Math.random()-0.5);
    state.pHand=[]; state.eHand=[];
    renderBoard(); renderHand(); updateHUD();

    topUpEnemyInstant();
    topUpPlayerAnimated(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      showTurnToast('TU TURNO');
    });
  }

  // ---------- Eventos ----------
  againBtn.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  resetBtn.addEventListener('click', ()=> newGame());
  passBtn.addEventListener('click', ()=>{
    if(state.turn!=='player'||state.resolving) return;
    state.playerPassed=true; state.turn='enemy'; enemyTurn();
  });

  // Portada → Intro
  if(startBtn){
    startBtn.addEventListener('click', ()=>{
      startOv.classList.remove('visible');
      introOv?.classList.add('visible');
    });
  }

  // Intro → Juego
  if(introContinue){
    introContinue.addEventListener('click', ()=>{
      introOv.classList.remove('visible');
      newGame();
    });
  }

  window.addEventListener('resize', ()=>{ layoutHandSafe(); purgeTransientNodes(); });
  window.addEventListener('orientationchange', ()=>{ layoutHandSafe(); purgeTransientNodes(); });

  // Arranque (si no hay portada visible por cualquier motivo)
  window.addEventListener('DOMContentLoaded', ()=>{
    if(!startBtn){ newGame(); }
  });
})();