(() => {
  // ---------- Utils ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

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

  const drawOverlay = $('#drawOverlay');
  const drawCardEl  = $('#drawCard');

  // ---------- Estado ----------
  const SLOTS = 3, HAND_SIZE = 4;
  const state = {
    round: 1, pCoins: 3, eCoins: 3, pScore: 0, eScore: 0,
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    center: Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn: 'player', playerPassed:false, enemyPassed:false, resolving:false
  };

  // ---------- Cartas fijas ----------
  const CARDS = [
    { name:'Guerrera', art:'assets/Guerrera.PNG',  cost:3, pts:5, text:"Lidera la carga con fuerza indomable." },
    { name:'Maga',     art:'assets/Maga.PNG',      cost:2, pts:4, text:"Canaliza energías arcanas a tu favor." },
    { name:'Arquero',  art:'assets/Arquero.PNG',   cost:1, pts:3, text:"Dispara con precisión quirúrgica." },
    { name:'Sanadora', art:'assets/Sanadora.PNG',  cost:2, pts:2, text:"Restaura y protege a los tuyos." },
    { name:'Bardo',    art:'assets/Bardo.PNG',     cost:1, pts:2, text:"Inspira y desarma con melodías." }
  ];

  const tokenCost = v => `<div class="token t-cost">${v}</div>`;
  const tokenPts  = v => `<div class="token t-pts">${v}</div>`;
  const artHTML = src => `<div class="art">${src?`<img src="${src}" alt="">`:''}</div>`;

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
  const first = handEl.children[0];
  const cardW = first ? first.getBoundingClientRect().width : 0;
  if (!contW || !cardW) return;

  const EDGE = 8;

  // === NUEVO: alinear 1ª carta con el oso ===
  const bearEl = document.querySelector('.portrait.player .frame.hex');
  let startCenter;
  if (bearEl){
    const bearLeftInHand = bearEl.getBoundingClientRect().left - contRect.left;
    // Queremos que el borde IZQUIERDO de la 1ª carta coincida con el emoji del oso:
    // centro = (borde_izq) + (ancho_carta/2)
    startCenter = bearLeftInHand + cardW / 2;
  } else {
    // Fallback por si no existe el ancla (raro)
    startCenter = EDGE + cardW / 2;
  }
  // Clamp para que no se salga a la izquierda
  startCenter = Math.max(EDGE + cardW/2, startCenter);

  // El resto NO cambia: calculamos el centro máximo permitido y distribuimos
  const endCenter = Math.max(startCenter, contW - EDGE - cardW/2);

  let centers = [];
  if (n === 1){
    centers = [ (startCenter + endCenter) / 2 ];
  } else {
    const step = (endCenter - startCenter) / (n - 1);
    for (let i = 0; i < n; i++) centers.push(startCenter + i*step);
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
    setTimeout(layoutHand, 50);
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

  // ---------- Animación de Robo ----------
  function showDraw(card, cb){
    drawCardEl.innerHTML = `
      <div class="art"><img src="${card.art}" alt=""></div>
      <div class="token t-cost">${card.cost}</div>
      <div class="token t-pts">${card.pts}</div>
      <div class="name">${card.name}</div>
    `;
    drawOverlay.classList.add('visible');
    setTimeout(()=>{
      drawOverlay.classList.remove('visible');
      if(cb) setTimeout(cb, 250);
    }, 800);
  }

  function flyCardToHand(card, onDone){
    // Asegura que la carta existe ya en la mano (última posición) para medir destino
    const idx = state.pHand.length - 1;
    const targetEl = handEl.children[idx];
    if(!targetEl){ if(onDone) onDone(); return; }
    const r = targetEl.getBoundingClientRect();
    const targetX = r.left + r.width/2;
    const targetY = r.top  + r.height/2;

    // Oculta la real mientras vuela el clon
    targetEl.style.opacity = '0';

    const fly = document.createElement('div');
    fly.className = 'fly-card';
    fly.innerHTML = `<div class="art"><img src="${card.art}" alt=""></div>`;
    document.body.appendChild(fly);

    const startX = window.innerWidth/2;
    const startY = window.innerHeight/2;

    // Tamaño final relativo: escalar desde ancho fly a ancho target
    const flyW = parseFloat(getComputedStyle(fly).width);
    const scale = r.width / flyW;

    // Posición inicial ya está centrada; animamos a destino
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
    }, 480);
  }

  // Dibuja 1 carta con animación completa: centro → a mano
  function drawOneAnimated(cb){
    if(!state.pDeck.length){ if(cb) cb(); return; }
    const card = state.pDeck.pop();
    showDraw(card, ()=>{
      // añade a mano y renderiza para medir destino
      state.pHand.push(card);
      renderHand();
      // vuela desde centro a su hueco (última carta)
      flyCardToHand(card, cb);
    });
  }

  // Rellena la mano hasta HAND_SIZE con animación (jugador)
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
    for(let i=0;i<3;i++){
      const el = document.querySelector(`.slot[data-side="player"][data-lane="${i}"]`);
      if(!el) continue;
      const r = el.getBoundingClientRect();
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
    renderHand(); renderBoard(); updateHUD();

    // Roba 1 animada si hay cartas en mazo
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

  // ---------- Fin de partida / Puntuación ----------
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
    let p=0,e=0; state.center.forEach(c=>{ if(c.p) p+=c.p.pts; if(c.e) e+=c.e.pts; });
    state.pScore+=p; state.eScore+=e; updateHUD();
    if(state.round === 8){ setTimeout(endGame, 300); return; }

    state.round+=1; state.playerPassed=false; state.enemyPassed=false; state.turn='player'; state.pCoins+=1;

    // Relleno manos: enemigo instantáneo, jugador animado
    topUpEnemyInstant();
    topUpPlayerAnimated(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      setTimeout(()=> showTurnToast('TU TURNO'), 200);
    });
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
    renderBoard(); renderHand(); updateHUD();

    // Relleno inicial: IA instantánea, jugador con animación
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

  // ---------- Eventos ----------
  againBtn.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  resetBtn.addEventListener('click', ()=> newGame());
  passBtn.addEventListener('click', ()=>{
    if(state.turn!=='player'||state.resolving) return;
    state.playerPassed=true; state.turn='enemy'; enemyTurn();
  });

  window.addEventListener('resize', layoutHandSafe);
  window.addEventListener('orientationchange', layoutHandSafe);

  // Arranque con portada
  window.addEventListener('DOMContentLoaded', ()=>{
    const startOv = document.getElementById('startOverlay');
    const startBtn = document.getElementById('startBtn');
    if(startBtn){
      startBtn.addEventListener('click', ()=>{
        startOv.classList.remove('visible');
        newGame();
      });
    }else{
      newGame();
    }
  });
})();