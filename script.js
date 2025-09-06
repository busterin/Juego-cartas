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

  const startOverlay = $('#startOverlay');
  const endOverlay = $('#endOverlay'); const endTitle = $('#endTitle'); const endLine = $('#endLine');
  const zoomOverlay = $('#zoomOverlay'); const zoomWrap = $('#zoomCardWrap');

  const passBtn = $('#passBtn'); const resetBtn = $('#resetBtn');

  // ---------- State ----------
  const SLOTS = 4, HAND_SIZE = 5;
  const state = {
    round: 1, pCoins: 3, eCoins: 3, pScore: 0, eScore: 0,
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    center: Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn: 'player', playerPassed:false, enemyPassed:false, resolving:false
  };

  // ---------- Cards ----------
  const SPIDEY = { name:'Spiderman', cost:3, pts:6, art:'assets/Spiderman.png' };

  const tokenCost = v => `<div class="token t-cost">${v}</div>`;
  const tokenPts  = v => `<div class="token t-pts">${v}</div>`;
  const artHTML = src => `<div class="art">${src?`<img src="${src}" alt="">`:''}</div>`;

  function makeRandomCard(){ const cost=rand(1,4), pts=rand(cost+1,cost+5); return {name:'',cost,pts,art:''}; }
  function makeDeckRandom(n=30){ const d=[]; for(let i=0;i<n;i++) d.push(makeRandomCard()); for(let i=d.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [d[i],d[j]]=[d[j],d[i]]; } return d; }
  function drawToHand(){ while(state.pHand.length<HAND_SIZE&&state.pDeck.length) state.pHand.push(state.pDeck.pop()); while(state.eHand.length<HAND_SIZE&&state.eDeck.length) state.eHand.push(state.eDeck.pop()); }

  // ===== ZOOM =====
  function openZoom(card){
    zoomWrap.innerHTML = `
      <div class="zoom-card">
        <div class="art">${card.art?`<img src="${card.art}" alt="${card.name}">`:''}</div>
        <div class="zoom-token cost">${card.cost}</div>
        <div class="zoom-token pts">${card.pts}</div>
        <div class="name">${card.name||'Carta'}</div>
      </div>
      <p class="muted">Arrastra desde la mano para jugarla.</p>
    `;
    zoomOverlay.classList.add('visible');
  }
  function closeZoom(){ zoomOverlay.classList.remove('visible'); }
  $('#closeZoomBtn').addEventListener('click', closeZoom);
  $('#zoomOverlay').addEventListener('click', e=>{ if(!e.target.closest('.zoom-panel')) closeZoom(); });

  // ===== Mano (abanico) =====
  function createHandCardEl(card,i,n){
    const el=document.createElement('div');
    el.className='card';
    el.dataset.index=i; el.dataset.cost=card.cost; el.dataset.pts=card.pts;
    el.dataset.name=card.name||''; el.dataset.art=card.art||'';
    el.innerHTML=`${artHTML(card.art)}${tokenCost(card.cost)}${tokenPts(card.pts)}<div class="label">${card.name||'Carta'}</div>`;
    const margin=8;
    const leftPct = (n===1)?50: margin + i*((100-margin*2)/(n-1));
    const mid=(n-1)/2, angle=(i-mid)*10, extra=(i-mid)*14;
    el.style.setProperty('--x',`calc(${leftPct}% - 50%)`);
    el.style.setProperty('--rot',`${angle}deg`);
    el.style.setProperty('--off',`${extra}px`);
    el.addEventListener('click', ()=> openZoom({name:el.dataset.name||'Carta', cost:+el.dataset.cost, pts:+el.dataset.pts, art:el.dataset.art||''}));
    attachDragHandlers(el);
    return el;
  }
  function renderHand(){ handEl.innerHTML=''; const n=state.pHand.length; state.pHand.forEach((c,i)=> handEl.appendChild(createHandCardEl(c,i,n))); }

  // ===== Board =====
  function renderBoard(){
    for(let i=0;i<SLOTS;i++){
      const ps=slotsPlayer[i], es=slotsEnemy[i]; ps.innerHTML=''; es.innerHTML='';
      const p=state.center[i].p, e=state.center[i].e;
      if(p){ const d=document.createElement('div'); d.className='placed'; d.innerHTML=`${artHTML(p.art)}${tokenCost(p.cost)}${tokenPts(p.pts)}<div class="name">${p.name||''}</div>`; ps.appendChild(d); }
      if(e){ const d=document.createElement('div'); d.className='placed enemy'; d.innerHTML=`${artHTML(e.art)}${tokenCost(e.cost)}${tokenPts(e.pts)}<div class="name">${e.name||''}</div>`; es.appendChild(d); }
    }
  }

  function updateHUD(){ roundNoEl.textContent=state.round; pCoinsEl.textContent=state.pCoins; eCoinsEl.textContent=state.eCoins; pScoreEl.textContent=state.pScore; eScoreEl.textContent=state.eScore; }
  function setBanner(t){ phaseBanner.textContent=t; }

  // ===== Drag & drop =====
  let ghost=null;
  function attachDragHandlers(el){ el.addEventListener('pointerdown', onDown, {passive:false}); }
  function onDown(e){
    if(state.turn!=='player'||state.resolving) return;
    const src=e.currentTarget; src.setPointerCapture(e.pointerId);
    ghost=document.createElement('div'); ghost.className='ghost';
    ghost.innerHTML=`${artHTML(src.dataset.art)}${tokenCost(src.dataset.cost)}${tokenPts(src.dataset.pts)}<div class="label">${src.dataset.name||'Carta'}</div>`;
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
  function laneUnder(x,y){ for(let i=0;i<SLOTS;i++){ const r=slotsPlayer[i].getBoundingClientRect(); if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) return i; } return -1; }

  // ===== Reglas =====
  const canAfford = c => state.pCoins>=c.cost;
  const playerOccupancy = ()=> state.center.filter(c=>!!c.p).length;
  const enemyOccupancy  = ()=> state.center.filter(c=>!!c.e).length;

  function tryPlayFromHandToSlot(handIndex, slotIndex){
    if(handIndex<0||handIndex>=state.pHand.length) return;
    const card=state.pHand[handIndex];
    if(!canAfford(card)) return;
    const slot=state.center[slotIndex];
    if(!slot.p && playerOccupancy()>=SLOTS) return;
    state.pCoins -= card.cost;
    state.center[slotIndex].p = {...card};
    state.pHand.splice(handIndex,1);
    if(state.pDeck.length) state.pHand.push(state.pDeck.pop());
    renderHand(); renderBoard(); updateHUD();
  }

  // ===== IA rival =====
  function enemyTurn(){
    state.resolving=true; state.enemyPassed=false; state.eCoins+=1; updateHUD();
    const canPlay=()=> state.eHand.some(c=>c.cost<=state.eCoins) && enemyOccupancy()<SLOTS;
    const tryPlayOnce=()=>{
      if(!canPlay()) return false;
      let best=-1,score=-1;
      state.eHand.forEach((c,i)=>{ if(c.cost<=state.eCoins){ const s=c.pts*2-c.cost; if(s>score){score=s; best=i;} }});
      const card=state.eHand[best];
      let target=-1, worst=-1, wp=Infinity;
      for(let i=0;i<SLOTS;i++){ if(!state.center[i].e){ target=i; break; } }
      if(target===-1){
        for(let i=0;i<SLOTS;i++){ const e=state.center[i].e; if(e&&e.pts<wp){wp=e.pts; worst=i;} }
        if(card.pts>wp) target=worst; else return false;
      }
      state.eCoins-=card.cost; state.center[target].e={...card};
      state.eHand.splice(best,1); if(state.eDeck.length) state.eHand.push(state.eDeck.pop());
      renderBoard(); updateHUD(); return true;
    };
    const loop=()=>{ if(!tryPlayOnce()){ state.enemyPassed=true; setTimeout(()=>{state.resolving=false; checkBothPassedThenScore();},600); return; } setTimeout(loop,220); };
    loop();
  }

  // ===== Puntuación =====
  function floatScore(label,who){
    const d=document.createElement('div'); d.className=`score-float ${who}`; d.textContent=label;
    document.querySelector('.board').appendChild(d); setTimeout(()=>d.remove(),1100);
  }
  const bothPassed=()=> state.playerPassed && state.enemyPassed;
  function scoreTurn(){
    let p=0,e=0; state.center.forEach(c=>{ if(c.p) p+=c.p.pts; if(c.e) e+=c.e.pts; });
    if(p>0) floatScore(`+${p}`,'you'); if(e>0) floatScore(`+${e}`,'enemy');
    setTimeout(()=>{
      state.pScore+=p; state.eScore+=e; updateHUD();
      state.round+=1; state.playerPassed=false; state.enemyPassed=false; state.turn='player'; state.pCoins+=1;
      while(state.pHand.length<HAND_SIZE&&state.pDeck.length) state.pHand.push(state.pDeck.pop());
      while(state.eHand.length<HAND_SIZE&&state.eDeck.length) state.eHand.push(state.eDeck.pop());
      setBanner('Nueva ronda: juega cartas mientras tengas monedas');
    },400);
  }
  function checkBothPassedThenScore(){ if(bothPassed()) scoreTurn(); }

  // ===== New game =====
  function newGame(){
    state.round=1; state.pCoins=3; state.eCoins=3; state.pScore=0; state.eScore=0;
    state.playerPassed=false; state.enemyPassed=false; state.turn='player';
    state.center=Array.from({length:SLOTS},()=>({p:null,e:null}));

    state.pDeck=makeDeckRandom(30);
    state.pHand=[{...SPIDEY}]; drawToHand();

    state.eDeck=makeDeckRandom(30);
    state.eHand=[]; drawToHand();

    state.pCoins+=1;

    renderBoard(); renderHand(); updateHUD();
    setBanner('Arrastra cartas a tus huecos (4 por lado)');
  }

  // Events
  $('#startBtn').addEventListener('click', ()=>{ startOverlay.classList.remove('visible'); newGame(); });
  $('#againBtn').addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  $('#menuBtn').addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); startOverlay.classList.add('visible'); });
  resetBtn.addEventListener('click', ()=> newGame());
  passBtn.addEventListener('click', ()=>{
    if(state.turn!=='player'||state.resolving) return;
    state.playerPassed=true; state.turn='enemy'; enemyTurn();
  });
})();