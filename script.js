(() => {
  // ---------- Utils ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;

  // ---------- DOM ----------
  const handEl = $('#hand');
  const slotsPlayer = $$('.slot[data-side="player"]');
  const slotsEnemy  = $$('.slot[data-side="enemy"]');

  const roundNoEl = $('#roundNo');
  const pCoinsEl = $('#pCoins'), eCoinsEl = $('#eCoins');
  const pScoreEl = $('#pScore'), eScoreEl = $('#eScore');

  const endOverlay = $('#endOverlay'); const endTitle = $('#endTitle'); const endLine = $('#endLine');
  const zoomOverlay = $('#zoomOverlay'); const zoomWrap = $('#zoomCardWrap');

  const againBtn = $('#againBtn');
  const passBtn = $('#passBtn');
  const resetBtn = $('#resetBtn');

  // ---------- Estado ----------
  const SLOTS = 3, HAND_SIZE = 5;
  const state = {
    round: 1, pCoins: 3, eCoins: 3, pScore: 0, eScore: 0,
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    center: Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn: 'player', playerPassed:false, enemyPassed:false, resolving:false
  };

  // ---------- Cartas fijas (stats aleatorios al cargar, luego se mantienen) ----------
  const CARDS = [
    { name:'Spiderman', art:'assets/Spiderman.png',  cost: rand(1,4), pts: rand(2,6), text:"Lorem ipsum dolor sit amet." },
    { name:'Leonardo',  art:'assets/Leonardo.PNG',   cost: rand(1,4), pts: rand(2,6), text:"Lorem ipsum dolor sit amet." },
    { name:'Shepard',   art:'assets/Shepard.JPG',    cost: rand(1,4), pts: rand(2,6), text:"Lorem ipsum dolor sit amet." },
    { name:'Geralt',    art:'assets/Geralt.JPG',     cost: rand(1,4), pts: rand(2,6), text:"Lorem ipsum dolor sit amet." },
    { name:'Jill',      art:'assets/Jill.JPG',       cost: rand(1,4), pts: rand(2,6), text:"Lorem ipsum dolor sit amet." }
  ];

  const tokenCost = v => `<div class="token t-cost">${v}</div>`;
  const tokenPts  = v => `<div class="token t-pts">${v}</div>`;
  const artHTML = src => `<div class="art">${src?`<img src="${src}" alt="">`:''}</div>`;

  function drawToHand(){
    while(state.pHand.length<HAND_SIZE && state.pDeck.length) state.pHand.push(state.pDeck.pop());
    while(state.eHand.length<HAND_SIZE && state.eDeck.length) state.eHand.push(state.eDeck.pop());
  }

  // ---------- Zoom ----------
  function openZoom(card){
    zoomWrap.innerHTML = `
      <div class="zoom-card">
        <div class="art">${card.art?`<img src="${card.art}" alt="${card.name}">`:''}</div>
        <div class="zoom-token cost">${card.cost}</div>
        <div class="zoom-token pts">${card.pts}</div>
        <div class="name">${card.name}</div>
        <div class="desc">${card.text}</div>
      </div>`;
    zoomOverlay.classList.add('visible');
  }
  function closeZoom(){ zoomOverlay.classList.remove('visible'); }
  zoomOverlay.addEventListener('click', e=>{ if(!e.target.closest('.zoom-card')) closeZoom(); });

  // ---------- Mano (creación) ----------
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

  // ===== Distribución de la mano: centrada y blindada =====
  function layoutHand(){
    const n = handEl.children.length;
    if (!n) return;

    const contRect = handEl.getBoundingClientRect();
    const contW = contRect.width;
    const first = handEl.children[0];
    const cardW = first ? first.getBoundingClientRect().width : 0;
    if (!contW || !cardW){ requestAnimationFrame(layoutHand); return; }

    // Centro del tablero relativo a la mano
    const boardEl = document.querySelector('.board');
    const boardRect = boardEl ? boardEl.getBoundingClientRect() : contRect;
    const targetCenter = (boardRect.left - contRect.left) + boardRect.width/2;

    const EDGE = 6;
    const BASE_GAP = 14;
    const MIN_GAP  = -Math.round(cardW * 0.65);

    const maxTotal = contW - EDGE*2;

    let gap = BASE_GAP;
    let totalW = n*cardW + (n-1)*gap;
    if (totalW > maxTotal){
      gap = (maxTotal - n*cardW) / (n-1);
      if (gap < MIN_GAP) gap = MIN_GAP;
      totalW = n*cardW + (n-1)*gap;
    }

    let startX = targetCenter - totalW/2;
    if (startX < EDGE) startX = EDGE;
    if (startX + totalW > contW - EDGE) startX = contW - EDGE - totalW;

    const mid = (n - 1) / 2;
    [...handEl.children].forEach((el, i) => {
      const centerX = startX + i*(cardW + gap) + cardW/2;
      const tx = Math.round(centerX - contW/2);
      el.style.setProperty('--x', `${tx}px`);
      el.style.setProperty('--off', `0px`);
      el.style.setProperty('--rot', `${(i - mid) * 1.8}deg`);
      el.style.zIndex = 10 + i;
    });
  }

  function renderHand(){
    handEl.innerHTML='';
    const n = state.pHand.length;
    state.pHand.forEach((c,i)=> handEl.appendChild(createHandCardEl(c,i,n)));
    layoutHand();
  }

  // ---------- Tablero ----------
  function renderBoard(){
    // Ajustado a 3 huecos por lado (0..2)
    for(let i=0;i<3;i++){
      const ps=slotsPlayer[i], es=slotsEnemy[i];
      if (!ps || !es) continue;
      ps.innerHTML=''; es.innerHTML='';
      const p=state.center[i].p, e=state.center[i].e;
      if(p){
        const d=document.createElement('div');
        d.className='placed';
        d.innerHTML = `${artHTML(p.art)}${tokenPts(p.pts)}<div class="name-top">${p.name}</div><div class="desc">${p.text}</div>`;
        d.addEventListener('click', ()=> openZoom(p));
        ps.appendChild(d);
      }
      if(e){
        const d=document.createElement('div');
        d.className='placed enemy';
        d.innerHTML = `${artHTML(e.art)}${tokenPts(e.pts)}<div class="name-top">${e.name}</div><div class="desc">${e.text}</div>`;
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
  function attachDragHandlers(el){ el.addEventListener('pointerdown', onDown, {passive:false}); }
  function onDown(e){
    if(state.turn!=='player'||state.resolving) return;
    const src=e.currentTarget; src.setPointerCapture(e.pointerId);
    ghost=document.createElement('div'); ghost.className='ghost';
    ghost.innerHTML=`${artHTML(src.dataset.art)}${tokenCost(src.dataset.cost)}${tokenPts(src.dataset.pts)}<div class="name-top">${src.dataset.name}</div><div class="desc">${src.dataset.text}</div>`;
    document.body.appendChild(ghost); moveGhost(e.clientX,e.clientY);
    const move=ev=> moveGhost(ev.clientX,ev.clientY);
    const up=ev=>{
      src.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up,true);
      const lane = laneUnder(ev.clientX,ev.clientY);
      if(lane!==-1) tryPlayFromHandToSlot(+src.dataset.index,lane);
      ghost.remove(); ghost=null;
    };
    window.addEventListener('pointermove',move,{passive:false});
    window.addEventListener('pointerup',up,{passive:false,capture:true});
    e.preventDefault();
  }
  const moveGhost=(x,y)=>{ if(!ghost) return; ghost.style.left=x+'px'; ghost.style.top=y+'px'; }
  function laneUnder(x,y){
    // Solo 3 slots del lado del jugador
    for(let i=0;i<3;i++){
      const r=document.querySelector(`.slot[data-side="player"][data-lane="${i}"]`).getBoundingClientRect();
      if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) return i;
    }
    return -1;
  }

  // ---------- Reglas ----------
  const canAfford = c => state.pCoins>=c.cost;
  function tryPlayFromHandToSlot(handIndex, slotIndex){
    if(handIndex<0||handIndex>=state.pHand.length) return;
    const card=state.pHand[handIndex];
    if(!canAfford(card)) return;
    state.pCoins -= card.cost;
    state.center[slotIndex].p = {...card};
    state.pHand.splice(handIndex,1);
    if(state.pDeck.length) state.pHand.push(state.pDeck.pop());
    renderHand(); renderBoard(); updateHUD();
  }

  // ---------- IA rival ----------
  function enemyTurn(){
    state.resolving=true; state.enemyPassed=false; state.eCoins+=1; updateHUD();
    showTurnToast('TURNO RIVAL');
    const canPlay=()=> state.eHand.some(c=>c.cost<=state.eCoins);
    const tryPlayOnce=()=>{
      if(!canPlay()) return false;
      let best=-1,score=-1;
      state.eHand.forEach((c,i)=>{ if(c.cost<=state.eCoins){ const s=c.pts*2-c.cost; if(s>score){score=s; best=i;} }});
      const card=state.eHand[best];
      let target=-1;
      for(let i=0;i<3;i++){ if(!state.center[i].e){ target=i; break; } }
      if(target===-1) return false;
      state.eCoins-=card.cost; state.center[target].e={...card};
      state.eHand.splice(best,1); if(state.eDeck.length) state.eHand.push(state.eDeck.pop());
      renderBoard(); updateHUD(); return true;
    };
    const loop=()=>{ if(!tryPlayOnce()){ state.enemyPassed=true; setTimeout(()=>{state.resolving=false; checkBothPassedThenScore();},500); return; } setTimeout(loop,200); };
    loop();
  }

  // ---------- Fin de partida ----------
  function endGame(){
    state.resolving = true;
    let title = 'Empate';
    if(state.pScore > state.eScore) title = '¡Victoria!';
    else if(state.eScore > state.pScore) title = 'Derrota';
    endTitle.textContent = title;
    endLine.textContent = `Puntos — Tú: ${state.pScore} · Rival: ${state.eScore}`;
    endOverlay.classList.add('visible');
  }

  // ---------- Puntuación ----------
  const bothPassed=()=> state.playerPassed && state.enemyPassed;
  function scoreTurn(){
    let p=0,e=0; state.center.forEach(c=>{ if(c.p) p+=c.p.pts; if(c.e) e+=c.e.pts; });
    state.pScore+=p; state.eScore+=e; updateHUD();
    if(state.round === 8){ setTimeout(endGame, 300); return; }
    state.round+=1; state.playerPassed=false; state.enemyPassed=false; state.turn='player'; state.pCoins+=1;
    drawToHand(); roundNoEl.textContent = state.round; setTimeout(()=> showTurnToast('TU TURNO'), 250);
  }
  function checkBothPassedThenScore(){ if(bothPassed()) scoreTurn(); }

  // ---------- Nueva partida ----------
  function newGame(){
    state.round=1; state.pCoins=3; state.eCoins=3; state.pScore=0; state.eScore=0;
    state.playerPassed=false; state.enemyPassed=false; state.turn='player';
    state.center=Array.from({length:3},()=>({p:null,e:null}));
    state.pDeck = [...CARDS].sort(()=> Math.random()-0.5);
    state.eDeck = [...CARDS].sort(()=> Math.random()-0.5);
    state.pHand=[]; state.eHand=[];
    drawToHand(); state.pCoins+=1;
    renderBoard(); renderHand(); updateHUD();
    showTurnToast('TU TURNO');
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

  // ---------- Eventos ----------
  againBtn.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  resetBtn.addEventListener('click', ()=> newGame());
  passBtn.addEventListener('click', ()=>{
    if(state.turn!=='player'||state.resolving) return;
    state.playerPassed=true; state.turn='enemy'; enemyTurn();
  });

  // Recalcular distribución en cambios de tamaño/orientación
  window.addEventListener('resize', layoutHand);
  window.addEventListener('orientationchange', layoutHand);

  // Arrancar juego
  window.addEventListener('DOMContentLoaded', newGame);
})();