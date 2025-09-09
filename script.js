(() => {
  // ---------- Utils ----------
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const uid = (()=>{ let n=1; return ()=> n++; })();

  // ---------- DOM ----------
  const handEl = $('#hand');
  const roundNoEl = $('#roundNo');
  const pCoinsEl = $('#pCoins'), eCoinsEl = $('#eCoins');
  const pScoreEl = $('#pScore'), eScoreEl = $('#eScore'); // VIDA

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

  // Botón ATACAR dinámico
  const bottomBar = document.querySelector('.bottom-bar');
  let attackBtn = document.getElementById('attackBtn');
  if(!attackBtn && bottomBar){
    attackBtn = document.createElement('button');
    attackBtn.id = 'attackBtn';
    attackBtn.className = 'btn primary';
    attackBtn.textContent = 'ATACAR';
    attackBtn.style.display = 'none';
    bottomBar.insertBefore(attackBtn, passBtn);
  }

  // Inyecta CSS para shake fuerte si no existe
  (function injectShakeCSS(){
    if(document.getElementById('shakeCSS')) return;
    const css = `
      .placed.shake-hard{ animation: shakeHard .48s cubic-bezier(.36,.07,.19,.97) both; }
      @keyframes shakeHard {
        10% { transform: translate(-1px, -2px) rotate(-0.5deg) scale(1.02); filter: brightness(1.1); }
        20% { transform: translate(3px, 0px) rotate(0.6deg) scale(1.03); }
        30% { transform: translate(-5px, 2px) rotate(-0.8deg) }
        40% { transform: translate(4px, -1px) rotate(0.6deg) }
        50% { transform: translate(-3px, 1px) rotate(-0.6deg) }
        60% { transform: translate(3px, 1px) rotate(0.4deg) }
        70% { transform: translate(-2px, -1px) rotate(-0.3deg) }
        80% { transform: translate(1px, 1px) rotate(0.2deg) }
        90% { transform: translate(-1px, 0px) rotate(-0.1deg) }
        100%{ transform: translate(0,0) rotate(0) scale(1); filter: brightness(1); }
      }
      /* reutilizamos .targetable también para resaltar atacantes */
      .slot.targetable{
        outline: 2px solid rgba(255,120,120,.9);
        outline-offset: -2px;
        box-shadow: 0 0 0 3px rgba(255,120,120,.25) inset, 0 6px 18px rgba(255,0,0,.25);
        cursor: pointer;
      }
    `;
    const st = document.createElement('style');
    st.id = 'shakeCSS';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  // ---------- Estado ----------
  const SLOTS = 6;         // 3 columnas x 2 filas por lado
  const HAND_SIZE = 4;

  const state = {
    round: 1,
    pCoins: 3, eCoins: 3,
    pScore: 10, eScore: 10,       // VIDA inicial 10
    pDeck: [], eDeck: [], pHand: [], eHand: [],
    center: Array.from({length:SLOTS},()=>({p:null,e:null})),
    turn: 'player',
    playerPassed:false, enemyPassed:false,
    resolving:false,
    drawing:false,
    // Ataques por turno
    pAttacked: Array(SLOTS).fill(false),  // tu carta en índice i ya atacó este turno
    // Targeting/ataque manual
    targeting:false,
    attackCtx: null, // { step:'chooseAttacker'|'chooseTarget', attIndex:number, targets:number[] }
    timers: { draw:null, toast:null, type:null }
  };

  // ---------- Definición de cartas ----------
  const BASE_CARDS = [
    { name:'Guerrera', art:'assets/Guerrera.PNG',  cost:3, pts:5, text:"Cuando la colocas enfrente de una carta rival, la destruye automáticamente." },
    { name:'Maga',     art:'assets/Maga.PNG',      cost:2, pts:4, text:"Canaliza energías arcanas a tu favor." },
    { name:'Arquero',  art:'assets/Arquero.PNG',   cost:1, pts:3, text:"Dispara con precisión quirúrgica." },
    { name:'Sanadora', art:'assets/Sanadora.PNG',  cost:2, pts:2, text:"Restaura y protege a los tuyos." },
    { name:'Bardo',    art:'assets/Bardo.PNG',     cost:1, pts:2, text:"Inspira y desarma con melodías." }
  ];
  const makeDeck = () => BASE_CARDS.map(c=>({...c, id:uid()})).sort(()=> Math.random()-0.5);

  const tokenCost = v => `<div class="token t-cost">${v}</div>`;
  const tokenPts  = v => `<div class="token t-pts">${v}</div>`;
  const artHTML   = src => `<div class="art">${src?`<img src="${src}" alt="">`:''}</div>`;

  // ---------- Limpieza de nodos temporales ----------
  function purgeTransientNodes(){
    document.querySelectorAll('.fly-card, .ghost').forEach(n=>n.remove());
    drawOverlay?.classList.remove('visible');
  }

  // ---------- Zoom ----------
  function openZoom(card){
    if(state.targeting) return; // no zoom al seleccionar
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
  const closeZoom = ()=> zoomOverlay.classList.remove('visible');
  zoomOverlay?.addEventListener('click', e=>{ if(!e.target.closest('.zoom-card')) closeZoom(); });

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
  function createHandCardEl(card,i){
    const el=document.createElement('div');
    el.className='card';
    el.dataset.index=i; el.dataset.id=card.id;
    el.dataset.cost=card.cost; el.dataset.pts=card.pts;
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
    state.pHand.forEach((c,i)=> handEl.appendChild(createHandCardEl(c,i)));
    layoutHandSafe();
  }

  // ---------- Robo (vista grande + vuelo a mano) ----------
  function showDrawLarge(card){
    return new Promise(resolve=>{
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
      state.timers.draw && clearTimeout(state.timers.draw);
      state.timers.draw = setTimeout(()=>{
        drawOverlay.classList.remove('visible');
        setTimeout(resolve, 250);
      }, 900);
    });
  }

  function flyCardToHand(card){
    return new Promise(resolve=>{
      const idx = state.pHand.length - 1;
      const targetEl = handEl.children[idx];
      if(!targetEl){ resolve(); return; }

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
        resolve();
      }, 500);
    });
  }

  async function drawOneAnimated(){
    if(state.drawing) return false;
    if(!state.pDeck.length) return false;
    state.drawing = true;

    const card = state.pDeck.pop();
    await showDrawLarge(card);

    if(state.pHand.some(c => c.id === card.id)){
      state.drawing = false;
      return false;
    }

    state.pHand.push(card);
    renderHand();
    await flyCardToHand(card);

    state.drawing = false;
    return true;
  }

  async function topUpPlayerAnimated(){
    while(state.pHand.length < HAND_SIZE && state.pDeck.length){
      const ok = await drawOneAnimated();
      if(!ok) break;
    }
  }

  // Enemigo roba sin animación
  function topUpEnemyInstant(){
    while(state.eHand.length<Math.min(HAND_SIZE,5) && state.eDeck.length){
      const c = state.eDeck.pop();
      state.eHand.push(c);
    }
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
    pScoreEl.textContent=state.pScore; eScoreEl.textContent=state.eScore; // VIDA
  }

  // ---------- Utilidades combate ----------
  const columnOf = idx => idx % 3; // 3 columnas
  const indicesSameColumn = (col) => [0,1,2,3,4,5].filter(i => i%3===col);

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

  function hitEffectOn(el){
    if(!el) return;
    const placed = el.querySelector('.placed');
    if(!placed) return;
    placed.classList.add('hit');
    placed.classList.add('shake-hard');
    setTimeout(()=> placed.classList.remove('hit'), 360);
    setTimeout(()=> placed.classList.remove('shake-hard'), 500);
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

  // ---------- Ataques por turno (jugador) ----------
  function attackersAvailable(){
    const res=[];
    for(let i=0;i<SLOTS;i++){
      const pc = state.center[i].p;
      if(!pc || state.pAttacked[i]) continue;
      res.push(i);
    }
    return res;
  }

  function canAttackerDoSomething(attIndex){
    // Puede atacar aunque la columna esté vacía (haría daño directo)
    return !!state.center[attIndex].p && !state.pAttacked[attIndex];
  }

  function refreshAttackButton(){
    if(state.turn!=='player' || state.resolving) { attackBtn.style.display='none'; return; }
    const av = attackersAvailable();
    if(av.some(canAttackerDoSomething)) attackBtn.style.display='inline-block';
    else attackBtn.style.display='none';
  }

  // Targeting helpers
  function computeTargetsFor(attIndex){
    const col = columnOf(attIndex);
    const targets = indicesSameColumn(col).filter(i => state.center[i].e);
    return { col, targets };
  }

  function enterChooseAttacker(){
    state.targeting = true;
    state.attackCtx = { step:'chooseAttacker', attIndex:null, targets:[] };

    const playerSlots = $$('.slot[data-side="player"]');
    attackersAvailable().forEach(i=>{
      if(!canAttackerDoSomething(i)) return;
      const el = playerSlots[i];
      el.classList.add('targetable');
      const pick = (evt)=>{
        evt.stopPropagation(); evt.preventDefault();
        exitChooseAttacker();
        selectAttacker(i);
      };
      el._pickAttacker = pick;
      el.addEventListener('click', pick, {once:true});
    });
  }

  function exitChooseAttacker(){
    const playerSlots = $$('.slot[data-side="player"]');
    playerSlots.forEach(el=>{
      el.classList.remove('targetable');
      if(el._pickAttacker){
        el.removeEventListener('click', el._pickAttacker);
        delete el._pickAttacker;
      }
    });
  }

  function selectAttacker(attIndex){
    state.attackCtx = { step:'chooseTarget', attIndex, ...computeTargetsFor(attIndex) };
    const { targets } = state.attackCtx;
    if(!targets.length){
      // Daño directo
      const pts = state.center[attIndex].p?.pts || 0;
      applyDamage('enemy', pts);
      state.pAttacked[attIndex]=true;
      state.attackCtx = null; state.targeting=false;
      refreshAttackButton();
      return;
    }
    // Hay objetivos: marcar enemigos
    enterChooseTarget();
  }

  function enterChooseTarget(){
    const enemySlots = $$('.slot[data-side="enemy"]');
    state.attackCtx.targets.forEach(i=>{
      const el = enemySlots[i];
      if(!el) return;
      el.classList.add('targetable');
      const choose = (evt) => {
        evt.stopPropagation(); evt.preventDefault();
        exitChooseTarget();
        resolvePlayerAttack(state.attackCtx.attIndex, i);
      };
      el._chooseHandler = choose;
      el.addEventListener('click', choose, {once:true});
    });
  }

  function exitChooseTarget(){
    const enemySlots = $$('.slot[data-side="enemy"]');
    enemySlots.forEach(el=>{
      el.classList.remove('targetable');
      if(el._chooseHandler){
        el.removeEventListener('click', el._chooseHandler);
        delete el._chooseHandler;
      }
    });
  }

  function updatePlacedTokenValue(side, slotIndex, newPts){
    const slots = $$(side==='enemy' ? '.slot[data-side="enemy"]' : '.slot[data-side="player"]');
    const s = slots[slotIndex];
    const token = s?.querySelector('.token.t-pts');
    if(token){
      token.textContent = newPts;
      token.classList.add('damage');
      setTimeout(()=> token.classList.remove('damage'), 600);
    }
  }

  function resolvePlayerAttack(attIndex, defIndex){
    const pairA = state.center[attIndex];
    const pairD = state.center[defIndex];
    const attacker = pairA?.p;
    const defender = pairD?.e;
    if(!attacker || !defender){ state.attackCtx=null; state.targeting=false; refreshAttackButton(); return; }

    const attPts = attacker.pts;
    const defPts = defender.pts;

    const { es } = getSlotsEls(defIndex);
    hitEffectOn(es);

    if(attPts >= defPts){
      const diff = attPts - defPts;
      spawnExplosionOn(es);
      state.center[defIndex].e = null;
      renderBoard();
      applyDamage('enemy', diff);
    }else{
      const remaining = Math.max(0, defPts - attPts);
      state.center[defIndex].e = { ...defender, pts: remaining };
      renderBoard();
      updatePlacedTokenValue('enemy', defIndex, remaining);
    }

    state.pAttacked[attIndex]=true;
    state.attackCtx = null; state.targeting=false;
    refreshAttackButton();
  }

  attackBtn?.addEventListener('click', ()=>{
    if(state.resolving || state.turn!=='player') return;
    if(state.targeting) return;
    enterChooseAttacker();
  });

  // ---------- Drag & drop ----------
  let ghost=null;
  function attachDragHandlers(el){ el.addEventListener('pointerdown', onDown, {passive:false}); }
  function onDown(e){
    if(state.turn!=='player'||state.resolving||state.targeting) return;
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

  async function tryPlayFromHandToSlot(handIndex, slotIndex){
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
    state.pAttacked[slotIndex] = false; // nueva carta aún no ha atacado este turno

    // Daño directo si NO hay cartas enemigas en la columna
    const col = columnOf(slotIndex);
    const anyEnemyInColumn = indicesSameColumn(col).some(i => !!state.center[i].e);
    if(!anyEnemyInColumn){
      applyDamage('enemy', card.pts);
    }

    // Efecto Guerrera si justo enfrente hay carta
    if(card.name==='Guerrera' && state.center[slotIndex].e){
      const { es } = getSlotsEls(slotIndex);
      spawnExplosionOn(es);
      const defPts = state.center[slotIndex].e.pts;
      state.center[slotIndex].e = null;
      renderBoard();
      applyDamage('enemy', Math.max(0, card.pts - defPts));
    }

    // Roba 1 animada si hay mazo
    if(state.pDeck.length){
      await drawOneAnimated();
      renderHand(); updateHUD();
    }

    // Al terminar colocación, refrescar botón ATACAR para permitir usar
    refreshAttackButton();
  }

  // ---------- IA rival (se mantiene básica) ----------
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
      for(let i=0;i<SLOTS;i++){ if(!state.center[i].e){ target=i; break; } }
      if(target===-1) return false;

      state.eCoins-=card.cost; state.center[target].e={...card};
      state.eHand.splice(best,1); if(state.eDeck.length) state.eHand.push(state.eDeck.pop());
      renderBoard(); updateHUD();

      // Si no hay carta del jugador en la columna -> daño directo
      const col = columnOf(target);
      const anyPlayerInColumn = indicesSameColumn(col).some(i => !!state.center[i].p);
      if(!anyPlayerInColumn){
        applyDamage('player', card.pts);
      }else{
        // Confrontación simple contra mismo índice si hay carta
        const pair = state.center[target];
        if(pair.p && pair.e){
          const { ps } = getSlotsEls(target);
          hitEffectOn(ps);
          if(pair.e.pts >= pair.p.pts){
            const diff = pair.e.pts - pair.p.pts;
            const { ps:psEl } = getSlotsEls(target);
            spawnExplosionOn(psEl);
            pair.p = null;
            renderBoard();
            applyDamage('player', diff);
          }else{
            const rem = Math.max(0, pair.p.pts - pair.e.pts);
            pair.p = { ...pair.p, pts: rem };
            renderBoard();
            updatePlacedTokenValue('player', target, rem);
            const { ps:psEl2 } = getSlotsEls(target);
            hitEffectOn(psEl2);
          }
        }
      }

      return true;
    };

    const loop=()=>{ if(!tryPlayOnce()){ state.enemyPassed=true; setTimeout(()=>{state.resolving=false; checkBothPassedThenNextRound();},400); return; } setTimeout(loop,220); };
    loop();
  }

  // ---------- Rondas ----------
  const bothPassed=()=> state.playerPassed && state.enemyPassed;

  function nextRound(){
    state.round+=1;
    state.playerPassed=false; state.enemyPassed=false;
    state.turn='player';
    state.pCoins+=1;

    // Resetea ataques por turno de tus cartas
    state.pAttacked = Array(SLOTS).fill(false);

    topUpEnemyInstant();
    topUpPlayerAnimated().then(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      setTimeout(()=> showTurnToast('TU TURNO'), 200);
      refreshAttackButton();
    });
  }
  function checkBothPassedThenNextRound(){ if(!checkDefeat() && bothPassed()) nextRound(); }

  // ---------- Nueva partida ----------
  function clearTimers(){
    Object.keys(state.timers).forEach(k=>{
      if(state.timers[k]) clearTimeout(state.timers[k]);
      state.timers[k]=null;
    });
  }

  function newGame(){
    clearTimers();
    purgeTransientNodes();

    state.round=1; state.pCoins=3; state.eCoins=3;
    state.pScore=10; state.eScore=10;
    state.playerPassed=false; state.enemyPassed=false; state.turn='player';
    state.center=Array.from({length:SLOTS},()=>({p:null,e:null}));
    state.pDeck = makeDeck();
    state.eDeck = makeDeck();
    state.pHand=[]; state.eHand=[];
    state.pAttacked = Array(SLOTS).fill(false);
    state.attackCtx=null; state.targeting=false; state.drawing=false;

    renderBoard(); renderHand(); updateHUD();

    topUpEnemyInstant();
    topUpPlayerAnimated().then(()=>{
      renderHand(); layoutHandSafe(); updateHUD();
      showTurnToast('TU TURNO');
      refreshAttackButton();
    });
  }

  // ---------- Toast ----------
  function showTurnToast(text, ms=1200){
    const el = document.getElementById('turnToast');
    if(!el) return;
    el.textContent = text;
    el.classList.add('show');
    state.timers.toast && clearTimeout(state.timers.toast);
    state.timers.toast = setTimeout(()=> el.classList.remove('show'), ms);
  }

  // ---------- Intro ----------
  const INTRO_TEXT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec a diam lectus.";
  let typingIdx = 0;
  let typingRunning = false;

  function startIntro(){
    if(!introOv) { newGame(); return; }
    introTextEl && (introTextEl.textContent = "");
    introOv.classList.add('visible');
    introOv.setAttribute('aria-hidden','false');
    typingIdx = 0;
    typingRunning = true;
    if(introNext) introNext.disabled = true;

    const speed = 22;
    const run = () => {
      if (typingIdx < INTRO_TEXT.length){
        introTextEl && (introTextEl.textContent = INTRO_TEXT.slice(0, typingIdx+1));
        typingIdx++;
        state.timers.type = setTimeout(run, speed);
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
      clearTimeout(state.timers.type);
      introTextEl && (introTextEl.textContent = INTRO_TEXT);
      typingRunning = false;
      if(introNext) introNext.disabled = false;
      return;
    }
    introOv.classList.remove('visible');
    introOv.setAttribute('aria-hidden','true');
    newGame();
  }

  introNext?.addEventListener('click', skipOrContinueIntro);
  introOv?.addEventListener('click', (e)=>{
    if(e.target.closest('.intro-panel')) skipOrContinueIntro();
  });

  // ---------- Eventos ----------
  againBtn?.addEventListener('click', ()=>{ endOverlay.classList.remove('visible'); newGame(); });
  resetBtn?.addEventListener('click', ()=> newGame());
  passBtn?.addEventListener('click', ()=>{
    if(state.turn!=='player'||state.resolving||state.targeting) return;
    state.playerPassed=true; state.turn='enemy';
    attackBtn && (attackBtn.style.display='none');
    state.attackCtx=null; state.targeting=false;
    enemyTurn();
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