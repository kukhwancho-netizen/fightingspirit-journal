const SB_URL='https://cbdyclovsybrxhpgpjbo.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZHljbG92c3licnhocGdwamJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjE5MzEsImV4cCI6MjA5NDQzNzkzMX0.kEfbLtW4ugwAYfh7NWucXbDZarpY_4fbK3Wthov_PRk';
const SERIES_LABEL={PRECEDENT:'판례분석',CIVIL:'민사',ADMIN:'행정',FAMILY:'가사'};
const SERIES_SUB={PRECEDENT:'Precedent',CIVIL:'Civil',ADMIN:'Administrative',FAMILY:'Family'};
const SERIES_KEYS=['PRECEDENT','CIVIL','ADMIN','FAMILY'];

function slugifyText(value,maxLen=86){
  const slug=String(value??'')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu,' ')
    .trim()
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'');
  return slug.slice(0,maxLen).replace(/-$/g,'');
}
function shortPostId(post){
  return String(post?.id??'').replace(/[^a-z0-9]/gi,'').slice(0,8)||'article';
}
function articleSlug(post){
  const base=slugifyText(post?.title)||'article-'+shortPostId(post);
  return base+'-'+shortPostId(post);
}
function articlePath(post,from='root'){
  const file=encodeURIComponent(articleSlug(post))+'.html';
  return from==='subdir'?'../journal/'+file:'journal/'+file;
}

async function sbFetch(path,opts={}){
  const r=await fetch(SB_URL+'/rest/v1/'+path,{
    headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'return=representation',...(opts.headers||{})},
    ...opts
  });
  if(!r.ok){let err;try{err=await r.json();}catch(_){err={message:'fetch failed',status:r.status};}err.__status=r.status;throw err;}
  const t=await r.text();return t?JSON.parse(t):null;
}

function _isPubAtMissing(e){
  const s=JSON.stringify(e||{});
  return s.includes('publish_at')&&(s.includes('does not exist')||s.includes('column')||s.includes('42703'));
}
function _isTagsMissing(e){
  const s=JSON.stringify(e||{});
  return s.includes('tags')&&(s.includes('does not exist')||s.includes('column')||s.includes('42703'));
}

async function fetchPublicPosts({select='id,title,summary,series,date',idEq=null,idNeq=null,limit=null}={}){
  const nowIso=new Date().toISOString();
  const cols=select.includes('publish_at')?select:select+',publish_at';
  let base='posts?status=eq.published';
  if(idEq!=null)base+='&id=eq.'+idEq;
  if(idNeq!=null)base+='&id=neq.'+idNeq;
  const lim=limit?'&limit='+limit:'';
  const dropCol=(s,col)=>s.split(',').filter(c=>c.trim()!==col).join(',');
  try{
    return await sbFetch(base+'&or=(publish_at.is.null,publish_at.lte.'+encodeURIComponent(nowIso)+')&order=publish_at.desc.nullslast,date.desc,id.desc&select='+cols+lim);
  }catch(e){
    if(_isTagsMissing(e)){
      console.warn('tags 컬럼 없음 — fallback. 마이그레이션 실행 필요.');
      const c2=dropCol(cols,'tags');
      return await sbFetch(base+'&or=(publish_at.is.null,publish_at.lte.'+encodeURIComponent(nowIso)+')&order=publish_at.desc.nullslast,date.desc,id.desc&select='+c2+lim);
    }
    if(_isPubAtMissing(e)){
      console.warn('publish_at 컬럼 없음 — fallback. 마이그레이션 실행 필요.');
      try{
        return await sbFetch(base+'&order=date.desc,id.desc&select='+select+lim);
      }catch(e2){
        if(_isTagsMissing(e2)){
          return await sbFetch(base+'&order=date.desc,id.desc&select='+dropCol(select,'tags')+lim);
        }
        throw e2;
      }
    }
    throw e;
  }
}

function renderNav(active){
  const links=[
    {key:'home',href:'index.html',label:'HOME'},
    {key:'journal',href:'journal.html',label:'JOURNAL'},
    {key:'about',href:'about.html',label:'ABOUT'}
  ];
  const html=`<nav class="top">
<a href="index.html" class="logo">AUCTORITAS LAB<span class="sub">공간분쟁 전문 조국환 변호사팀</span></a>
<ul class="nav-links">${links.map(l=>`<li><a href="${l.href}"${l.key===active?' class="active"':''}>${l.label}</a></li>`).join('')}</ul>
</nav>`;
  const slot=document.getElementById('navSlot');
  if(slot)slot.outerHTML=html;
}

function renderFooter(){
  const html=`<footer>
<div class="ft-inner">
<div class="ft-brand">
<div class="name">AUCTORITAS<span style="color:var(--vermillion)">.</span></div>
<div class="tagline">공간분쟁 전문팀 · Legal Journal</div>
<div class="legal">조국환 변호사팀 | AUCTORITAS LAB<br>공간분쟁 전문 변호사팀이 직접 쓰는<br>판례·실무 저널</div>
</div>
<div>
<div class="ft-h">Contact</div>
<div class="ft-line"><strong>031-546-3997</strong></div>
<div class="ft-line">031-546-3998 (FAX)</div>
<div class="ft-line"><a href="mailto:info@fightingspirit.kr">info@fightingspirit.kr</a></div>
<div class="ft-line"><a href="https://www.fightingspirit.kr" target="_blank" rel="noopener">발행팀 홈페이지 →</a></div>
</div>
<div>
<div class="ft-h">Address</div>
<div class="ft-line">경기도 수원시 영통구<br>광교중앙로 248번길 7-2<br>원희캐슬법조타운 B동 401호</div>
<div class="ft-line" style="margin-top:10px"><a href="https://instagram.com/auctoritas_journal" target="_blank" rel="noopener">@auctoritas_journal</a></div>
</div>
</div>
<div class="ft-bot">
<span>© 2026 AUCTORITAS · 공간분쟁 전문팀</span>
<span>Republic of Korea · Nationwide Practice</span>
</div>
</footer>`;
  const slot=document.getElementById('footerSlot');
  if(slot)slot.outerHTML=html;
}
