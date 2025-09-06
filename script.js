(() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const rand = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;

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

  const SLOTS = 3, HAND_SIZE = 5;
  const state = { round:1, pCoins:3, eCoins:3, pScore:0, eScore:0,
    pDeck:[], eDeck:[], pHand:[], eHand:[],
    center:Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn:'player', playerPassed:false, enemyPassed:false, resolving:false };

  const SPIDEY = { name:'Spiderman', cost:3, pts:6, art:'assets/Spiderman.png' };

  const tokenCost = v => `<div class="token t-cost">${v}</div>`;
  const tokenPts  = v => `<div class="token t-pts">${v}</div>`;
  const artHTML = src => `<div class="art">${src?`<img src="${src}">`:''}</div>`;

  function makeRandomCard(){ const cost=rand(1,4), pts=rand(cost+1,cost+5); return {name:'',cost,pts,art:''}; }
  function makeDeckRandom(n=30){ const d=[]; for(let i=0;i<n;i++) d.push(makeRandomCard()); return d.sort(()=>Math.random()-0.5); }
  function drawToHand(){ while(state.pHand.length<HAND_SIZE&&state.pDeck.length) state.pHand.push(state.pDeck.pop()); while(state.eHand.length<HAND_SIZE&&state.eDeck.length) state.eHand.push(state.eDeck.pop()); }

  function openZoom(card){
    zoomWrap.innerHTML = `
      <div class="zoom-card">
        <div class="art">${card.art?`<img src="${card.art}" alt="${card.name}">`:''}</div>
        <div class="name">${card.name||'Carta'}</div>
      </div>`;
    zoomOverlay.classList.add('visible');
  }
  function closeZoom(){ zoomOverlay.classList.remove('visible'); }
  zoomOverlay.addEventListener('click', e=>{ if(!e.target.closest('.zoom-card')) closeZoom(); });

  function createHandCardEl(card,i,n){
    const el=document.createElement('div');
    el.className='card'; el.dataset.index=i;
    el.dataset.cost=card.cost; el.dataset.pts=card.pts;
    el.dataset.name=card.name||''; el.dataset.art=card.art||'';
    el.innerHTML=`${artHTML(card.art)}${tokenCost(card.cost)}${tokenPts(card.pts)}<div class="label">${card.name||'Carta'}</div>`;
    el.addEventListener('click', ()=> openZoom(card));
    attachDragHandlers(el); return el;
  }
  function renderHand(){ handEl.innerHTML=''; const n=state.pHand.length; state.pHand.forEach((c,i)=> handEl.appendChild(createHandCardEl(c,i,n))); }

  function renderBoard(){
    for(let i=0;i<SLOTS;i++){
      const ps=slotsPlayer[i], es=slotsEnemy[i]; ps.innerHTML=''; es.innerHTML='';
      const p=state.center[i].p, e=state.center[i].e;
      if(p){ const d=document.createElement('div'); d.className='placed'; d.innerHTML=`${artHTML(p.art)}${tokenPts(p.pts)}<div class="name">${p.name||''}</div>`; d.addEventListener('click', ()=> openZoom(p)); ps.appendChild(d); }
      if(e){ const d=document.createElement('div'); d.className='placed enemy'; d.innerHTML=`${artHTML(e.art)}${tokenPts(e.pts)}<div class="name">${e.name||''}</div>`; d.addEventListener('click', ()=> openZoom(e)); es.appendChild(d); }
    }
  }

  function updateHUD(){ roundNoEl.textContent=state.round; pCoinsEl.textContent=state.pCoins; eCoinsEl.textContent=state.eCoins; pScoreEl.textContent=state.pScore; eScoreEl.textContent=state.eScore; }
  function setBanner(t){ phaseBanner.textContent=t; }

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

  const canAfford = c => state.pCoins>=c.cost;

  function tryPlayFromHandToSlot(handIndex, slotIndex){
    const card=state.pHand[handIndex]; if(!card||!canAfford(card)) return;
    state.pCoins -= card.cost; state.center[slotIndex].p = {...card};
    state.pHand.splice(handIndex,1); if(state.pDeck.length) state.pHand.push(state.pDeck.pop());
    renderHand(); renderBoard(); updateHUD();
  }

  function enemyTurn(){
    state.resolving=true; state.enemyPassed=false; state.eCoins+=1; updateHUD();
    const canPlay=()=> state.eHand.some(c=>c.cost<=state.eCoins);
    if(canPlay()){ const card=state.eHand.pop(); state.center.find(s=>!s.e).e=card; state.eCoins-=card.cost; }
    renderBoard(); updateHUD();
    state.enemyPassed=true; setTimeout(()=>{state.resolving=false; checkBothPassedThenScore();},600);
  }

  function scoreTurn(){
    let p=0,e=0; state.center.forEach(c=>{ if(c.p) p+=c.p.pts; if(c.e) e+=c.e.pts; });
    state.pScore+=p; state.eScore+=e; updateHUD();
    state.round+=1; state.playerPassed=false; state.enemyPassed=false; state.turn='player'; state.pCoins+=1;
    drawToHand(); setBanner('Nueva ronda');
  }
  function checkBothPassedThenScore(){ if(state.playerPassed && state.enemyPassed) scoreTurn(); }

  function newGame(){
    state.round=1; state.pCoins=3; state.eCoins=3; state.pScore=0; state.eScore=0;
    state.center=Array.from({length:SLOTS},()=>({p:null,e:null}));
    state.pDeck=makeDeckRandom(30); state.pHand=[{...SPIDEY}]; drawToHand();
    state.eDeck=makeDeckRandom(30); state.eHand=[]; drawToHand();
    renderBoard(); renderHand(); updateHUD();
    setBanner('Arrastra cartas