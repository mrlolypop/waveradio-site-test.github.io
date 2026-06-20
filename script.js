/* ============================================================
   WAVE Radio — vanilla JS (no frameworks)
   - Streaming audio player with server switching
   - Now playing metadata polling
   - Mobile nav, toast, server menu, contact form
   ============================================================ */

/* ---------- Stream servers (edit here) ---------- */
const STREAM_SERVERS = [
  { id: "zeno-primary", label: "ZENO PRIMARY", url: "https://zeno1.waveradio.eu.org", flag: "🇺🇸" },
  { id: "zeno-backup",  label: "ZENO BACKUP",  url: "https://zeno2.waveradio.eu.org", flag: "🇺🇸" },
  { id: "uk-1",         label: "UK SERVER 1",  url: "https://listen1.waveradio.eu.org/stream",   flag: "🇬🇧" },
  { id: "uk-2",         label: "UK SERVER 2",  url: "https://listen2.waveradio.eu.org", flag: "🇬🇧" },
];
const METADATA_URL = "https://data.waveradio.eu.org/status-json.xsl";

/* ---------- Player state ---------- */
const audio = new Audio();
audio.preload = "none";
audio.volume = 0.8;
audio.crossOrigin = "anonymous";

const State = {
  server: STREAM_SERVERS[0],
  playing: false,
  loading: false,
  mixedBlocked: false,
};

function isMixed(url){
  return location.protocol === "https:" && url.startsWith("http:");
}

function swapSource(url, shouldPlay){
  try { audio.pause(); } catch(_){}
  audio.src = url;
  audio.load();
  if (shouldPlay){
    State.loading = true; render();
    audio.play().catch(()=>{ State.loading=false; State.playing=false; render(); });
  }
}

function setServer(s){
  if (s.id === State.server.id) return;
  State.server = s;
  const wasPlaying = !audio.paused;
  if (isMixed(s.url)){
    audio.pause();
    State.mixedBlocked = true;
    render();
    return;
  }
  State.mixedBlocked = false;
  swapSource(s.url, wasPlaying);
  render();
}

function togglePlay(){
  if (!audio.paused){ audio.pause(); return; }
  if (isMixed(State.server.url)){
    State.mixedBlocked = true;
    window.open(State.server.url, "_blank", "noopener");
    render();
    return;
  }
  if (!audio.src){ swapSource(State.server.url, true); return; }
  State.loading = true; render();
  audio.play().catch(()=>{ State.loading=false; State.playing=false; render(); });
}

audio.addEventListener("play",    ()=>{ State.playing=true;  State.loading=false; render(); });
audio.addEventListener("pause",   ()=>{ State.playing=false; render(); });
audio.addEventListener("waiting", ()=>{ State.loading=true;  render(); });
audio.addEventListener("playing", ()=>{ State.loading=false; render(); });
audio.addEventListener("error",   ()=>{ State.loading=false; State.playing=false; render(); });

/* ---------- Now-playing ---------- */
let nowPlaying = { artist:"", title:"", raw:"", artwork:null };

async function fetchArtwork(q){
  try{
    const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`);
    if (!r.ok) return null;
    const j = await r.json();
    const url = j && j.results && j.results[0] && j.results[0].artworkUrl100;
    return url ? url.replace("100x100bb","600x600bb") : null;
  }catch(_){ return null; }
}

async function fetchNowPlaying(){
  try{
    const r = await fetch(METADATA_URL, { cache:"no-store" });
    const j = await r.json();
    const src = j && j.icestats && j.icestats.source;
    const raw = (src && src.title) || "";
    const parts = raw.split(" - ");
    const artist = parts.length > 1 ? parts[0].trim() : "";
    const title  = parts.length > 1 ? parts.slice(1).join(" - ").trim() : raw.trim();
    const artwork = raw ? await fetchArtwork(`${artist} ${title}`.trim()) : null;
    nowPlaying = { artist, title, raw, artwork };
    renderNowPlaying();
  }catch(_){}
}
setInterval(fetchNowPlaying, 15000);
fetchNowPlaying();

/* ---------- Rendering ---------- */
function render(){
  // Live pill
  document.querySelectorAll(".live-pill .pdot").forEach(el=>{
    el.classList.toggle("pulse-dot", State.playing);
  });
  document.querySelectorAll(".live-pill .live-label").forEach(el=>{
    el.textContent = State.playing ? "LIVE" : "ON AIR";
  });
  // Play button
  const btn = document.getElementById("playBtn");
  if (btn){
    btn.setAttribute("aria-label", State.playing ? "Pause" : "Play");
    btn.innerHTML = State.playing ? ICONS.pause : ICONS.play;
  }
  // Server label highlight
  document.querySelectorAll(".server-item").forEach(el=>{
    el.classList.toggle("active", el.dataset.id === State.server.id);
  });
  // Mixed warning
  const warn = document.getElementById("mixedWarn");
  if (warn){
    warn.style.display = State.mixedBlocked ? "block" : "none";
    const lbl = warn.querySelector(".srv-label");
    if (lbl) lbl.textContent = State.server.label;
  }
}

function renderNowPlaying(){
  const title  = nowPlaying.title  || "Wave Radio";
  const artist = nowPlaying.artist || "Live Stream";
  document.querySelectorAll(".player-title").forEach(el=>el.textContent = title);
  document.querySelectorAll(".player-artist").forEach(el=>el.textContent = artist);
  // Disc artwork (home page)
  const disc = document.getElementById("discArt");
  if (disc){
    if (nowPlaying.artwork){
      disc.innerHTML = `<img class="disc-art" src="${nowPlaying.artwork}" alt="">`;
    } else {
      disc.innerHTML = `
        <div class="disc-fallback">
          <div class="w">W A V E&nbsp;&nbsp;R A D I O</div>
          <div class="sub">PURE VELOCITY</div>
        </div>`;
    }
  }
  // Player bar art
  const partImg = document.getElementById("playerArt");
  if (partImg){
    if (nowPlaying.artwork){
      partImg.innerHTML = `<img src="${nowPlaying.artwork}" alt="">`;
    } else {
      partImg.innerHTML = `<div class="ph">wave</div>`;
    }
  }
  // "Now playing — ..."
  const np = document.getElementById("nowPlayingText");
  if (np){
    if (nowPlaying.raw){
      np.style.display = "block";
      np.innerHTML = `<span class="live-d">●</span> Now playing — <span style="color:var(--fg)">${escapeHtml(nowPlaying.raw)}</span>`;
    } else {
      np.style.display = "none";
    }
  }
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

/* ---------- SVG icons ---------- */
const ICONS = {
  play:   `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>`,
  pause:  `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`,
  globe:  `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>`,
  vol:    `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>`,
  menu:   `<svg class="icon" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  close:  `<svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  check:  `<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
};

/* ---------- Init shared UI (header + player) ---------- */
function initSharedUI(){
  // Set play button icon initially
  render();
  renderNowPlaying();

  // Mobile nav toggle
  const menuBtn = document.getElementById("menuBtn");
  const mobileNav = document.getElementById("mobileNav");
  if (menuBtn && mobileNav){
    menuBtn.innerHTML = ICONS.menu;
    menuBtn.addEventListener("click", ()=>{
      const open = mobileNav.classList.toggle("open");
      menuBtn.innerHTML = open ? ICONS.close : ICONS.menu;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Play button
  const playBtn = document.getElementById("playBtn");
  if (playBtn) playBtn.addEventListener("click", togglePlay);

  // Volume
  const vol = document.getElementById("volRange");
  if (vol){
    vol.value = Math.round(audio.volume * 100);
    vol.addEventListener("input", e=>{
      audio.volume = e.target.value/100;
    });
  }

  // Server menu
  const serverBtn = document.getElementById("serverBtn");
  const serverMenu = document.getElementById("serverMenu");
  if (serverBtn && serverMenu){
    serverBtn.innerHTML = ICONS.globe;
    serverMenu.innerHTML = STREAM_SERVERS.map(s=>`
      <button class="server-item" data-id="${s.id}">
        <span class="flag">${s.flag}</span>
        <span class="lbl">${s.label}</span>
        <span class="ck"></span>
      </button>`).join("");
    serverMenu.querySelectorAll(".server-item").forEach(el=>{
      el.addEventListener("click", ()=>{
        const s = STREAM_SERVERS.find(x=>x.id===el.dataset.id);
        if (s) setServer(s);
        serverMenu.classList.remove("open");
        // refresh checkmarks
        serverMenu.querySelectorAll(".server-item").forEach(it=>{
          it.querySelector(".ck").innerHTML = it.dataset.id === State.server.id ? ICONS.check : "";
        });
      });
    });
    // initial checkmarks
    serverMenu.querySelectorAll(".server-item").forEach(it=>{
      it.querySelector(".ck").innerHTML = it.dataset.id === State.server.id ? ICONS.check : "";
    });
    serverBtn.addEventListener("click", e=>{
      e.stopPropagation();
      serverMenu.classList.toggle("open");
    });
    document.addEventListener("click", e=>{
      if (!serverMenu.contains(e.target) && e.target !== serverBtn) serverMenu.classList.remove("open");
    });
  }

  // Inject volume icon
  const volIcon = document.getElementById("volIcon");
  if (volIcon) volIcon.innerHTML = ICONS.vol;

  // Contact form (if present)
  const form = document.getElementById("contactForm");
  if (form){
    form.addEventListener("submit", e=>{
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      btn.querySelector(".label").textContent = "Sending...";
      const data = Object.fromEntries(new FormData(form).entries());
      console.log("Contact form:", data);
      setTimeout(()=>{
        btn.disabled = false;
        btn.querySelector(".label").textContent = "Send message";
        form.reset();
        toast("Message sent. We'll get back to you soon.");
      }, 600);
    });
  }
}

/* ---------- Toast ---------- */
function toast(msg){
  let host = document.querySelector(".toast-host");
  if (!host){ host = document.createElement("div"); host.className = "toast-host"; document.body.appendChild(host); }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(()=>{ t.style.opacity="0"; t.style.transition="opacity .3s"; setTimeout(()=>t.remove(), 300); }, 3000);
}

document.addEventListener("DOMContentLoaded", initSharedUI);
