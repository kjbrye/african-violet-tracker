
/* African Violets — Plants & Care (vanilla JS, localStorage) */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const STORE_KEY = "african_violets_store_v1";

let store = loadStore();
let selectedCultivarId = null;
function loadStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return normalizeStore({ cultivars: [], care: [] });
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  }catch(e){
    console.error("Failed to parse store", e);
    return normalizeStore({ cultivars: [], care: [] });
  }
}
function normalizeStore(data){
  const cultivars = Array.isArray(data?.cultivars) ? data.cultivars.map(normalizePlant) : [];
  const care = Array.isArray(data?.care) ? data.care.map(entry=>({ ...entry })) : [];
  return { cultivars, care };
}
function normalizePlant(plant){
  const cultivarName = String(plant?.cultivarName ?? plant?.name ?? "").trim();
  const nickname = String(plant?.nickname ?? "").trim();
  const normalized = { ...plant, cultivarName, nickname };
  delete normalized.name;
  return normalized;
}
function saveStore(){
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  renderAll();
}

/* Navigation */
$$(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".nav-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const tabId = btn.dataset.tab;
    $$(".tab").forEach(t => t.classList.remove("active"));
    $("#"+tabId).classList.add("active");
  });
});

/* Utility */
function uid(){ return Math.random().toString(36).slice(2,9) }
function todayStr(){ return new Date().toISOString().slice(0,10) }
function toDate(s){ return s ? new Date(s+"T00:00:00") : new Date() }
function formatDate(s){ return s || "" }
function plantLabel(plant){
  if(!plant) return "";
  if(plant.nickname){
    return `${plant.nickname} (${plant.cultivarName})`;
  }
  return plant.cultivarName;
}
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}
function comparePlants(a,b){
  const cult = (a.cultivarName || "").localeCompare(b.cultivarName || "");
  if(cult!==0) return cult;
  return (a.nickname || "").localeCompare(b.nickname || "");
}
function download(filename, text) {
  const a = document.createElement('a');
  a.setAttribute('href','data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  a.setAttribute('download', filename);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function csvEscape(v){
  if(v==null) return "";
  const s = String(v);
  if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

/* Plants */
const cultivarDialog = $("#cultivarDialog");
const cultivarForm = $("#cultivarForm");
$("#btnAddCultivar").addEventListener("click", () => openCultivarDialog());
cultivarForm.addEventListener("submit", (e)=>{
  e.preventDefault();
});
$("#saveCultivar").addEventListener("click", (e)=>{
  e.preventDefault();
  saveCultivarFromForm();
});
$("#cancelCultivar").addEventListener("click", () => {
  cultivarForm.reset();
  $("#cvId").value = "";
  cultivarDialog.close();
});

$("#cvPhoto").addEventListener("change", handlePhoto);

function openCultivarDialog(cv=null){
  $("#cultivarDialogTitle").textContent = cv ? "Edit Plant" : "Add Plant";
  $("#cvId").value = cv?.id || "";
  $("#cvCultivarName").value = cv?.cultivarName || "";
  $("#cvNickname").value = cv?.nickname || "";
  $("#cvHybridizer").value = cv?.hybridizer || "";
  $("#cvYear").value = cv?.year || "";
  $("#cvBlossom").value = cv?.blossom || "";
  $("#cvColor").value = cv?.color || "";
  $("#cvLeaf").value = cv?.leaf || "";
  $("#cvVariegation").value = cv?.variegation || "";
  $("#cvPot").value = cv?.pot || "";
  $("#cvLocation").value = cv?.location || "";
  $("#cvAcquired").value = cv?.acquired || "";
  $("#cvSource").value = cv?.source || "";
  $("#cvWaterInterval").value = cv?.waterInterval ?? 7;
  $("#cvFertInterval").value = cv?.fertInterval ?? 30;
  $("#cvNotes").value = cv?.notes || "";
  $("#cvPhoto").value = "";
  cultivarDialog.showModal();
}

async function handlePhoto(e){
  const file = e.target.files?.[0];
  if(!file) return;
  if(file.size > 2_000_000){
    alert("Image is large; it will be stored locally and may impact storage. Try under 2 MB.");
  }
}

function saveCultivarFromForm(){
  const id = $("#cvId").value || uid();
  const get = (id)=>$("#"+id).value;
  const existing = store.cultivars.find(c=>c.id===id);
  let photoData = existing?.photo || "";

  const fileInput = $("#cvPhoto");
  const file = fileInput.files?.[0];
  function finishSave(){
    const data = {
      id,
      cultivarName: get("cvCultivarName").trim(),
      nickname: get("cvNickname").trim(),
      hybridizer: get("cvHybridizer").trim(),
      year: get("cvYear"),
      blossom: get("cvBlossom"),
      color: get("cvColor").trim(),
      leaf: get("cvLeaf"),
      variegation: get("cvVariegation").trim(),
      pot: get("cvPot"),
      location: get("cvLocation").trim(),
      acquired: get("cvAcquired"),
      source: get("cvSource").trim(),
      waterInterval: Number(get("cvWaterInterval")||7),
      fertInterval: Number(get("cvFertInterval")||30),
      notes: get("cvNotes").trim(),
      photo: photoData
    };
    if(!data.cultivarName){ alert("Cultivar/Variety Name is required."); return; }
    if(existing){
      Object.assign(existing, data);
      delete existing.name;
    }else{
      store.cultivars.push(data);
    }
    saveStore();
    cultivarDialog.close();
  }
  if(file){
    const reader = new FileReader();
    reader.onload = ()=>{
      photoData = reader.result;
      finishSave();
    };
    reader.readAsDataURL(file);
  }else{
    finishSave();
  }
}

function renderCultivars(){
  const grid = $("#cultivarGrid");
  const q = ($("#cultivarSearch").value || "").toLowerCase();
  const list = store.cultivars
    .slice()
    .sort(comparePlants)
    .filter(c=>{
      const hay = [c.cultivarName,c.nickname,c.blossom,c.color,c.leaf,c.location].join(" ").toLowerCase();
      return hay.includes(q);
    });

  grid.innerHTML = "";
  if(list.length===0){
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "No plants yet. Add your first plant.";
    grid.appendChild(p);
    return;
  }
  list.forEach(c=>{
    const div = document.createElement("div");
    div.className = "card-plant";
    div.setAttribute("tabindex","0");
    div.setAttribute("role","button");
    div.setAttribute("aria-label",`View profile for ${plantLabel(c)}`);
    if(selectedCultivarId===c.id) div.classList.add("is-selected");
    const img = document.createElement("img");
    img.alt = plantLabel(c);
    img.src = c.photo || "";
    if(!c.photo){ img.style.opacity = .5; img.style.objectFit = "contain"; img.src = "data:image/svg+xml;utf8,"+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 90'><rect width='120' height='90' fill='%230b0f14'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23aab7c4' font-size='10'>No Photo</text></svg>`); }
    const h3 = document.createElement("h3"); h3.textContent = c.cultivarName;
    const nickname = document.createElement("div");
    nickname.className = "muted";
    nickname.textContent = c.nickname ? `Nickname: ${c.nickname}` : "";
    const meta = document.createElement("div");
    meta.innerHTML = [
      c.blossom ? `<span class="badge">${escapeHtml(c.blossom)}</span>`:"",
      c.color ? `<span class="badge">${escapeHtml(c.color)}</span>`:"",
      c.leaf ? `<span class="badge">${escapeHtml(c.leaf)}</span>`:"",
      c.location ? `<span class="badge">📍 ${escapeHtml(c.location)}</span>`:""
    ].filter(Boolean).join(" ");
    const notes = document.createElement("div");
    notes.className = "muted";
    notes.textContent = c.notes || "";
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button"); edit.textContent = "Edit"; edit.addEventListener("click", ()=>openCultivarDialog(c));
    const del = document.createElement("button"); del.textContent = "Delete"; del.className = "danger"; del.addEventListener("click", ()=>{
      if(confirm(`Delete ${plantLabel(c)}? This removes its upcoming reminders but keeps care history.`)){
        // Remove cultivar
        store.cultivars = store.cultivars.filter(x=>x.id!==c.id);
        // Keep care logs since they serve as history; optionally we could filter by c.id to delete those too.
        saveStore();
      }
    });
    const care = document.createElement("button"); care.textContent = "Log Care"; care.addEventListener("click", ()=>{
      // Prefill quick care
      $("#qcCultivar").value = c.id;
      $(".nav-btn[data-tab='tab-dashboard']").click();
      $("#qcNotes").focus();
    });
    actions.append(edit, care, del);
    div.append(img, h3);
    if(c.nickname) div.append(nickname);
    div.append(meta, notes, actions);
    div.addEventListener("click", (e)=>{
      if(e.target.closest(".row-actions")) return;
      openPlantProfile(c.id);
    });
    div.addEventListener("keydown", (e)=>{
      if(e.target.closest && e.target.closest(".row-actions")) return;
      if(e.key==="Enter" || e.key===" "){
        e.preventDefault();
        openPlantProfile(c.id);
      }
    });
    grid.appendChild(div);
  });
}
$("#cultivarSearch").addEventListener("input", renderCultivars);

function closePlantProfile(){
  selectedCultivarId = null;
  renderPlantProfile();
  renderCultivars();
}

function openPlantProfile(id){
  selectedCultivarId = id;
  const navBtn = $(".nav-btn[data-tab='tab-cultivars']");
  if(navBtn && !navBtn.classList.contains("active")) navBtn.click();
  renderPlantProfile();
  renderCultivars();
  const profile = $("#plantProfile");
  if(profile){
    profile.classList.remove("hidden");
    if(!profile.hasAttribute("tabindex")) profile.setAttribute("tabindex","-1");
    if(typeof profile.focus === "function"){
      profile.focus();
    }
    if(typeof profile.scrollIntoView === "function"){
      profile.scrollIntoView({behavior:"smooth", block:"start"});
    }
  }
}

function renderPlantProfile(){
  const profile = $("#plantProfile");
  const content = $("#plantProfileContent");
  const editBtn = $("#profileEdit");
  const logBtn = $("#profileLogCare");
  if(!profile || !content) return;

  const plant = store.cultivars.find(c=>c.id===selectedCultivarId);
  if(!plant){
    if(selectedCultivarId){
      selectedCultivarId = null;
      renderCultivars();
    }
    profile.classList.add("hidden");
    content.innerHTML = "<p class=\"muted\">Select a plant to view its profile.</p>";
    if(editBtn) editBtn.disabled = true;
    if(logBtn) logBtn.disabled = true;
    return;
  }

  profile.classList.remove("hidden");
  if(editBtn) editBtn.disabled = false;
  if(logBtn) logBtn.disabled = false;

  const badges = [];
  if(plant.blossom) badges.push(`<span class="profile-badge">${escapeHtml(plant.blossom)}</span>`);
  if(plant.color) badges.push(`<span class="profile-badge">${escapeHtml(plant.color)}</span>`);
  if(plant.leaf) badges.push(`<span class="profile-badge">${escapeHtml(plant.leaf)}</span>`);
  if(plant.location) badges.push(`<span class="profile-badge">📍 ${escapeHtml(plant.location)}</span>`);

  const info = [
    {label:"Cultivar", value: plant.cultivarName ? escapeHtml(plant.cultivarName) : "—"},
    {label:"Nickname", value: plant.nickname ? escapeHtml(plant.nickname) : "—"},
    {label:"Hybridizer", value: plant.hybridizer ? escapeHtml(plant.hybridizer) : "—"},
    {label:"Year", value: plant.year ? escapeHtml(plant.year) : "—"},
    {label:"Variegation", value: plant.variegation ? escapeHtml(plant.variegation) : "—"},
    {label:"Pot Size", value: plant.pot ? escapeHtml(`${plant.pot}\"`) : "—"},
    {label:"Acquired", value: plant.acquired ? escapeHtml(formatDate(plant.acquired)) : "—"},
    {label:"Source", value: plant.source ? escapeHtml(plant.source) : "—"},
    {label:"Watering Interval", value: plant.waterInterval ? escapeHtml(`${plant.waterInterval} days`) : "—"},
    {label:"Fertilizer Interval", value: plant.fertInterval ? escapeHtml(`${plant.fertInterval} days`) : "—"}
  ];

  const nextWater = plant.waterInterval ? nextDue(plant._lastWater || plant.acquired || todayStr(), plant.waterInterval) : null;
  const nextFert = plant.fertInterval ? nextDue(plant._lastFert || plant.acquired || todayStr(), plant.fertInterval) : null;

  const highlight = [];
  if(nextWater) highlight.push(`Next watering: ${escapeHtml(nextWater)}`);
  if(nextFert) highlight.push(`Next fertilizer: ${escapeHtml(nextFert)}`);

  const infoHtml = info.map(item=>`
      <div>
        <dt>${item.label}</dt>
        <dd>${item.value || "—"}</dd>
      </div>
    `).join("");

  const careHistory = store.care
    .filter(r=>r.cultivarId===plant.id)
    .slice()
    .sort((a,b)=>b.date.localeCompare(a.date));

  const careHtml = careHistory.length
    ? `<ul class="profile-care-list">${careHistory.map(entry=>`
        <li>
          <strong>${escapeHtml(formatDate(entry.date))}</strong>
          <div>${escapeHtml(entry.action)}</div>
          ${entry.notes ? `<div class="muted">${escapeHtml(entry.notes)}</div>` : ""}
        </li>
      `).join("")}</ul>`
    : `<p class="profile-empty">No care entries logged yet.</p>`;

  const photo = plant.photo
    ? `<img src="${plant.photo}" alt="${escapeHtml(plantLabel(plant))}" class="profile-photo" />`
    : `<div class="profile-photo empty">No photo</div>`;

  content.innerHTML = `
    <div class="profile-header">
      ${photo}
      <div class="profile-summary">
        <h3>${escapeHtml(plant.cultivarName || "Unnamed plant")}</h3>
        ${plant.nickname ? `<div class="muted">Nickname: ${escapeHtml(plant.nickname)}</div>` : ""}
        ${plant.notes ? `<p>${escapeHtml(plant.notes)}</p>` : `<p class="muted">No notes added.</p>`}
        ${highlight.length ? `<div class="muted">${highlight.join(" · ")}</div>` : ""}
        ${badges.length ? `<div class="profile-badges">${badges.join("")}</div>` : ""}
      </div>
    </div>
    <div class="profile-details">
      <dl class="profile-grid">
        ${infoHtml}
      </dl>
    </div>
    <div class="profile-care">
      <h4>Care history</h4>
      ${careHtml}
    </div>
  `;
}

const profileBackBtn = $("#profileBack");
if(profileBackBtn) profileBackBtn.addEventListener("click", closePlantProfile);
const profileEditBtn = $("#profileEdit");
if(profileEditBtn) profileEditBtn.addEventListener("click", ()=>{
  const plant = store.cultivars.find(c=>c.id===selectedCultivarId);
  if(plant){
    openCultivarDialog(plant);
  }
});
const profileLogBtn = $("#profileLogCare");
if(profileLogBtn) profileLogBtn.addEventListener("click", ()=>{
  const plant = store.cultivars.find(c=>c.id===selectedCultivarId);
  if(plant){
    $("#qcCultivar").value = plant.id;
    $(".nav-btn[data-tab='tab-dashboard']").click();
    $("#qcNotes").focus();
  }
});

/* Care Log */
function renderCareFilters(){
  const sel1 = $("#careFilterCultivar");
  const sel2 = $("#qcCultivar");
  [sel1, sel2].forEach(sel=>{
    const placeholder = sel.id === "qcCultivar" ? "Select a plant" : "All plants";
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    store.cultivars
      .slice()
      .sort(comparePlants)
      .forEach(c=>{
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = plantLabel(c);
        sel.appendChild(opt);
      });
  });
}
$("#qcDate").value = todayStr();
$("#quickCareForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const plant = $("#qcCultivar").value;
  if(!plant){ alert("Choose a plant."); return; }
  const obj = {
    id: uid(),
    cultivarId: plant,
    date: $("#qcDate").value || todayStr(),
    action: $("#qcAction").value,
    notes: $("#qcNotes").value.trim()
  };
  store.care.push(obj);
  // Update "next due" calculations by stamping last-care date
  const c = store.cultivars.find(x=>x.id===plant);
  if(c){
    if(obj.action==="Watered") c._lastWater = obj.date;
    if(obj.action==="Fertilized") c._lastFert = obj.date;
  }
  $("#quickCareForm").reset();
  $("#qcDate").value = todayStr();
  saveStore();
});

function renderCareTable(){
  const tbody = $("#careTable tbody");
  const fId = $("#careFilterCultivar").value;
  const fAction = $("#careFilterAction").value;
  const fFrom = $("#careFilterFrom").value;
  const fTo = $("#careFilterTo").value;

  let rows = store.care.slice().sort((a,b)=> b.date.localeCompare(a.date));
  if(fId) rows = rows.filter(r=>r.cultivarId===fId);
  if(fAction) rows = rows.filter(r=>r.action===fAction);
  if(fFrom) rows = rows.filter(r=>r.date>=fFrom);
  if(fTo) rows = rows.filter(r=>r.date<=fTo);

  tbody.innerHTML = "";
  if(rows.length===0){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "muted";
    td.textContent = "No care entries match the filters.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(r=>{
    const tr = document.createElement("tr");
    const c = store.cultivars.find(x=>x.id===r.cultivarId);
    tr.innerHTML = `
      <td>${escapeHtml(formatDate(r.date))}</td>
      <td>${c ? escapeHtml(plantLabel(c)) : "—"}</td>
      <td>${escapeHtml(r.action)}</td>
      <td>${r.notes ? escapeHtml(r.notes) : ""}</td>
      <td class="row-actions"></td>
    `;
    const actions = tr.querySelector(".row-actions");
    const del = document.createElement("button"); del.textContent = "Delete"; del.className="danger";
    del.addEventListener("click", ()=>{
      if(confirm("Delete this care entry?")){
        store.care = store.care.filter(x=>x.id!==r.id);
        saveStore();
      }
    });
    actions.appendChild(del);
    tbody.appendChild(tr);
  });
}
["careFilterCultivar","careFilterAction","careFilterFrom","careFilterTo"].forEach(id=>{
  $("#"+id).addEventListener("change", renderCareTable);
});

$("#btnExportCSV").addEventListener("click", ()=>{
  const rows = [["Date","Plant","Action","Notes"]];
  const mapName = id => plantLabel(store.cultivars.find(c=>c.id===id));
  store.care
    .slice()
    .sort((a,b)=>a.date.localeCompare(b.date))
    .forEach(r=> rows.push([r.date, mapName(r.cultivarId), r.action, r.notes || ""]));
  const csv = rows.map(r=>r.map(csvEscape).join(",")).join("\n");
  download("care_log.csv", csv);
});

/* Dashboard Tasks */
function nextDue(baseDate, intervalDays){
  const start = toDate(baseDate);
  const next = new Date(start.getTime() + intervalDays*86400000);
  return next.toISOString().slice(0,10);
}
function renderTasks(){
  const list = $("#taskList");
  const windowDays = Number($("#filterTaskWindow").value || 14);
  const today = todayStr();

  const items = [];
  store.cultivars.forEach(c=>{
    if(c.waterInterval>0){
      const last = c._lastWater || c.acquired || today;
      const due = nextDue(last, c.waterInterval);
      items.push({type:"Water", plant:c, due});
    }
    if(c.fertInterval>0){
      const last = c._lastFert || c.acquired || today;
      const due = nextDue(last, c.fertInterval);
      items.push({type:"Fertilize", plant:c, due});
    }
  });

  // Filter into upcoming window or overdue
  const now = toDate(today);
  const until = new Date(now.getTime() + windowDays*86400000);
  const inWindow = items.filter(x=> toDate(x.due) <= until );
  inWindow.sort((a,b)=> a.due.localeCompare(b.due));

  list.innerHTML = "";
  if(inWindow.length===0){
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No upcoming tasks in the selected window.";
    list.appendChild(li);
    return;
  }

  inWindow.forEach(it=>{
    const li = document.createElement("li");
    const overdue = toDate(it.due) < now;
    if(overdue) li.classList.add("overdue");
    const left = document.createElement("div");
    left.innerHTML = `<strong>${escapeHtml(it.type)}</strong> — ${escapeHtml(plantLabel(it.plant))} <span class="badge">${escapeHtml(it.due)}${overdue?" · overdue":""}</span>`;
    const right = document.createElement("div");
    right.className = "row-actions";
    const doneBtn = document.createElement("button");
    doneBtn.textContent = "Mark done";
    doneBtn.addEventListener("click", ()=>{
      const action = it.type==="Water" ? "Watered" : "Fertilized";
      store.care.push({ id: uid(), cultivarId: it.plant.id, date: todayStr(), action, notes: "" });
      if(it.type==="Water") it.plant._lastWater = todayStr();
      if(it.type==="Fertilize") it.plant._lastFert = todayStr();
      saveStore();
    });
    right.appendChild(doneBtn);
    li.append(left, right);
    list.appendChild(li);
  });
}
$("#filterTaskWindow").addEventListener("change", renderTasks);

/* Calendar */
function renderCalendar(){
  const cal = $("#calendar");
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y,m,1);
  const startDay = first.getDay(); // 0=Sun
  const last = new Date(y, m+1, 0).getDate();
  cal.innerHTML = "";

  // Build map of due items by date
  const map = {};
  store.cultivars.forEach(c=>{
    const wd = nextDue(c._lastWater || c.acquired || todayStr(), c.waterInterval||7);
    const fd = nextDue(c._lastFert || c.acquired || todayStr(), c.fertInterval||30);
    [ {d:wd, tag:"Water", plant:c}, {d:fd, tag:"Fertilize", plant:c} ].forEach(x=>{
      const d = x.d;
      if(d.slice(0,7) !== `${y}-${String(m+1).padStart(2,'0')}`) return; // only this month
      (map[d] ??= []).push(x);
    });
  });

  // Empty cells for offset
  for(let i=0;i<startDay;i++){
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    cal.appendChild(cell);
  }
  for(let d=1; d<=last; d++){
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const label = document.createElement("div");
    label.className="cal-date";
    label.textContent = d;
    cell.appendChild(label);
    const items = map[dateStr] || [];
    items.forEach(it=>{
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.textContent = `${it.tag}: ${plantLabel(it.plant)}`;
      cell.appendChild(tag);
    });
    cal.appendChild(cell);
  }
}

/* Settings: Import/Export/Erase */
$("#btnExport").addEventListener("click", ()=>{
  download("african_violets_backup.json", JSON.stringify(store, null, 2));
});
$("#btnImport").addEventListener("click", ()=> $("#fileImport").click());
$("#fileImport").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  const text = await file.text();
  try{
    const data = JSON.parse(text);
    if(!data || !Array.isArray(data.cultivars) || !Array.isArray(data.care)){
      alert("Invalid backup file.");
      return;
    }
    store = normalizeStore(data);
    saveStore();
    alert("Imported successfully.");
  }catch(err){
    alert("Failed to import: " + err.message);
  }finally{
    e.target.value = "";
  }
});
$("#btnErase").addEventListener("click", ()=>{
  if(confirm("Erase all plants and care history? This cannot be undone.")){
    store = { cultivars: [], care: [] };
    saveStore();
  }
});
$("#btnLoadSample").addEventListener("click", ()=>{
  fetch("sample_data.json").then(r=>r.json()).then(data=>{
    store = normalizeStore(data);
    saveStore();
  }).catch(()=> alert("Could not load sample data."));
});

/* Initial Render */
function renderAll(){
  renderCultivars();
  renderPlantProfile();
  renderCareFilters();
  renderCareTable();
  renderTasks();
  renderCalendar();
}
renderAll();
