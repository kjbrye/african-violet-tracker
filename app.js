
/* African Violets — Plants & Care (vanilla JS, localStorage) */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const STORE_KEY = "african_violets_store_v1";
const PLACEHOLDER_PHOTO = "logo.svg";
const VIEW_MODE_KEY = "cultivar_view_mode_v1";

let store = loadStore();
let selectedCultivarId = null;
let selectedProjectId = null;
let cultivarViewMode = localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "tiles";
function loadStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return normalizeStore({ cultivars: [], care: [], projects: [] });
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  }catch(e){
    console.error("Failed to parse store", e);
    return normalizeStore({ cultivars: [], care: [], projects: [] });
  }
}
function normalizeStore(data){
  const cultivars = Array.isArray(data?.cultivars) ? data.cultivars.map(normalizePlant) : [];
  const care = Array.isArray(data?.care) ? data.care.map(entry=>({ ...entry })) : [];
  const projects = Array.isArray(data?.projects) ? data.projects.map(normalizeProject) : [];
  return { cultivars, care, projects };
}
function normalizePlant(plant){
  const cultivarName = String(plant?.cultivarName ?? plant?.name ?? "").trim();
  const nickname = String(plant?.nickname ?? "").trim();
  const fertilizerNpk = String(plant?.fertilizerNpk ?? "").trim();
  const fertilizerMethod = String(plant?.fertilizerMethod ?? "").trim();
  const normalized = { ...plant, cultivarName, nickname, fertilizerNpk, fertilizerMethod };
  delete normalized.name;
  return normalized;
}

const PROJECT_STATUS_LABELS = {
  planning: "Planning",
  pollinated: "Pollinated",
  seedlings: "Seedlings Growing",
  blooming: "Blooming & Selecting",
  registered: "Registered/Named",
  archived: "Archived"
};

const OFFSPRING_STATUS_LABELS = {
  seedling: "Seedling",
  blooming: "Blooming",
  keeper: "Keeper",
  culled: "Culled",
  shared: "Shared",
  registered: "Registered"
};

function normalizeProject(project){
  const safe = project && typeof project === "object" ? project : {};
  const name = String(safe.name ?? "").trim();
  const type = safe.type === "exploratory" ? "exploratory" : "goal";
  const goal = String(safe.goal ?? safe.endGoal ?? "").trim();
  const traits = String(safe.traits ?? safe.variablesNote ?? "").trim();
  const results = String(safe.results ?? "").trim();
  const notes = String(safe.notes ?? "").trim();
  const status = PROJECT_STATUS_LABELS[safe.status] ? safe.status : "planning";
  const startDate = safe.startDate ? String(safe.startDate) : "";
  const createdAt = safe.createdAt ? String(safe.createdAt) : new Date().toISOString();
  const updatedAt = safe.updatedAt ? String(safe.updatedAt) : createdAt;
  const parents = Array.isArray(safe.parents) ? safe.parents.map(normalizeProjectParent).filter(Boolean) : [];
  const offspring = Array.isArray(safe.offspring) ? safe.offspring.map(normalizeProjectOffspring).filter(Boolean) : [];
  const timeline = Array.isArray(safe.timeline) ? safe.timeline.map(normalizeProjectTimeline).filter(Boolean) : [];
  timeline.sort((a,b)=> (a.date||"").localeCompare(b.date||""));
  const variables = Array.isArray(safe.variables) ? safe.variables.map(normalizeProjectVariable).filter(Boolean) : [];
  return {
    id: safe.id || uid(),
    name,
    type,
    goal,
    traits,
    results,
    notes,
    status,
    startDate,
    parents,
    offspring,
    timeline,
    variables,
    createdAt,
    updatedAt
  };
}

function normalizeProjectParent(parent){
  if(!parent) return null;
  const name = String(parent.name ?? parent.parent ?? "").trim();
  const cultivarId = parent.cultivarId ? String(parent.cultivarId) : "";
  const role = parent.role === "seed" || parent.role === "pollen" ? parent.role : "unknown";
  const notes = String(parent.notes ?? parent.details ?? "").trim();
  if(!name && !notes) return null;
  return {
    id: parent.id || uid(),
    name,
    cultivarId,
    role,
    notes
  };
}

function normalizeProjectOffspring(entry){
  if(!entry) return null;
  const name = String(entry.name ?? entry.seedling ?? "").trim();
  const statusOptions = ["seedling","blooming","keeper","culled","shared","registered"];
  const status = statusOptions.includes(entry.status) ? entry.status : "seedling";
  const notes = String(entry.notes ?? entry.description ?? "").trim();
  const date = entry.date ? String(entry.date) : "";
  if(!name && !notes && !date) return null;
  return {
    id: entry.id || uid(),
    name,
    status,
    notes,
    date
  };
}

function normalizeProjectTimeline(entry){
  if(!entry) return null;
  const date = entry.date ? String(entry.date) : "";
  const note = String(entry.note ?? entry.event ?? entry.description ?? "").trim();
  if(!note && !date) return null;
  return {
    id: entry.id || uid(),
    date,
    note
  };
}

function normalizeProjectVariable(entry){
  if(!entry) return null;
  const label = String(entry.label ?? entry.name ?? entry.variable ?? "").trim();
  const value = String(entry.value ?? entry.detail ?? entry.description ?? "").trim();
  const notes = String(entry.notes ?? "").trim();
  if(!label && !value && !notes) return null;
  return {
    id: entry.id || uid(),
    label,
    value,
    notes
  };
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

const viewSwitchButtons = $$(".view-switch-btn[data-view]");
function syncViewSwitchButtons(mode){
  viewSwitchButtons.forEach(btn => {
    const isActive = btn.dataset.view === mode;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}
function setCultivarView(mode, { skipRender } = {}){
  if(mode !== "list" && mode !== "tiles") mode = "tiles";
  if(cultivarViewMode === mode && !skipRender){
    syncViewSwitchButtons(mode);
    return;
  }
  cultivarViewMode = mode;
  localStorage.setItem(VIEW_MODE_KEY, mode);
  syncViewSwitchButtons(mode);
  if(!skipRender){
    renderCultivars();
  }
}
viewSwitchButtons.forEach(btn => {
  btn.addEventListener("click", () => setCultivarView(btn.dataset.view));
});
syncViewSwitchButtons(cultivarViewMode);

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
  $("#cvFertilizerNpk").value = cv?.fertilizerNpk || "";
  $("#cvFertilizerMethod").value = cv?.fertilizerMethod || "";
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
      fertilizerNpk: get("cvFertilizerNpk").trim(),
      fertilizerMethod: get("cvFertilizerMethod").trim(),
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

  grid.className = "grid-cards";
  grid.classList.add(cultivarViewMode === "list" ? "view-list" : "view-tiles");
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
    if(cultivarViewMode === "list") div.classList.add("card-plant--list");
    div.setAttribute("tabindex","0");
    div.setAttribute("role","button");
    div.setAttribute("aria-label",`View profile for ${plantLabel(c)}`);
    if(selectedCultivarId===c.id) div.classList.add("is-selected");
    const img = document.createElement("img");
    img.alt = plantLabel(c);
    const { src, placeholder } = plantPhoto(c);
    img.src = src;
    if(placeholder) img.classList.add("placeholder");
    const title = c.nickname || c.cultivarName || "Unnamed plant";
    const subtitle = c.cultivarName && c.cultivarName !== title ? c.cultivarName : "";
    const h3 = document.createElement("h3");
    h3.textContent = title;
    const info = document.createElement("div");
    info.className = "card-plant-info";
    info.appendChild(h3);
    if(subtitle){
      const cultivar = document.createElement("div");
      cultivar.className = "card-plant-subtitle";
      cultivar.className = "card-plant-subtitle muted";
      cultivar.textContent = subtitle;
      info.appendChild(cultivar);
    }
    const metaHtml = [
      c.blossom ? `<span class="badge">${escapeHtml(c.blossom)}</span>`:"",
      c.color ? `<span class="badge">${escapeHtml(c.color)}</span>`:"",
      c.leaf ? `<span class="badge">${escapeHtml(c.leaf)}</span>`:"",
      c.location ? `<span class="badge">📍 ${escapeHtml(c.location)}</span>`:""
    ].filter(Boolean).join(" ");
    if(metaHtml){
      const meta = document.createElement("div");
      meta.className = "card-plant-meta";
      meta.innerHTML = metaHtml;
      info.appendChild(meta);
    }
    if(c.notes){
      const notes = document.createElement("div");
      notes.className = "card-plant-notes";
      notes.textContent = c.notes;
      info.appendChild(notes);
    }
    if(c.fertilizerNpk || c.fertilizerMethod){
      const fert = document.createElement("div");
      fert.className = "card-plant-fertilizer muted";
      const label = document.createElement("strong");
      label.textContent = "Fertilizer:";
      fert.appendChild(label);
      const parts = [];
      if(c.fertilizerNpk) parts.push(`NPK ${c.fertilizerNpk}`);
      if(c.fertilizerMethod) parts.push(c.fertilizerMethod);
      const value = document.createElement("span");
      value.textContent = parts.join(" · ");
      if(value.textContent){
        value.insertAdjacentText("afterbegin", " ");
      }
      fert.appendChild(value);
      info.appendChild(fert);
    }
    const actions = document.createElement("div");
    actions.className = "row-actions card-plant-actions";
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
    div.append(img, info, actions);
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
    {label:"Fertilizer Interval", value: plant.fertInterval ? escapeHtml(`${plant.fertInterval} days`) : "—"},
    {label:"Fertilizer NPK", value: plant.fertilizerNpk ? escapeHtml(plant.fertilizerNpk) : "—"},
    {label:"Fertilizer Method", value: plant.fertilizerMethod ? escapeHtml(plant.fertilizerMethod) : "—"}
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

  const { src: photoSrc, placeholder } = plantPhoto(plant);
  const photoClasses = ["profile-photo", placeholder ? "placeholder" : ""].filter(Boolean).join(" ");
  const photo = `<img src="${photoSrc}" alt="${escapeHtml(plantLabel(plant))}" class="${photoClasses}" />`;
  const title = plant.nickname || plant.cultivarName || "Unnamed plant";
  const subtitle = plant.cultivarName && plant.cultivarName !== title ? plant.cultivarName : "";

  content.innerHTML = `
    <div class="profile-header">
      ${photo}
      <div class="profile-summary">
        <h3>${escapeHtml(title)}</h3>
        ${subtitle ? `<div class="profile-subtitle">${escapeHtml(subtitle)}</div>` : ""}
        ${subtitle ? `<div class="profile-subtitle muted">${escapeHtml(subtitle)}</div>` : ""}
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

/* Hybridization Projects */
const projectDialog = $("#projectDialog");
const projectForm = $("#projectForm");
const projectParentList = $("#projectParentList");
const projectOffspringList = $("#projectOffspringList");
const projectTimelineList = $("#projectTimelineList");
const projectVariableList = $("#projectVariableList");
const projectSearchInput = $("#projectSearch");

function projectStatusLabel(status){
  return PROJECT_STATUS_LABELS[status] || PROJECT_STATUS_LABELS.planning;
}

function projectOffspringStatusLabel(status){
  return OFFSPRING_STATUS_LABELS[status] || OFFSPRING_STATUS_LABELS.seedling;
}

function projectTypeLabel(type){
  return type === "exploratory" ? "Exploratory (just for fun)" : "Goal-driven";
}

function projectStatusClass(status){
  return (status || "planning").toString().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function syncProjectTypeControls(){
  const typeSelect = $("#projectType");
  const note = $("#projectTypeNote");
  const goalGroup = $("#projectGoalGroup");
  if(!typeSelect || !note || !goalGroup) return;
  const type = typeSelect.value === "exploratory" ? "exploratory" : "goal";
  if(type === "exploratory"){
    note.textContent = "Exploratory projects celebrate surprises—capture observations without a fixed end goal.";
    goalGroup.classList.add("hidden");
  }else{
    note.textContent = "Describe the bloom, foliage, and habit you hope to achieve to guide your selections.";
    goalGroup.classList.remove("hidden");
  }
}

function resetProjectForm(){
  if(projectForm) projectForm.reset();
  [projectParentList, projectOffspringList, projectTimelineList, projectVariableList].forEach(list=>{
    if(list) list.innerHTML = "";
  });
}

function addParentRow(data={}){
  if(!projectParentList) return;
  const row = document.createElement("div");
  row.className = "repeat-item";
  if(data.id) row.dataset.id = data.id;
  if(data.cultivarId) row.dataset.cultivarId = data.cultivarId;

  const fields = document.createElement("div");
  fields.className = "repeat-item-fields cols-3";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Parent Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Cultivar or descriptor";
  nameInput.dataset.field = "name";
  nameInput.setAttribute("list", "projectParentSuggestions");
  if(data.name) nameInput.value = data.name;
  nameLabel.appendChild(nameInput);
  fields.appendChild(nameLabel);

  const roleLabel = document.createElement("label");
  roleLabel.textContent = "Role";
  const roleSelect = document.createElement("select");
  roleSelect.dataset.field = "role";
  [
    { value: "", label: "—" },
    { value: "seed", label: "Seed parent" },
    { value: "pollen", label: "Pollen parent" },
    { value: "unknown", label: "Shared/Unknown" }
  ].forEach(opt=>{
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    roleSelect.appendChild(option);
  });
  roleSelect.value = data.role && ["seed","pollen","unknown"].includes(data.role) ? data.role : "";
  roleLabel.appendChild(roleSelect);
  fields.appendChild(roleLabel);

  const notesLabel = document.createElement("label");
  notesLabel.textContent = "Notes";
  const notesInput = document.createElement("input");
  notesInput.type = "text";
  notesInput.placeholder = "Clone, leaf type, etc.";
  notesInput.dataset.field = "notes";
  if(data.notes) notesInput.value = data.notes;
  notesLabel.appendChild(notesInput);
  fields.appendChild(notesLabel);

  row.appendChild(fields);

  const actions = document.createElement("div");
  actions.className = "repeat-item-actions";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-link danger";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", ()=> row.remove());
  actions.appendChild(removeBtn);
  row.appendChild(actions);

  projectParentList.appendChild(row);
}

function addOffspringRow(data={}){
  if(!projectOffspringList) return;
  const row = document.createElement("div");
  row.className = "repeat-item";
  if(data.id) row.dataset.id = data.id;

  const top = document.createElement("div");
  top.className = "repeat-item-fields cols-3";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Seedling / Selection";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Tag or nickname";
  nameInput.dataset.field = "name";
  if(data.name) nameInput.value = data.name;
  nameLabel.appendChild(nameInput);
  top.appendChild(nameLabel);

  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Stage";
  const statusSelect = document.createElement("select");
  statusSelect.dataset.field = "status";
  ["seedling","blooming","keeper","culled","shared","registered"].forEach(value=>{
    const option = document.createElement("option");
    option.value = value;
    option.textContent = projectOffspringStatusLabel(value);
    statusSelect.appendChild(option);
  });
  statusSelect.value = data.status && OFFSPRING_STATUS_LABELS[data.status] ? data.status : "seedling";
  statusLabel.appendChild(statusSelect);
  top.appendChild(statusLabel);

  const dateLabel = document.createElement("label");
  dateLabel.textContent = "Date";
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.dataset.field = "date";
  if(data.date) dateInput.value = data.date;
  dateLabel.appendChild(dateInput);
  top.appendChild(dateLabel);

  row.appendChild(top);

  const notesWrap = document.createElement("div");
  notesWrap.className = "repeat-item-fields";
  const notesLabel = document.createElement("label");
  notesLabel.textContent = "Notes";
  const notesArea = document.createElement("textarea");
  notesArea.rows = 2;
  notesArea.dataset.field = "notes";
  notesArea.placeholder = "Traits, decisions, keeper reasons";
  if(data.notes) notesArea.value = data.notes;
  notesLabel.appendChild(notesArea);
  notesWrap.appendChild(notesLabel);
  row.appendChild(notesWrap);

  const actions = document.createElement("div");
  actions.className = "repeat-item-actions";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-link danger";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", ()=> row.remove());
  actions.appendChild(removeBtn);
  row.appendChild(actions);

  projectOffspringList.appendChild(row);
}

function addTimelineRow(data={}){
  if(!projectTimelineList) return;
  const row = document.createElement("div");
  row.className = "repeat-item";
  if(data.id) row.dataset.id = data.id;

  const fields = document.createElement("div");
  fields.className = "repeat-item-fields cols-2";

  const dateLabel = document.createElement("label");
  dateLabel.textContent = "Date";
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.dataset.field = "date";
  if(data.date) dateInput.value = data.date;
  dateLabel.appendChild(dateInput);
  fields.appendChild(dateLabel);

  const noteLabel = document.createElement("label");
  noteLabel.textContent = "Milestone";
  const noteArea = document.createElement("textarea");
  noteArea.rows = 2;
  noteArea.dataset.field = "note";
  noteArea.placeholder = "Pollinated, sowed seed, first bloom, selection notes…";
  if(data.note) noteArea.value = data.note;
  noteLabel.appendChild(noteArea);
  fields.appendChild(noteLabel);

  row.appendChild(fields);

  const actions = document.createElement("div");
  actions.className = "repeat-item-actions";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-link danger";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", ()=> row.remove());
  actions.appendChild(removeBtn);
  row.appendChild(actions);

  projectTimelineList.appendChild(row);
}

function addVariableRow(data={}){
  if(!projectVariableList) return;
  const row = document.createElement("div");
  row.className = "repeat-item";
  if(data.id) row.dataset.id = data.id;

  const fields = document.createElement("div");
  fields.className = "repeat-item-fields cols-2";

  const labelLabel = document.createElement("label");
  labelLabel.textContent = "Factor";
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.placeholder = "e.g., Soil mix, fertilizer";
  labelInput.dataset.field = "label";
  if(data.label) labelInput.value = data.label;
  labelLabel.appendChild(labelInput);
  fields.appendChild(labelLabel);

  const valueLabel = document.createElement("label");
  valueLabel.textContent = "Details";
  const valueArea = document.createElement("textarea");
  valueArea.rows = 2;
  valueArea.placeholder = "Ratios, timings, light levels…";
  valueArea.dataset.field = "value";
  if(data.value) valueArea.value = data.value;
  valueLabel.appendChild(valueArea);
  fields.appendChild(valueLabel);

  row.appendChild(fields);

  const notesWrap = document.createElement("div");
  notesWrap.className = "repeat-item-fields";
  const notesLabel = document.createElement("label");
  notesLabel.textContent = "Notes";
  const notesArea = document.createElement("textarea");
  notesArea.rows = 2;
  notesArea.placeholder = "Observations, adjustments";
  notesArea.dataset.field = "notes";
  if(data.notes) notesArea.value = data.notes;
  notesLabel.appendChild(notesArea);
  notesWrap.appendChild(notesLabel);
  row.appendChild(notesWrap);

  const actions = document.createElement("div");
  actions.className = "repeat-item-actions";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn-link danger";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", ()=> row.remove());
  actions.appendChild(removeBtn);
  row.appendChild(actions);

  projectVariableList.appendChild(row);
}

function collectParentData(){
  if(!projectParentList) return [];
  return Array.from(projectParentList.querySelectorAll(".repeat-item")).map(row=>{
    const name = row.querySelector("[data-field='name']")?.value.trim() || "";
    const role = row.querySelector("[data-field='role']")?.value || "";
    const notes = row.querySelector("[data-field='notes']")?.value.trim() || "";
    const cultivarId = row.dataset.cultivarId ? String(row.dataset.cultivarId) : "";
    if(!name && !notes) return null;
    return {
      id: row.dataset.id || uid(),
      name,
      role: role || "unknown",
      notes,
      cultivarId
    };
  }).filter(Boolean);
}

function collectOffspringData(){
  if(!projectOffspringList) return [];
  return Array.from(projectOffspringList.querySelectorAll(".repeat-item")).map(row=>{
    const name = row.querySelector("[data-field='name']")?.value.trim() || "";
    const status = row.querySelector("[data-field='status']")?.value || "seedling";
    const date = row.querySelector("[data-field='date']")?.value || "";
    const notes = row.querySelector("[data-field='notes']")?.value.trim() || "";
    if(!name && !notes && !date) return null;
    return {
      id: row.dataset.id || uid(),
      name,
      status,
      date,
      notes
    };
  }).filter(Boolean);
}

function collectTimelineData(){
  if(!projectTimelineList) return [];
  return Array.from(projectTimelineList.querySelectorAll(".repeat-item")).map(row=>{
    const date = row.querySelector("[data-field='date']")?.value || "";
    const note = row.querySelector("[data-field='note']")?.value.trim() || "";
    if(!note && !date) return null;
    return {
      id: row.dataset.id || uid(),
      date,
      note
    };
  }).filter(Boolean).sort((a,b)=> (a.date||"").localeCompare(b.date||""));
}

function collectVariableData(){
  if(!projectVariableList) return [];
  return Array.from(projectVariableList.querySelectorAll(".repeat-item")).map(row=>{
    const label = row.querySelector("[data-field='label']")?.value.trim() || "";
    const value = row.querySelector("[data-field='value']")?.value.trim() || "";
    const notes = row.querySelector("[data-field='notes']")?.value.trim() || "";
    if(!label && !value && !notes) return null;
    return {
      id: row.dataset.id || uid(),
      label,
      value,
      notes
    };
  }).filter(Boolean);
}

function openProjectDialog(project=null){
  if(!projectDialog || !projectForm) return;
  resetProjectForm();
  const get = (id)=>$("#"+id);
  const title = get("projectDialogTitle");
  if(title) title.textContent = project ? "Edit Hybridization Project" : "Add Hybridization Project";
  const idField = get("projectId");
  if(idField) idField.value = project?.id || "";
  const nameField = get("projectName");
  if(nameField) nameField.value = project?.name || "";
  const typeField = get("projectType");
  if(typeField) typeField.value = project?.type === "exploratory" ? "exploratory" : "goal";
  const startField = get("projectStartDate");
  if(startField){
    startField.value = project?.startDate || "";
    if(!project && !startField.value) startField.value = todayStr();
  }
  const statusField = get("projectStatus");
  if(statusField) statusField.value = PROJECT_STATUS_LABELS[project?.status] ? project.status : "planning";
  const goalField = get("projectGoal");
  if(goalField) goalField.value = project?.goal || "";
  const traitsField = get("projectTraits");
  if(traitsField) traitsField.value = project?.traits || "";
  const resultsField = get("projectResults");
  if(resultsField) resultsField.value = project?.results || "";
  const notesField = get("projectNotes");
  if(notesField) notesField.value = project?.notes || "";

  syncProjectTypeControls();

  if(project?.parents?.length){
    project.parents.forEach(p=>addParentRow(p));
  }else{
    addParentRow();
    addParentRow();
  }
  if(project?.offspring?.length){
    project.offspring.forEach(o=>addOffspringRow(o));
  }else{
    addOffspringRow();
  }
  if(project?.timeline?.length){
    project.timeline.forEach(t=>addTimelineRow(t));
  }else{
    addTimelineRow();
  }
  if(project?.variables?.length){
    project.variables.forEach(v=>addVariableRow(v));
  }else{
    addVariableRow();
  }

  renderProjectParentSuggestions();
  projectDialog.showModal();
}

function saveProjectFromForm(){
  if(!projectForm) return;
  const get = (id)=>$("#"+id);
  const idField = get("projectId");
  const nameField = get("projectName");
  if(!nameField) return;
  const id = idField?.value || uid();
  const name = nameField.value.trim();
  if(!name){
    alert("Project name is required.");
    return;
  }
  const typeSelect = get("projectType");
  const type = typeSelect && typeSelect.value === "exploratory" ? "exploratory" : "goal";
  const statusSelect = get("projectStatus");
  const statusValue = statusSelect && PROJECT_STATUS_LABELS[statusSelect.value] ? statusSelect.value : "planning";
  const goalField = get("projectGoal");
  const traitsField = get("projectTraits");
  const resultsField = get("projectResults");
  const notesField = get("projectNotes");
  const startField = get("projectStartDate");

  const projectData = {
    id,
    name,
    type,
    status: statusValue,
    startDate: startField?.value || "",
    goal: goalField?.value.trim() || "",
    traits: traitsField?.value.trim() || "",
    results: resultsField?.value.trim() || "",
    notes: notesField?.value.trim() || "",
    parents: collectParentData(),
    offspring: collectOffspringData(),
    timeline: collectTimelineData(),
    variables: collectVariableData()
  };

  const now = new Date().toISOString();
  const existing = store.projects.find(p=>p.id===id);
  if(existing){
    Object.assign(existing, projectData, { updatedAt: now });
  }else{
    store.projects.push({ ...projectData, createdAt: now, updatedAt: now });
  }
  selectedProjectId = id;
  saveStore();
  if(projectDialog) projectDialog.close();
}

function deleteProject(id){
  const project = store.projects.find(p=>p.id===id);
  if(!project) return;
  if(!confirm(`Delete project "${project.name || "Untitled project"}"? This cannot be undone.`)) return;
  store.projects = store.projects.filter(p=>p.id!==id);
  if(selectedProjectId === id) selectedProjectId = null;
  saveStore();
}

function projectMatchesSearch(project, query){
  if(!query) return true;
  const hay = [
    project.name,
    project.goal,
    project.traits,
    project.results,
    project.notes,
    (project.parents || []).map(p=>`${p.name} ${p.notes || ""}`).join(" "),
    (project.offspring || []).map(o=>`${o.name} ${o.notes || ""}`).join(" "),
    (project.timeline || []).map(t=>`${t.note} ${t.date || ""}`).join(" "),
    (project.variables || []).map(v=>`${v.label} ${v.value} ${v.notes || ""}`).join(" ")
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(query);
}

function renderProjectParentSuggestions(){
  const list = $("#projectParentSuggestions");
  if(!list) return;
  const options = store.cultivars
    .slice()
    .sort(comparePlants)
    .map(c=>`<option value="${escapeHtml(plantLabel(c))}"></option>`)
    .join("");
  list.innerHTML = options;
}

function renderProjects(){
  const list = $("#projectList");
  if(!list) return;
  const query = (projectSearchInput?.value || "").toLowerCase().trim();
  const projects = store.projects
    .slice()
    .sort((a,b)=>{
      const name = (a.name || "").localeCompare(b.name || "");
      if(name !== 0) return name;
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    })
    .filter(p=>projectMatchesSearch(p, query));

  list.innerHTML = "";
  if(projects.length === 0){
    const message = document.createElement("p");
    message.className = "empty";
    message.textContent = store.projects.length ? "No projects match your search." : "No hybridization projects yet. Start one!";
    list.appendChild(message);
    return;
  }

  projects.forEach(project=>{
    const card = document.createElement("article");
    card.className = "project-card";
    card.setAttribute("tabindex","0");
    card.setAttribute("role","button");
    card.setAttribute("aria-label",`View project ${project.name || "Untitled project"}`);
    if(project.id === selectedProjectId) card.classList.add("is-selected");

    const title = document.createElement("h3");
    title.textContent = project.name || "Untitled project";
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "project-card-meta";
    const typeBadge = document.createElement("span");
    typeBadge.className = "badge badge--type" + (project.type === "exploratory" ? " exploratory" : "");
    typeBadge.textContent = projectTypeLabel(project.type);
    meta.appendChild(typeBadge);
    const statusBadge = document.createElement("span");
    statusBadge.className = `badge badge--status status-${projectStatusClass(project.status)}`;
    statusBadge.textContent = projectStatusLabel(project.status);
    meta.appendChild(statusBadge);
    card.appendChild(meta);

    const summaryText = project.type === "goal" && project.goal
      ? project.goal
      : project.results || project.traits || project.notes || "Log seedlings and milestones as you explore.";
    const summary = document.createElement("div");
    summary.className = "project-card-summary";
    summary.textContent = summaryText;
    card.appendChild(summary);

    const footer = document.createElement("div");
    footer.className = "project-card-footer";
    const metaText = document.createElement("span");
    metaText.className = "muted small";
    const sortedTimeline = (project.timeline || []).slice().sort((a,b)=> (a.date||"").localeCompare(b.date||""));
    const latest = sortedTimeline.length ? sortedTimeline[sortedTimeline.length - 1] : null;
    if(latest){
      const dateLabel = latest.date ? formatDate(latest.date) : "Update";
      metaText.textContent = `${dateLabel}: ${latest.note}`;
    }else if(project.startDate){
      metaText.textContent = `Started ${formatDate(project.startDate)}`;
    }else if(project.createdAt){
      metaText.textContent = `Logged ${formatDate((project.createdAt || "").slice(0,10))}`;
    }else{
      metaText.textContent = "No timeline yet";
    }
    footer.appendChild(metaText);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (ev)=>{ ev.stopPropagation(); openProjectDialog(project); });
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (ev)=>{ ev.stopPropagation(); deleteProject(project.id); });
    actions.append(editBtn, deleteBtn);
    footer.appendChild(actions);

    card.appendChild(footer);

    card.addEventListener("click", ()=> openProjectDetail(project.id));
    card.addEventListener("keydown", (ev)=>{
      if(ev.key === "Enter" || ev.key === " "){
        ev.preventDefault();
        openProjectDetail(project.id);
      }
    });

    list.appendChild(card);
  });
}

function openProjectDetail(id){
  selectedProjectId = id;
  renderProjectDetail();
  renderProjects();
  const panel = $("#projectDetail");
  if(panel){
    panel.classList.remove("hidden");
    if(!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex","-1");
    panel.focus?.();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderProjectDetail(){
  const panel = $("#projectDetail");
  const content = $("#projectDetailContent");
  const editBtn = $("#projectDetailEdit");
  const deleteBtn = $("#projectDetailDelete");
  if(!panel || !content) return;

  const project = store.projects.find(p=>p.id===selectedProjectId);
  if(!project){
    if(selectedProjectId){
      selectedProjectId = null;
    }
    panel.classList.add("hidden");
    content.innerHTML = "<p class=\"muted\">Select a project to view its details.</p>";
    if(editBtn) editBtn.disabled = true;
    if(deleteBtn) deleteBtn.disabled = true;
    return;
  }

  panel.classList.remove("hidden");
  if(editBtn) editBtn.disabled = false;
  if(deleteBtn) deleteBtn.disabled = false;

  const statusClass = projectStatusClass(project.status);
  const typeClass = project.type === "exploratory" ? "badge badge--type exploratory" : "badge badge--type";
  const start = project.startDate ? `Started ${formatDate(project.startDate)}` : "";
  const created = project.createdAt ? `Logged ${formatDate((project.createdAt || "").slice(0,10))}` : "";
  const updated = project.updatedAt ? `Updated ${formatDate((project.updatedAt || "").slice(0,10))}` : "";
  const dates = [start, created, updated].filter(Boolean).join(" · ");

  const parents = project.parents?.length
    ? `<ul class="structured-list">${project.parents.map(parent=>{
        const role = parent.role === "seed" ? "Seed parent" : parent.role === "pollen" ? "Pollen parent" : "Parent";
        const meta = [role];
        if(parent.notes) meta.push(parent.notes);
        return `<li><strong>${escapeHtml(parent.name)}</strong>${meta.length ? `<div class=\"muted small\">${escapeHtml(meta.join(" · "))}</div>` : ""}</li>`;
      }).join("")}</ul>`
    : `<p class="muted">No parents recorded yet.</p>`;

  const offspring = project.offspring?.length
    ? `<ul class="structured-list">${project.offspring.map(child=>{
        const parts = [];
        if(child.status) parts.push(projectOffspringStatusLabel(child.status));
        if(child.date) parts.push(formatDate(child.date));
        const meta = parts.length ? `<div class=\"muted small\">${escapeHtml(parts.join(" · "))}</div>` : "";
        const notes = child.notes ? `<div>${escapeHtml(child.notes)}</div>` : "";
        return `<li><strong>${escapeHtml(child.name)}</strong>${meta}${notes}</li>`;
      }).join("")}</ul>`
    : `<p class="muted">No seedlings tracked yet.</p>`;

  const sortedTimeline = (project.timeline || []).slice().sort((a,b)=> (a.date||"").localeCompare(b.date||""));
  const timeline = sortedTimeline.length
    ? `<div class="timeline-list">${sortedTimeline.map(item=>{
        const label = item.date ? formatDate(item.date) : "Undated";
        return `<div class=\"timeline-item\"><div class=\"timeline-item-date\">${escapeHtml(label)}</div><div class=\"timeline-item-note\">${escapeHtml(item.note)}</div></div>`;
      }).join("")}</div>`
    : `<p class="muted">Add milestones to follow progress from pollination to bloom.</p>`;

  const variables = project.variables?.length
    ? `<ul class="structured-list">${project.variables.map(v=>{
        const extras = [v.value ? `<div>${escapeHtml(v.value)}</div>` : "", v.notes ? `<div class=\"muted small\">${escapeHtml(v.notes)}</div>` : ""].join("");
        return `<li><strong>${escapeHtml(v.label)}</strong>${extras}</li>`;
      }).join("")}</ul>`
    : `<p class="muted">Document soil, lighting, or feeding experiments here.</p>`;

  const goalBlock = project.type === "exploratory"
    ? (project.goal ? `<p>${escapeHtml(project.goal)}</p>` : `<p class="muted">Exploratory project—no defined end goal.</p>`)
    : (project.goal ? `<p>${escapeHtml(project.goal)}</p>` : `<p class="muted">Add the vision for this cross to guide selections.</p>`);

  const traitsBlock = project.traits
    ? `<p>${escapeHtml(project.traits)}</p>`
    : `<p class="muted">List target traits or experiment variables.</p>`;

  const resultsBlock = project.results
    ? `<p>${escapeHtml(project.results)}</p>`
    : `<p class="muted">Summarize bloom results, standouts, or registration progress.</p>`;

  const notesBlock = project.notes
    ? `<p>${escapeHtml(project.notes)}</p>`
    : `<p class="muted">Capture extra context, follow-ups, or observations.</p>`;

  content.innerHTML = `
    <div class="project-detail-summary">
      <h3>${escapeHtml(project.name || "Untitled project")}</h3>
      <div class="project-detail-meta">
        <span class="${typeClass}">${escapeHtml(projectTypeLabel(project.type))}</span>
        <span class="badge badge--status status-${escapeHtml(statusClass)}">${escapeHtml(projectStatusLabel(project.status))}</span>
      </div>
      ${dates ? `<div class="project-detail-dates">${escapeHtml(dates)}</div>` : ""}
    </div>
    <section class="project-detail-section">
      <h4>Vision</h4>
      ${goalBlock}
    </section>
    <section class="project-detail-section">
      <h4>Target Traits &amp; Strategy</h4>
      ${traitsBlock}
    </section>
    <div class="project-detail-columns">
      <section class="project-detail-section">
        <h4>Parents</h4>
        ${parents}
      </section>
      <section class="project-detail-section">
        <h4>Offspring &amp; Selections</h4>
        ${offspring}
      </section>
    </div>
    <section class="project-detail-section">
      <h4>Timeline</h4>
      ${timeline}
    </section>
    <section class="project-detail-section">
      <h4>Experiment Variables</h4>
      ${variables}
    </section>
    <section class="project-detail-section">
      <h4>Results</h4>
      ${resultsBlock}
    </section>
    <section class="project-detail-section">
      <h4>Notes</h4>
      ${notesBlock}
    </section>
  `;
}

if(projectForm) projectForm.addEventListener("submit", (e)=> e.preventDefault());
if(projectDialog) projectDialog.addEventListener("close", resetProjectForm);
if(projectSearchInput) projectSearchInput.addEventListener("input", renderProjects);
const addProjectBtn = $("#btnAddProject");
if(addProjectBtn) addProjectBtn.addEventListener("click", ()=> openProjectDialog());
const addParentBtn = $("#btnAddParent");
if(addParentBtn) addParentBtn.addEventListener("click", ()=> addParentRow());
const addOffspringBtn = $("#btnAddOffspring");
if(addOffspringBtn) addOffspringBtn.addEventListener("click", ()=> addOffspringRow());
const addTimelineBtn = $("#btnAddTimeline");
if(addTimelineBtn) addTimelineBtn.addEventListener("click", ()=> addTimelineRow());
const addVariableBtn = $("#btnAddVariable");
if(addVariableBtn) addVariableBtn.addEventListener("click", ()=> addVariableRow());
const saveProjectBtn = $("#saveProject");
if(saveProjectBtn) saveProjectBtn.addEventListener("click", (e)=>{ e.preventDefault(); saveProjectFromForm(); });
const cancelProjectBtn = $("#cancelProject");
if(cancelProjectBtn) cancelProjectBtn.addEventListener("click", ()=>{ if(projectDialog) projectDialog.close(); });
const projectTypeSelect = $("#projectType");
if(projectTypeSelect) projectTypeSelect.addEventListener("change", syncProjectTypeControls);
const projectDetailBack = $("#projectDetailBack");
if(projectDetailBack) projectDetailBack.addEventListener("click", ()=>{
  selectedProjectId = null;
  renderProjectDetail();
  renderProjects();
});
const projectDetailEdit = $("#projectDetailEdit");
if(projectDetailEdit) projectDetailEdit.addEventListener("click", ()=>{
  const project = store.projects.find(p=>p.id===selectedProjectId);
  if(project) openProjectDialog(project);
});
const projectDetailDelete = $("#projectDetailDelete");
if(projectDetailDelete) projectDetailDelete.addEventListener("click", ()=>{
  if(selectedProjectId) deleteProject(selectedProjectId);
});

syncProjectTypeControls();

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
    if(!data || !Array.isArray(data.cultivars) || !Array.isArray(data.care) || (data.projects && !Array.isArray(data.projects))){
      alert("Invalid backup file.");
      return;
    }
    store = normalizeStore(data);
    selectedCultivarId = null;
    selectedProjectId = null;
    saveStore();
    alert("Imported successfully.");
  }catch(err){
    alert("Failed to import: " + err.message);
  }finally{
    e.target.value = "";
  }
});
$("#btnErase").addEventListener("click", ()=>{
  if(confirm("Erase all plants, care history, and hybrid projects? This cannot be undone.")){
    store = { cultivars: [], care: [], projects: [] };
    selectedCultivarId = null;
    selectedProjectId = null;
    saveStore();
  }
});
$("#btnLoadSample").addEventListener("click", ()=>{
  fetch("sample_data.json").then(r=>r.json()).then(data=>{
    store = normalizeStore(data);
    selectedCultivarId = null;
    selectedProjectId = null;
    saveStore();
  }).catch(()=> alert("Could not load sample data."));
});

/* Initial Render */
function renderAll(){
  renderCultivars();
  renderPlantProfile();
  renderProjects();
  renderProjectDetail();
  renderProjectParentSuggestions();
  renderCareFilters();
  renderCareTable();
  renderTasks();
  renderCalendar();
}
renderAll();
function plantPhoto(plant){
  if(plant?.photo){
    return { src: plant.photo, placeholder: false };
  }
  return { src: PLACEHOLDER_PHOTO, placeholder: true };
}
