(() => {
  // ---------- Utils ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // ---------- DOM ----------
  const handEl = $('#hand');
  const roundNoEl = $('#roundNo');
  const pCoinsEl = $('#pCoins'), eCoinsEl = $('#eCoins');
  const pScoreEl = $('#pScore'), eScoreEl = $('#eScore'); // ahora muestran VIDA

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

  // ---------- Estado ----------
  const SLOTS = 6;         // 3x2 por lado
  const HAND_SIZE = 4;

  const state = {
    round: 1,
    pCoins: 3, eCoins: 3,
    pScore: 10, eScore: 10,       // VIDA inicial 10
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    center: Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn: 'player',
    playerPassed:false, enemyPassed:false,
    resolving:false
  };

  // ---------- Cartas ----------
  const CARDS = [
    { name:'Guerrera', art:'assets/Guerrera.PNG',  cost:3, pts:5, text:"Cuando la colocas enfrente de una carta rival, la destruye automáticamente." },
    { name:'Maga',     art:'assets/Maga.PNG',      cost:2, pts:4, text:"Canaliza energías arcanas a tu favor." },
    { name:'Arquero',  art:'assets/Arquero.PNG',   cost:1, pts:3, text:"Dispara con precisión quirúrgica." },
    { name:'Sanadora', art:'assets/Sanadora.PNG',  cost:2, pts:2, text:"Restaura y protege a los tuyos." },
    { name:'Bardo',    art:'assets/Bardo.PNG',     cost:1, pts:2, text:"Inspira y desarma con melodías." }
  ];

  const tokenCost = v => `<div class="token t-cost">${v}</div>`;
  const tokenPts  = v => `<div class="token t-pts">${v}</div>`;
  const artHTML   = src => `<div class="art">${src?`<img src="${src}" alt="">`:''}</div>`;

  // ---------- Limpieza de nodos temporales ----------
  function purgeTransientNodes(){
    document.querySelectorAll('.fly-card, .ghost').forEach(n=>n.remove());
    if (drawOverlay) drawOverlay.classList.remove('visible');
  }

  // ---------- Zoom ----------
  function openZoom(card){
    zoomWrap.innerHTML = `
      <div class="zoom-card">
        <div class="art">${card.art?`<img src="${card.art}" alt="${card.name}">`:''}</div>
        <div class="zoom-token cost">${card.cost}</div>
        <div class="zoom-token pts">${card.pts}</div>
        <div class="name">${card.name}</div>
        <div class="desc">${card.text||''}</div>
      </div>`;
    zoomOverlay.classList.add('visible');
  }
  function closeZoom(){ zoomOverlay.classList.remove('visible'); }
  zoomOverlay.addEventListener('click', e=>{ if(!e.target.closest('.zoom-card')) closeZoom(); });

  // ---------- Espera imágenes ----------
  function whenImagesReady(root, cb){
    const imgs = Array.from(root.querySelectorAll('img'));
    if (imgs.length === 0){ cb(); return; }
    let remaining = imgs.length;
    const done = () => { remaining--; if (remaining <= 0) cb(); };
    imgs.forEach(img=>{
      if (img.complete) { done(); }
      else {
        img.addEventListener('load', done, {once:true});
        img.addEventListener('error', done, {once:true});
      }
    });
  }

  // ---------- Layout Mano ----------
  function layoutHand(){
    const n = handEl.children.length;
    if (!n) return;

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
      const cx = centers[i];
      const tx = Math.round(cx - contW/2);
      el.style.setProperty('--x', `${tx}px`);
      el.style.setProperty('--off', `0px`);
      el.style.setProperty('--rot', `${(i - mid) * 1.2}deg`);
      el.style.zIndex = 10 + i;
    });
  }
  function layoutHandSafe(){
    layoutHand();
    requestAnimationFrame(layoutHand);
    setTimeout(layoutHand, 60);
    whenImagesReady(handEl, layoutHand);
  }

  // ---------- Mano ----------
  function createHandCardEl(card,i,n){
    const el=document.createElement('div');
    el.className='card';
    el.dataset.index=i; el.dataset.cost=card.cost; el.dataset.pts=card.pts;
    el.dataset.name=card.name||''; el.dataset.art=card.art||''; el.dataset.text=card.text||'';
    el.innerHTML=`
      ${artHTML(card.art)}
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
    const n = state.pHand.length;
    state.pHand.forEach((c,i)=> handEl.appendChild(createHandCardEl(c,i,n)));
    layoutHandSafe();
  }

  // ---------- Robo (vista grande + vuelo a mano) ----------
  function showDrawLarge(card, cb){
    drawCardEl.innerHTML = `
      <div class="zoom-card">
        <div class="art"><img src="${card.art}" alt="${card.name}"></div>
        <div class="zoom-token cost">${card.cost}</div>
        <div class="zoom-token pts">${card.pts}</div>
        <div class="name">${card.name}</div>
        <div class="desc">${card.text||''}</div>
      </div>
    `;
    drawOverlay.classList.add('visible');
    setTimeout(()=>{
      drawOverlay.classList.remove('visible');
      if(cb) setTimeout(cb, 250);
    }, 900);
  }

  function flyCardToHand(card, onDone){
    const idx = state.pHand.length - 1;
    const targetEl = handEl.children[idx];
    if(!targetEl){ if(onDone) onDone(); return; }

    const r = targetEl.getBoundingClientRect();
    const targetX = r.left + r.width/2;
    const targetY = r.top  + r.height/2;

    targetEl.style.opacity = '0';

    const fly = document.createElement('div');
    fly.className = 'fly-card';
    fly.innerHTML = `<div class="art"><img src="${card.art}" alt=""></div>`;
    document.body.appendChild(fly);

    const startX = window.innerWidth/2;
    const startY = window.innerHeight/2;

    const flyW = parseFloat(getComputedStyle(fly).width);
    const scale = r.width / flyW;

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        fly.style.transform = `translate(${targetX - startX}px, ${targetY - startY}px) scale(${scale})`;
      });
    });

    setTimeout(()=>{
      fly.remove();
      targetEl.style.opacity = '';
      layoutHandSafe();
      if(onDone) onDone();
    }, 500);
  }

  function drawOneAnimated(done){
    if(!state.pDeck.length){ if(done) done(); return; }
    const card = state.pDeck.pop();

    showDrawLarge(card, ()=>{
      state.pHand.push(card);
      renderHand();
      requestAnimationFrame(()=> flyCardToHand(card, done));
    });
  }

  function topUpPlayerAnimated(done){
    const step = () => {
      if(state.pHand.length >= HAND_SIZE || !state.pDeck.length){ if(done) done(); return; }
      drawOneAnimated(step);
    };
    step();
  }

  // Enemigo roba sin animación
  function topUpEnemyInstant(){
    while(state.eHand.length<Math.min(HAND_SIZE,5) && state.eDeck.length) state.eHand.push(state.eDeck.pop());
  }

  // ---------- Tablero ----------
  function renderBoard(){
    const playerSlots = $$('.slot[data-side="player"]');
    const enemySlots  = $$('.slot[data-side="enemy"]');
    for(let i=0;i<SLOTS;i++){
      const ps=playerSlots[i], es=enemySlots[i];
      if (!ps || !es) continue;
      ps.innerHTML=''; es.innerHTML='';
      const p=state.center[i].p, e=state.center[i].e;
      if(p){
        const d=document.createElement('div');
        d.className='placed';
        d.innerHTML = `${artHTML(p.art)}${tokenPts(p.pts)}<div class="name-top">${p.name}</div><div class="desc">${p.text}</div>`;
        d.addEventListener('click', ()=> openZoom(p));
        ps.appendChild(d);
        ps.classList.add('occupied');
      }else ps.classList.remove('occupied');
      if(e){
        const d=document.createElement('div');
        d.className='placed enemy';
        d.innerHTML = `${artHTML(e.art)}${tokenPts(e.pts)}<div class="name-top">${e.name}</div><div class="desc">${e.text}</div>`;
        d.addEventListener('click', ()=> openZoom(e));
        es.appendChild(d);
        es.classList.add('occupied');
      }else es.classList.remove('occupied');
    }
  }

  // ---------- HUD ----------
  function updateHUD(){
    roundNoEl.textContent=state.round;
    pCoinsEl.textContent=state.pCoins; eCoinsEl.textContent=state.eCoins;
    pScoreEl.textContent=state.pScore; eScoreEl.textContent=state.eScore; // muestran VIDA
  }

  // ---------- Combate / Daño ----------
  function getSlotsEls(index){
    const playerSlots = $$('.slot[data-side="player"]');
    const enemySlots  = $$('.slot[data-side="enemy"]');
    return { ps: playerSlots[index], es: enemySlots[index] };
  }

  function spawnExplosionOn(el){
    if(!el) return;
    const placed = el.querySelector('.placed');
    if(!placed) return;
    const boom = document.createElement('div');
    boom.className = 'explosion';
    placed.appendChild(boom);
    setTimeout(()=> boom.remove(), 500);
  }

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

  // atacanteSide: 'player' | 'enemy'
  function resolveConfrontation(index, attackerSide, forcedDestroy=false, attackerPts=0){
    const pair = state.center[index];
    if(!pair) return;

    if(attackerSide==='player'){
      const atk = pair.p; const def = pair.e;
      if(!def) return;
      // Si Guerrera u orden forzada: destruir siempre y daño = max(0, atk.pts - def.pts)
      if(forcedDestroy || (atk && atk.name==='Guerrera')){
        const { es } = getSlotsEls(index);
        spawnExplosionOn(es);
        pair.e = null;
        renderBoard();
        applyDamage('enemy', Math.max(0, (atk?.pts||attackerPts) - def.pts));
        return;
      }
      if(atk && def && atk.pts > def.pts){
        const { es } = getSlotsEls(index);
        spawnExplosionOn(es);
        pair.e = null;
        renderBoard();
        applyDamage('enemy', atk.pts - def.pts);
      }
    }else{
      const atk = pair.e; const def = pair.p;
      if(!def) return;
      if(forcedDestroy || (atk && atk.name==='Guerrera')){ // por simetría
        const { ps } = getSlotsEls(index);
        spawnExplosionOn(ps);
        pair.p = null;
        renderBoard();
        applyDamage('player', Math.max(0, (atk?.pts||attackerPts) - def.pts));
        return;
      }
      if(atk && def && atk.pts > def.pts){
        const { ps } = getSlotsEls(index);
        spawnExplosionOn(ps);
        pair.p = null;
        renderBoard();
        applyDamage('player', atk.pts - def.pts);
      }
    }
  }

  // ---------- Drag & drop ----------
  let ghost=null;
  function attachDragHandlers(el){ el.addEventListener('pointerdown', onDown, {passive:false}); }
  function onDown(e){
    if(state.turn!=='player'||state.resolving) return;
    const src = e.currentTarget; src.setPointerCapture(e.pointerId); e.preventDefault();

    ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.innerHTML = `${artHTML(src.dataset.art)}${tokenCost(src.dataset.cost)}${tokenPts(src.dataset.pts)}<div class="name-top">${src.dataset.name||''}</div><div class="desc">${src.dataset.text||''}</div>`;
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
  const moveGhost=(x,y)=>{ if(!ghost) return; ghost.style.left=x+'px'; ghost.style.top=y+'px'; }
  function laneUnder(x,y){
    const playerSlots = $$('.slot[data-side="player"]');
    for(let i=0;i<playerSlots.length;i++){
      const el = playerSlots[i];
      const r = el.getBoundingClientRect();
      if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) return i;
    }
    return -1;
  }

  // ---------- Reglas de juego ----------
  const canAfford = c => state.pCoins>=c.cost;

  function tryPlayFromHandToSlot(handIndex, slotIndex){
    if(handIndex<0||handIndex>=state.pHand.length) return;
    const card=state.pHand[handIndex];
    if(!canAfford(card)){
      const el = handEl.children[handIndex];
      if (el){ el.classList.add('shake'); setTimeout(()=> el.classList.remove('shake'), 450); }
      return;
    }
    // Pagar y colocar
    state.pCoins -= card.cost;
    state.center[slotIndex].p = {...card};
    state.pHand.splice(handIndex,1);
    renderHand(); renderBoard(); updateHUD();

    // Enfrentamiento inmediato (con efecto de Guerrera)
    const forced = card.name==='Guerrera';
    resolveConfrontation(slotIndex, 'player', forced, card.pts);

    // Roba 1 animada si hay mazo
    if(state.pDeck.length){
      drawOneAnimated(()=>{ renderHand(); updateHUD(); });
    }
  }

  // ---------- IA rival ----------
  function enemyTurn(){
    state.resolving=true; state.enemyPassed=false; state.eCoins+=1; updateHUD();
    showTurnToast('TURNO RIVAL');
    const canPlay=()=> state.eHand.some(c=>c.cost<=state.eCoins);

    const tryPlayOnce=()=>{
      if(!canPlay()) return false;
      // Elegir carta simple por heurística pts*2 - cost
      let best=-1,score=-1;
      state.eHand.forEach((c,i)=>{ if(c.cost<=state.eCoins){ const s=c.pts*2-c.cost; if(s>score){score=s; best=i;} }});
      const card=state.eHand[best];

      // Buscar primer hueco enemigo libre
      let target=-1;
      for(let i=0;i<SLOTS;i++){ if(!state.center[i].e){ target=i; break; } }
      if(target===-1) return false;

      // Pagar y colocar
      state.eCoins-=card.cost; state.center[target].e={...card};
      state.eHand.splice(best,1); if(state.eDeck.length) state.eHand.push(state.eDeck.pop());
      renderBoard(); updateHUD();

      // Enfrentamiento inmediato (simétrico)
      const forced = card.name==='Guerrera';
      resolveConfrontation(target, 'enemy', forced, card.pts);

      return true;
    };

    const loop=()=>{ if(!tryPlayOnce()){ state.enemyPassed=true; setTimeout(()=>{state.resolving=false; checkBothPassedThenNextRound();},400); return; } setTimeout(loop,220); };
    loop();
  }

  // ---------- Rondas (sin sumar puntos) ----------
  const bothPassed=()=> state.playerPassed && state.enemyPassed;

  function nextRound(){
    // No hay puntuación por tablero, solo avanza la ronda
    state.round+=1;
    state.playerPassed=false; state.enemyPassed=false;
    state.turn='player';
    state.pCoins+=1; // como antes
    topUpEnemyInstant();
    topUpPlayerAnimated(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      setTimeout(()=> showTurnToast('TU TURNO'), 200);
    });
  }
  function checkBothPassedThenNextRound(){ if(!checkDefeat() && bothPassed()) nextRound(); }

  // ---------- Nueva partida ----------
  function newGame(){
    purgeTransientNodes();
    state.round=1; state.pCoins=3; state.eCoins=3;
    state.pScore=10; state.eScore=10;           // VIDA 10
    state.playerPassed=false; state.enemyPassed=false; state.turn='player';
    state.center=Array.from({length:SLOTS},()=>({p:null,e:null}));
    state.pDeck = [...CARDS].sort(()=> Math.random()-0.5);
    state.eDeck = [...CARDS].sort(()=> Math.random()-0.5);
    state.pHand=[]; state.eHand=[];
    renderBoard(); renderHand(); updateHUD();

    // Relleno inicial
    topUpEnemyInstant();
    topUpPlayerAnimated(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      showTurnToast('TU TURNO');
    });
  }

  // ---------- Toast de turno ----------
  let toastTimer=null;
  function showTurnToast(text, ms=1200){
    const el = document.getElementById('turnToast');
    if(!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> el.classList.remove('show'), ms);
  }

  // ---------- Intro “Fire Emblem” ----------
  const INTRO_TEXT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus.";
  let typingTimer = null;
  let typingIdx = 0;
  let typingRunning = false;

  function startIntro(){
    if(!introOv) { newGame(); return; }
    introTextEl.textContent = "";
    introOv.classList.add('visible');
    introOv.setAttribute('aria-hidden','false');
    typingIdx = 0;
    typingRunning = true;
    if(introNext) introNext.disabled = true;

    const speed = 22; // ms/char
    const run = () => {
      if (typingIdx < INTRO_TEXT.length){
        introTextEl.textContent = INTRO_TEXT.slice(0, typingIdx+1);
        typingIdx++;
        typingTimer = setTimeout(run, speed);
      } else {
        typingRunning = false;
        if(introNext) introNext.disabled = false;
      }
    };
    run();
  }

  function skipOrContinueIntro(){
    if(!introOv) return;
    if (typingRunning){
      clearTimeout(typingTimer);
      introTextEl.textContent = INTRO_TEXT;
      typingRunning = false;
      if(introNext) introNext.disabled = false;
      return;
    }
    introOv.classList.remove('visible');
    introOv.setAttribute('aria-hidden','true');
    newGame();
  }

  if(introNext){ introNext.addEventListener('click', skipOrContinueIntro); }
  if(introOv){
    introOv.addEventListener('click', (e)=>{
      if(e.target.closest('.intro-panel')) skipOrContinueIntro();
    });
  }

  // ---------- Eventos ----------
  againBtn.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  resetBtn.addEventListener('click', ()=> newGame());
  passBtn.addEventListener('click', ()=>{
    if(state.turn!=='player'||state.resolving) return;
    state.playerPassed=true; state.turn='enemy'; enemyTurn();
  });

  window.addEventListener('resize', ()=>{ layoutHandSafe(); purgeTransientNodes(); });
  window.addEventListener('orientationchange', ()=>{ layoutHandSafe(); purgeTransientNodes(); });

  // Arranque
  window.addEventListener('DOMContentLoaded', ()=>{
    if(startBtn){
      startBtn.addEventListener('click', ()=>{
        startOv.classList.remove('visible');
        startIntro(); // Intro antes del juego
      });
    }else{
      newGame();
    }
  });
})();