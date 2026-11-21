import { RULES, obstacleX } from './burgerRunRules.mjs';

function round(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function star(ctx, x, y, radius, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * 0.46 : radius; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function burger(ctx, state) {
  if (state.invulnerable && state.tick % 8 < 3) return;
  const x = state.x, y = state.y, stride = state.grounded ? Math.sin(state.tick * 0.4) * Math.min(5, Math.abs(state.vx) * 2) : 3;
  ctx.strokeStyle = '#522b27'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 12, y + 43); ctx.lineTo(x + 10 + stride, y + 55); ctx.moveTo(x + 32, y + 43); ctx.lineTo(x + 34 - stride, y + 55); ctx.stroke();
  round(ctx, x + 2 + stride, y + 52, 14, 6, 3, '#7c1e3f'); round(ctx, x + 28 - stride, y + 52, 14, 6, 3, '#7c1e3f');
  ctx.beginPath(); ctx.moveTo(x + 3, y + 26); ctx.lineTo(x - 4, y + 33 + stride); ctx.moveTo(x + 41, y + 26); ctx.lineTo(x + 49, y + 30 - stride); ctx.stroke();
  round(ctx, x, y + 12, 44, 19, [18, 18, 4, 4], '#f8ba53');
  round(ctx, x - 1, y + 30, 46, 6, 3, '#65b957'); round(ctx, x, y + 35, 44, 5, 2, '#eb5c52');
  round(ctx, x, y + 40, 44, 7, 3, '#6b392d');
  ctx.fillStyle = '#ffdb63'; ctx.beginPath(); ctx.moveTo(x + 2, y + 39); ctx.lineTo(x + 40, y + 39); ctx.lineTo(x + 31, y + 46); ctx.closePath(); ctx.fill();
  round(ctx, x, y + 46, 44, 6, 3, '#e99837');
  ctx.fillStyle = '#fff2bc'; for (const [dx, dy] of [[8,19],[19,15],[30,18],[36,24]]) { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 2, 1, -.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#36272e'; for (const dx of [15,29]) { ctx.beginPath(); ctx.arc(x + dx, y + 25, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#7c3c2b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 22, y + 27, 4, 0, Math.PI); ctx.stroke();
  round(ctx, x + 8, y + 3, 28, 11, 3, '#fff9e9');
  ctx.fillStyle = '#fff9e9'; for (const [dx,dy] of [[12,4],[22,0],[32,4]]) { ctx.beginPath(); ctx.arc(x + dx,y + dy,7,0,Math.PI*2);ctx.fill(); }
  ctx.fillStyle = '#8b2440';ctx.font='bold 7px system-ui';ctx.textAlign='center';ctx.fillText('HNC',x+22,y+11);
}
function food(ctx, f, tick) {
  const y = f.y + Math.sin(tick * .07 + f.id) * 3;
  if (f.kind === 2) { star(ctx, f.x, y, 14, '#ffd05e'); return; }
  if (f.kind === 0) {
    for (let i = 0; i < 5; i++) round(ctx, f.x - 11 + i * 5, y - 17 - i % 2 * 3, 4, 19, 1, '#ffd373');
    ctx.fillStyle = '#cc3f55'; ctx.beginPath();ctx.moveTo(f.x-14,y-4);ctx.lineTo(f.x+14,y-4);ctx.lineTo(f.x+10,y+14);ctx.lineTo(f.x-10,y+14);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 7px system-ui';ctx.textAlign='center';ctx.fillText('HNC',f.x,y+8);
  } else {
    round(ctx,f.x-10,y-13,20,28,4,'#ffa857');round(ctx,f.x-11,y-16,22,5,2,'#fff1cb');
    ctx.strokeStyle='#bb3659';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x+2,y-12);ctx.lineTo(f.x+7,y-25);ctx.lineTo(f.x+14,y-25);ctx.stroke();
  }
}
export function drawGame(canvas, state, world) {
  const cssWidth=canvas.clientWidth || 640, cssHeight=canvas.clientHeight || 300, dpr=Math.min(2,globalThis.devicePixelRatio||1);
  if(canvas.width!==Math.round(cssWidth*dpr)||canvas.height!==Math.round(cssHeight*dpr)){canvas.width=Math.round(cssWidth*dpr);canvas.height=Math.round(cssHeight*dpr);}
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const scale=cssHeight/480, view=cssWidth/scale;
  ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
  const camera=Math.max(0,Math.min(RULES.width-view,state.x-view*.27));
  const sky=ctx.createLinearGradient(0,0,0,480);sky.addColorStop(0,'#bce3eb');sky.addColorStop(.72,'#ffe4b6');sky.addColorStop(1,'#f4c781');ctx.fillStyle=sky;ctx.fillRect(0,0,view,480);
  ctx.fillStyle='#fff0b2';ctx.beginPath();ctx.arc(view*.82,86,38,0,Math.PI*2);ctx.fill();
  for(let i=-1;i<Math.ceil(view/150)+2;i++){
    const x=i*150-(camera*.13%150);ctx.fillStyle=i%2?'#8bb9c080':'#a0c9cb';ctx.fillRect(x,170+(i%3)*23,58,170);
    ctx.fillStyle='#d9eef0';for(let yy=190;yy<330;yy+=23)ctx.fillRect(x+9,yy,7,10);
    ctx.strokeStyle='#8bb9c0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+28,180);ctx.lineTo(x+28,145);ctx.stroke();
  }
  ctx.fillStyle='#edbb85';ctx.beginPath();ctx.moveTo(0,340);for(let x=0;x<=view+60;x+=60)ctx.lineTo(x,320+Math.sin((x+camera*.25)/170)*25);ctx.lineTo(view,390);ctx.lineTo(0,390);ctx.fill();
  ctx.save();ctx.translate(-camera,0);
  ctx.fillStyle='#d2955e';ctx.fillRect(camera,390,view,90);ctx.fillStyle='#efc185';ctx.fillRect(camera,390,view,12);
  for(let x=Math.floor(camera/90)*90;x<camera+view+90;x+=90){round(ctx,x,427,30,5,2,'#b8784e');round(ctx,x+40,462,20,4,2,'#e1aa71');}
  for(const platform of world.platforms){round(ctx,platform.x,platform.y,platform.w,18,5,'#865337');round(ctx,platform.x-3,platform.y-3,platform.w+6,8,4,'#71a95d');}
  for(const f of world.foods)if(!state.collected.includes(f.id)&&f.x>camera-30&&f.x<camera+view+30)food(ctx,f,state.tick);
  for(const o of world.obstacles){const x=obstacleX(o,state.tick),y=390-o.h;
    if(x<camera-100||x>camera+view+100)continue;
    if(o.kind==='spill'){ctx.fillStyle='#5bafbc';ctx.beginPath();ctx.ellipse(x+o.w/2,y+7,o.w/2,8,0,0,Math.PI*2);ctx.fill();}
    else {round(ctx,x,y,o.w,o.h,5,o.kind==='barrier'?'#d6743c':'#ad774b');ctx.strokeStyle='#754b35';ctx.lineWidth=3;ctx.strokeRect(x+5,y+5,o.w-10,o.h-10);ctx.beginPath();ctx.moveTo(x+6,y+6);ctx.lineTo(x+o.w-6,y+o.h-6);ctx.moveTo(x+o.w-6,y+6);ctx.lineTo(x+6,y+o.h-6);ctx.stroke();}
  }
  const shop=world.finish+10;
  round(ctx,shop,215,150,175,8,'#fff0cf');round(ctx,shop-10,213,170,42,5,'#922742');
  ctx.fillStyle='#fff4de';ctx.font='bold 23px system-ui';ctx.textAlign='center';ctx.fillText('HOT N COOL',shop+75,241);
  round(ctx,shop+53,299,45,91,5,'#74b4ba');round(ctx,shop+10,280,30,44,4,'#a5d5d1');round(ctx,shop+110,280,30,44,4,'#a5d5d1');
  ctx.fillStyle='#8b2440';ctx.font='bold 13px system-ui';ctx.fillText('FINISH',shop+75,279);
  ctx.fillStyle='#71482935';ctx.beginPath();ctx.ellipse(state.x+22,391,26,6,0,0,Math.PI*2);ctx.fill();
  burger(ctx,state);
  ctx.restore();
  // Restore CSS-pixel transform for any future overlay drawing.
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
