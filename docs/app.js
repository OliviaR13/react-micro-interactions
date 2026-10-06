const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const toast=(msg)=>{const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.remove("show"),1800)};

$("#themeBtn").onclick=()=>document.body.classList.toggle("dark");

$$(".filter").forEach(btn=>btn.onclick=()=>{
  $$(".filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  const f=btn.dataset.filter;
  $$(".card").forEach(c=>c.style.display=(f==="all"||c.dataset.category===f)?"":"none");
});

$("#likeBtn").onclick=function(){
  this.classList.toggle("liked");
  const em=this.querySelector("em"), n=parseInt(em.textContent);
  em.textContent=this.classList.contains("liked")?n+1:n-1;
  this.querySelector("span").textContent=this.classList.contains("liked")?"♥":"♡";
};

$("#island").onclick=()=>$("#island").classList.toggle("open");

const range=$(".compare input"), after=$(".compare-after"), divider=$(".divider");
range.oninput=()=>{after.style.clipPath=`inset(0 0 0 ${range.value}%)`;divider.style.left=range.value+"%"};

const ball=$("#ball"), area=$("#dragArea");let drag=false,ox=0,oy=0;
ball.addEventListener("pointerdown",e=>{drag=true;ball.setPointerCapture(e.pointerId);const r=ball.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;ball.style.cursor="grabbing"});
ball.addEventListener("pointermove",e=>{if(!drag)return;const r=area.getBoundingClientRect();let x=e.clientX-r.left-ox,y=e.clientY-r.top-oy;x=Math.max(0,Math.min(r.width-ball.offsetWidth,x));y=Math.max(0,Math.min(r.height-ball.offsetHeight,y));ball.style.left=x+"px";ball.style.top=y+"px"});
ball.addEventListener("pointerup",()=>{drag=false;ball.style.cursor="grab"});

$$(".checklist input").forEach(i=>i.onchange=()=>toast(i.checked?"Task completed":"Task unchecked"));

$("#generateBtn").onclick=async function(){this.disabled=true;this.querySelector("span").textContent="◌";this.lastChild.textContent=" Generating";await new Promise(r=>setTimeout(r,900));this.disabled=false;this.querySelector("span").textContent="✦";this.lastChild.textContent=" Generate";toast("Generated successfully")};

$("#confirmBtn").onclick=()=>$("#modal").classList.add("show");
$("#cancelModal").onclick=()=>$("#modal").classList.remove("show");
$("#okModal").onclick=()=>{$("#modal").classList.remove("show");toast("Demo action confirmed")};
$("#modal").onclick=e=>{if(e.target.id==="modal")$("#modal").classList.remove("show")};
