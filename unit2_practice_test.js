const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0,fail=0;
const ok=(l,c)=>{c?(pass++,console.log('OK   '+l)):(fail++,console.log('FAIL '+l));};
const eq=(l,g,w)=>ok(l+' -> '+JSON.stringify(g),JSON.stringify(g)===JSON.stringify(w));
const html=fs.readFileSync('unit2-practice.html','utf8');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true});
const w=dom.window,d=w.document;
const $=s=>d.querySelector(s),$$=s=>Array.from(d.querySelectorAll(s));
const tap=el=>el.dispatchEvent(new w.Event('click',{bubbles:true}));
eq('no load errors',errs,[]);

/* ================= content (unchanged, must stay verified) ================= */
eq('problem count',w.PROBS.length,30);
eq('per-section',['d1','d2','d3','mx'].map(s=>w.PROBS.filter(p=>p.s===s).length),[8,8,8,6]);
['d1','d2','d3','mx'].forEach(s=>{const cx=w.PROBS.filter(p=>p.s===s).map(p=>p.cx);
  ok(s+' essential-first',cx.every((v,i)=>i===0||v>=cx[i-1]));});
const finals={'P-3':'105','P-4':'112','P-5':'14','P-6':'25','P-7':'75','P-8':'86','P-9':'2',
 'P-10':'-2','P-11':'0','P-13':'-1/2','P-16':'11','P-26':'2','P-27':'107','P-30':'-2'};
w.PROBS.forEach(p=>{if(!finals[p.num])return;const S=w.steps(p);
  eq(p.num+' final answer',w.fstr(S[S.length-1].ans),finals[p.num]);});
w.PROBS.filter(p=>['ptmb','twomb','convert'].includes(p.k)).forEach(p=>{
  const S=w.steps(p),b=S[S.length-1].ans;
  const m=(p.k==='twomb')?w.slopeOf(p.p,p.q):w.fr(p.m[0],p.m[1]);
  ok(p.num+' point lies on y = mx + b',w.feq(w.fadd(w.fmul(m,w.fr(p.p[0])),b),w.fr(p.p[1])));});

/* ================= NEW: two-level nudges ================= */
ok('every step has two distinct nudge levels',
  w.PROBS.every(p=>w.steps(p).every(s=>s.nudge&&s.nudge2&&s.nudge2!==s.nudge)));
ok('level 2 is more concrete than level 1 on average',
  w.PROBS.flatMap(p=>w.steps(p)).filter(s=>/\?$/.test(s.nudge2.replace(/<[^>]+>/g,''))).length>=20);
let leaks=[];
w.PROBS.forEach(p=>w.steps(p).forEach(s=>{
  if(s.kind==='choice')return;
  const a=w.fstr(s.ans).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  [s.nudge,s.nudge2].forEach((n,i)=>{
    const t=String(n).replace(/<[^>]+>/g,'').replace(/&minus;/g,'-').replace(/&#47;/g,'/');
    /* operands may be restated; a finished "= X" or "is X" gives the step away */
    if(new RegExp('(=\\s*|\\bis\\s+)'+a+'([^0-9/.]|$)').test(t))
      leaks.push(p.num+'/'+s.id+' nudge'+(i+1)+' states the answer outright');});}));
eq('no nudge states its answer outright',leaks,[]);
ok('level-2 nudges still make the student compute',
  w.PROBS.flatMap(p=>w.steps(p)).filter(s=>s.kind!=='choice')
    .every(s=>/\?/.test(String(s.nudge2))));

/* ================= NEW: setup screen ================= */
ok('lands on a setup screen, not problem 1',!!$('.setup')&&!$('.q'));
eq('four section chips',$$('[data-sec]').length,4);
ok('all sections pre-selected',$$('[data-sec]').every(b=>b.getAttribute('aria-pressed')==='true'));
eq('start counts the pool',$('#go').textContent.trim(),'Start — 30 problems');
tap($('[data-sec="d1"]'));tap($('[data-sec="d2"]'));
eq('deselecting updates the count',$('#go').textContent.trim(),'Start — 14 problems');
ok('chips are real buttons',$$('[data-sec]').every(b=>b.tagName==='BUTTON'));
$$('[data-sec]').forEach(b=>{if(b.getAttribute('aria-pressed')==='false')tap(b);});
ok('start disabled with nothing chosen',(()=>{$$('[data-sec]').forEach(b=>{if(b.getAttribute('aria-pressed')==='true')tap(b);});return $('#go').disabled;})());
$$('[data-sec]').forEach(b=>tap(b));
tap($('#go'));
ok('starting renders problems',!!$('.q'));
ok('tabs appear only after starting',$$('.tab').length===4);

/* ================= NEW: keyboard-reachable options ================= */
const c0=()=>$('.q');
ok('options are buttons, not divs',c0().querySelectorAll('[data-pick]').length>0
   && Array.from(c0().querySelectorAll('[data-pick]')).every(b=>b.tagName==='BUTTON'));
ok('options carry aria-pressed',c0().querySelector('[data-pick]').hasAttribute('aria-pressed'));
ok('option group is labelled',!!c0().querySelector('[role="group"][aria-labelledby]'));

/* ================= one problem, one step, nothing previewed ================= */
eq('exactly one problem on screen',$$('.q').length,1);
eq('only the current step on screen at the start',$$('.step').length,1);
ok('at most one interactive step ever',$$('.step').filter(x=>!x.querySelector('.locked-in')).length<=1);
ok('no future step markup anywhere',!/class="step locked"/.test(d.body.innerHTML));
const allOpts=$$('[data-pick]').map(b=>b.textContent);
ok('later steps do not leak their options',!allOpts.some(t=>/Corresponding|Alternate|Same-side/.test(t)));
ok('step count is not advertised',!/\d+ steps/.test($('.q').textContent));
ok('position is shown without content',/Problem 1 of 8/.test($('.qpos').textContent));
eq('one pill per problem in the section',$$('.pill').length,8);
ok('pills carry state labels',$$('.pill').every(b=>/solved|not yet answered/.test(b.getAttribute('aria-label'))));
ok('Previous disabled on the first problem',$('#prev').disabled);
ok('Next available',!$('#next').disabled);

/* ================= NEW: aria + live region ================= */
ok('live region exists',!!$('#live')&&$('#live').getAttribute('aria-live')==='polite');
tap(c0().querySelector('[data-pick="both_int"]'));
tap(c0().querySelector('[data-act="check"]'));
ok('wrong answer announced in the live region',/not correct/i.test($('#live').textContent));
ok('error message rendered',!!c0().querySelector('.fb.err'));

/* ================= NEW: per-card repaint keeps focus ================= */
ok('focus stays inside the card after a wrong check',c0().contains(d.activeElement));
ok('still a single card after a wrong check',$$('.q').length===1);

/* ================= NEW: two-level nudge UI ================= */
tap(c0().querySelector('[data-act="nudge"]'));
ok('nudge 1 shows and is labelled 1 of 2',/Nudge 1 of 2/.test(c0().textContent));
const n1=c0().querySelector('.fb.nudge').textContent;
tap(c0().querySelector('[data-act="nudge"]'));
ok('nudge 2 shows and differs from nudge 1',/Nudge 2 of 2/.test(c0().textContent)
   && c0().querySelector('.fb.nudge').textContent!==n1);
tap(c0().querySelector('[data-act="nudge"]'));
ok('nudge does not go past 2',w.ST['q0'].nudgeLv===2);

/* ================= step locking still correct ================= */
tap(c0().querySelector('[data-pick="mixed"]'));
tap(c0().querySelector('[data-act="check"]'));
ok('correct step locks in',!!c0().querySelector('.locked-in'));
ok('step 1 collapses to a record, step 2 becomes the live one',
   $$('.step').length===2 && !!$$('.step')[0].querySelector('.locked-in') && !$$('.step')[1].querySelector('.locked-in'));
ok('still exactly one interactive step',$$('.step').filter(x=>!x.querySelector('.locked-in')).length===1);
ok('no step beyond the current one is rendered',$$('.step').length===w.ST['q0'].cur+1);
ok('nudge level reset for the new step',w.ST['q0'].nudgeLv===0);
ok('focus moved to the newly opened control',c0().contains(d.activeElement));
ok('step counter advances',/step 2 of 3/.test(c0().textContent));

/* open-this-step */
tap(c0().querySelector('[data-pick="opp"]'));tap(c0().querySelector('[data-act="check"]'));
tap(c0().querySelector('[data-pick="opp"]'));tap(c0().querySelector('[data-act="check"]'));
ok('Open offered after the limit',!!c0().querySelector('[data-act="open"]'));
tap(c0().querySelector('[data-act="open"]'));
ok('Open fills the correct value',w.ST['q0'].pick['side']==='same');
ok('Open advances one step only',!w.ST['q0'].solved);
ok('Open announced',/step opened/i.test($('#live').textContent));

/* ================= numeric step aria ================= */
tap($$('.tab')[1]);
w.go(4);
const nc=$('.q');
const inp=nc.querySelector('input[data-in]');
ok('input has an accessible label',!!nc.querySelector('label[for="'+inp.id+'"]'));
ok('input describes its accepted format',/fraction/i.test(d.getElementById(inp.id+'-help').textContent));
eq('aria-invalid starts false',inp.getAttribute('aria-invalid'),'false');
inp.value='999';inp.dispatchEvent(new w.Event('input',{bubbles:true}));
tap(nc.querySelector('[data-act="check"]'));
eq('aria-invalid set after a wrong answer',$('.q').querySelector('input[data-in]').getAttribute('aria-invalid'),'true');
ok('error is linked by aria-describedby',
   ($('.q').querySelector('input[data-in]').getAttribute('aria-describedby')||'').includes('-err'));
ok('single input mode everywhere (no answer leak)',
   $$('input[data-in]').every(i=>i.getAttribute('inputmode')==='text'));

/* ================= navigation ================= */
w.go(0);
eq('go(0) returns to the first problem',$('.qpos').textContent.trim(),'Problem 1 of 8');
tap($('#next'));
eq('Next advances one problem',$('.qpos').textContent.trim(),'Problem 2 of 8');
ok('advancing announces position and question',/Problem 2 of 8/.test($('#live').textContent));
ok('focus lands inside the new card',$('.q').contains(d.activeElement));
tap($('#prev'));
eq('Previous goes back',$('.qpos').textContent.trim(),'Problem 1 of 8');
tap($$('.pill')[5]);
eq('a pill jumps straight to that problem',$('.qpos').textContent.trim(),'Problem 6 of 8');
ok('still one problem and one step after jumping',$$('.q').length===1&&$$('.step').length===1);
tap($$('.pill')[7]);
ok('Next disabled on the last problem',$('#next').disabled);

/* ================= toolbelt ================= */
eq('four tools',$$('.tbtn').length,4);
ok('tools report expanded state',$$('.tbtn').every(b=>b.hasAttribute('aria-expanded')));
tap($$('.tbtn')[1]);
ok('panel opens',$('#beltpanel').style.display==='block');
eq('expanded flips to true',$$('.tbtn')[1].getAttribute('aria-expanded'),'true');
ok('page reserves room for the belt',parseInt($('.main').style.paddingBottom||'0',10)>=140);
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
ok('Escape closes the belt',$('#beltpanel').style.display==='none');

/* calculator */
tap($$('.tbtn')[0]);
const ck=k=>tap($$('.key').find(b=>b.getAttribute('data-k')===k));
ck('C');ck('6');ck('/');ck('8');ck('=');
eq('6 / 8 stays exact',$('#cval').textContent,'3/4');
ck('C');ck('1');ck('/');ck('0');ck('=');
ok('inverse of zero refused',/no inverse/.test($('#cval').textContent));
ok('calculator cannot graph',!$('#beltinner').querySelector('canvas')&&!/plot\(|drawCurve/.test(html));

/* ================= house rules ================= */
ok('no banned vocabulary',!/\b(easy|hard|obvious|simply|clearly)\b/i.test(html));
ok('no subtract/divide as operation names',!/\b(subtract|divide|dividing|subtracting)\b/i.test(html));
const code=html.split('<script>')[1].split('</script>')[0].replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*/g,'');
ok('no browser storage',!/localStorage|sessionStorage/.test(code));
ok('no external script dependency',!/<script[^>]+src=/i.test(html));
const css=html.split('<style>')[1].split('</style>')[0];
['\\.opt\\{','\\.btn\\{','\\.chip\\{','input\\[type=text\\]\\{'].forEach(s=>
  ok(s.replace(/\\/g,'')+' 44px target',new RegExp(s+'[^}]*min-height:44px').test(css)));
ok('visible focus ring defined',/:focus-visible\{[^}]*outline/.test(css));

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
