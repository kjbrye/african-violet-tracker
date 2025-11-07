
/* African Violets — Plants & Care (vanilla JS, localStorage) */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const STORE_KEY = "african_violets_store_v1";
const PLACEHOLDER_PHOTO = "logo.svg";
const VIEW_MODE_KEY = "cultivar_view_mode_v1";
const WEEKDAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const CALENDAR_ENTRY_ORDER = {
  "care-water": 0,
  "care-fertilize": 1,
  project: 2,
  manual: 3
};
const CALENDAR_ICONS = {
  water: "💧",
  fertilize: "🌱",
  project: "🧬"
};

function blankStore(){
  return {
    cultivars: [],
    care: [],
    projects: [],
    tasks: [],
    updatedAt: new Date().toISOString()
  };
}

let store = loadStore();
let selectedCultivarId = null;
let selectedProjectId = null;
let cultivarViewMode = localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "tiles";
let calendarViewDate = startOfMonth(new Date());
let plantEditorState = { active: false, draft: null, isNew: false };
let plantProfileTab = "overview";
let cloudPushTimer = null;
let carePage = 1;
let carePageSize = 10;
function loadStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return blankStore();
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  }catch(e){
    console.error("Failed to parse store", e);
    return blankStore();
  }
}
function normalizeStore(data){
  const cultivars = Array.isArray(data?.cultivars) ? data.cultivars.map(normalizePlant) : [];
  const care = Array.isArray(data?.care) ? data.care.map(entry=>({ ...entry })) : [];
  const projects = Array.isArray(data?.projects) ? data.projects.map(normalizeProject) : [];
  const tasks = Array.isArray(data?.tasks) ? data.tasks.map(normalizeTask).filter(Boolean) : [];
  const updatedRaw = data?.updatedAt || data?.updated_at || null;
  const updatedAt = updatedRaw ? String(updatedRaw) : new Date().toISOString();
  return { cultivars, care, projects, tasks, updatedAt };
}
function normalizePlant(plant){
  const cultivarName = String(plant?.cultivarName ?? plant?.name ?? "").trim();
  const nickname = String(plant?.nickname ?? "").trim();
  const fertilizerNpk = String(plant?.fertilizerNpk ?? "").trim();
  const fertilizerMethod = String(plant?.fertilizerMethod ?? "").trim();
  const favoriteRaw = plant?.favorite;
  const favorite = favoriteRaw === true || favoriteRaw === "true" || favoriteRaw === 1 || favoriteRaw === "1";
  const normalized = { ...plant, cultivarName, nickname, fertilizerNpk, fertilizerMethod, favorite };
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

function normalizeTask(task){
  if(!task) return null;
  const title = String(task.title ?? task.name ?? "").trim();
  const date = task.date ? String(task.date) : "";
  const icon = String(task.icon ?? "").trim() || "📌";
  const notes = String(task.notes ?? "").trim();
  const createdAt = task.createdAt ? String(task.createdAt) : new Date().toISOString();
  if(!title || !date) return null;
  return {
    id: task.id || uid(),
    title,
    date,
    icon,
    notes,
    createdAt
  };
}
function touchStore(){
  store.updatedAt = new Date().toISOString();
}

function persistLocalStore(){
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function saveStore(options={}){
  const { skipTouch = false, skipCloud = false } = options;
  if(!skipTouch){
    touchStore();
  }
  persistLocalStore();
  renderAll();
  if(!skipCloud){
    queueCloudPush();
  }
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
  const favA = Boolean(a?.favorite);
  const favB = Boolean(b?.favorite);
  if(favA !== favB) return favA ? -1 : 1;
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

function startOfMonth(date){
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date){
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatMonthLabel(date){
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function formatFullDate(dateStr){
  const d = toDate(dateStr);
  if(Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function parsePotSize(value){
  if(value == null) return null;
  if(typeof value === "number" && Number.isFinite(value)) return value;
  const numeric = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatPotLabel(pot){
  if(!pot) return "";
  const rounded = Math.round(pot * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).replace(/\.0$/, "");
}

function analyzeWateringProfile(plant){
  const pot = parsePotSize(plant?.pot);
  const combined = `${plant?.fertilizerMethod || ""} ${plant?.notes || ""}`.toLowerCase();
  const wicking = /(wick|reservoir|self[-\s]?watering|semi[-\s]?hydro|leca|wicked)/.test(combined);
  const chunky = /(chunk|perlite|pumice|lava|bark|gritty|fast[-\s]?drain|coarse)/.test(combined);
  const peaty = /(peat|sphagnum|vermiculite|coco|soil mix|potting mix)/.test(combined);
  let bias = 0;
  if(wicking) bias += 2;
  if(chunky) bias -= 1;
  else if(peaty) bias += 1;
  const descriptors = [];
  if(pot){
    descriptors.push(`${formatPotLabel(pot)}" pot`);
  }
  if(chunky){
    descriptors.push("chunky mix");
  }else if(peaty){
    descriptors.push("peat-heavy mix");
  }
  if(wicking){
    descriptors.push("wicking setup");
  }
  return { pot, bias, descriptors };
}

function suggestWaterInterval(plant, contextOverride){
  const context = contextOverride || analyzeWateringProfile(plant);
  let base = 7;
  const pot = context.pot;
  if(pot){
    if(pot <= 2) base = 3;
    else if(pot <= 2.5) base = 4;
    else if(pot <= 3) base = 5;
    else if(pot <= 4.5) base = 7;
    else if(pot <= 5.5) base = 8;
    else base = 9;
  }
  base += context.bias * 2;
  return Math.min(Math.max(Math.round(base), 2), 28);
}

function waterIntervalFeedback(plant, rawValue, contextOverride){
  const context = contextOverride || analyzeWateringProfile(plant);
  const recommended = suggestWaterInterval(plant, context);
  const descriptors = context.descriptors || [];
  const descriptorText = descriptors.length ? ` (based on ${descriptors.join(", ")})` : "";
  const suggestion = `Suggested: ${recommended} days${descriptorText}.`;
  const strValue = typeof rawValue === "string" ? rawValue.trim() : rawValue == null ? "" : String(rawValue).trim();
  if(strValue === ""){
    return { message: suggestion, type: "hint", recommended };
  }
  const value = Number(rawValue);
  if(!Number.isFinite(value)){
    return { message: suggestion, type: "hint", recommended };
  }
  if(value <= 0){
    return { message: `Watering interval must be at least 1 day. ${suggestion}`, type: "warning", recommended };
  }
  if(value > 30){
    return { message: `Intervals over 30 days are rare for African violets; double-check your cadence. ${suggestion}`, type: "warning", recommended };
  }
  if(Math.abs(value - recommended) >= 4){
    const direction = value > recommended ? "less often" : "more often";
    return { message: `${suggestion} You're watering ${direction} than typical for this setup.`, type: "hint", recommended };
  }
  return { message: suggestion, type: "hint", recommended };
}

function attachWaterIntervalGuidance(form){
  const waterInput = form?.querySelector?.("#editWaterInterval");
  const hintEl = form?.querySelector?.("#waterIntervalHint");
  if(!waterInput || !hintEl) return;
  hintEl.setAttribute("aria-live", "polite");
  const potInput = form.querySelector("#editPot");
  const notesInput = form.querySelector("#editNotes");
  const fertMethodInput = form.querySelector("#editFertilizerMethod");

  const buildPlant = () => ({
    ...plantEditorState.draft,
    pot: potInput ? potInput.value : plantEditorState.draft?.pot,
    notes: notesInput ? notesInput.value : plantEditorState.draft?.notes,
    fertilizerMethod: fertMethodInput ? fertMethodInput.value : plantEditorState.draft?.fertilizerMethod
  });

  const render = () => {
    const feedback = waterIntervalFeedback(buildPlant(), waterInput.value);
    hintEl.textContent = feedback.message;
    hintEl.classList.toggle("warning", feedback.type === "warning");
    hintEl.classList.toggle("muted", feedback.type !== "warning");
    if(feedback.type === "warning"){
      waterInput.setAttribute("aria-invalid", "true");
    }else{
      waterInput.removeAttribute("aria-invalid");
    }
  };

  [waterInput, potInput, notesInput, fertMethodInput].forEach(el => {
    if(el){
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    }
  });

  render();
}

function generateRecurringDates(baseDateStr, intervalDays, rangeStartStr, rangeEndStr){
  const results = new Set();
  if(!intervalDays || intervalDays <= 0) return [];
  const start = toDate(rangeStartStr);
  const end = toDate(rangeEndStr);
  const step = intervalDays * 86400000;
  let base = toDate(baseDateStr || rangeStartStr);
  if(Number.isNaN(base.getTime())) return [];

  while(base > end){
    base = new Date(base.getTime() - step);
  }

  let forward = new Date(base.getTime() + step);
  while(forward <= end){
    if(forward >= start){
      results.add(forward.toISOString().slice(0,10));
    }
    forward = new Date(forward.getTime() + step);
  }

  let backward = new Date(base.getTime() - step);
  while(backward >= start){
    results.add(backward.toISOString().slice(0,10));
    backward = new Date(backward.getTime() - step);
  }

  return Array.from(results).sort();
}

/* Plants */
$("#btnAddCultivar").addEventListener("click", () => {
  plantProfileTab = "overview";
  startPlantEdit();
});

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

function defaultPlant(){
  return {
    id: "",
    cultivarName: "",
    nickname: "",
    hybridizer: "",
    year: "",
    blossom: "",
    color: "",
    leaf: "",
    variegation: "",
    pot: "",
    location: "",
    acquired: "",
    source: "",
    waterInterval: 7,
    fertInterval: 30,
    fertilizerNpk: "",
    fertilizerMethod: "",
    notes: "",
    photo: "",
    favorite: false
  };
}

function ensurePlantProfileVisible(){
  const profile = $("#plantProfile");
  if(profile){
    profile.classList.remove("hidden");
    if(!profile.hasAttribute("tabindex")) profile.setAttribute("tabindex", "-1");
    if(typeof profile.focus === "function"){ profile.focus(); }
    if(typeof profile.scrollIntoView === "function"){ profile.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
}

function startPlantEdit(id=null){
  const navBtn = $(".nav-btn[data-tab='tab-cultivars']");
  if(navBtn && !navBtn.classList.contains("active")) navBtn.click();
  plantProfileTab = "overview";
  const existing = id ? store.cultivars.find(c=>c.id===id) : null;
  const draft = existing ? { ...existing } : defaultPlant();
  plantEditorState = { active: true, draft, isNew: !existing };
  if(existing){
    selectedCultivarId = existing.id;
  }else{
    selectedCultivarId = null;
  }
  ensurePlantProfileVisible();
  renderPlantProfile();
}

function cancelPlantEdit(){
  const wasNew = plantEditorState.isNew && !selectedCultivarId;
  plantEditorState = { active: false, draft: null, isNew: false };
  plantProfileTab = "overview";
  if(wasNew){
    renderPlantProfile();
    return;
  }
  renderPlantProfile();
}

function setPlantProfileTab(tab){
  const allowed = ["overview","timeline","photos","projects","notes"];
  const safe = allowed.includes(tab) ? tab : "overview";
  if(plantProfileTab === safe) return;
  plantProfileTab = safe;
  renderPlantProfile();
}

function savePlantEdit(){
  const form = $("#plantOverviewForm");
  if(!form || !plantEditorState.draft) return;
  const draft = { ...plantEditorState.draft };
  const value = (id)=>{
    const el = form.querySelector(`#${id}`);
    return el && "value" in el ? el.value : "";
  };
  const checked = (id)=>{
    const el = form.querySelector(`#${id}`);
    return el && "checked" in el ? el.checked : false;
  };
  const trimValue = (id)=> value(id).trim();

  draft.cultivarName = trimValue("editCultivarName");
  draft.nickname = trimValue("editNickname");
  draft.hybridizer = trimValue("editHybridizer");
  draft.year = trimValue("editYear");
  draft.blossom = value("editBlossom");
  draft.color = trimValue("editColor");
  draft.leaf = value("editLeaf");
  draft.variegation = trimValue("editVariegation");
  draft.pot = trimValue("editPot");
  draft.location = trimValue("editLocation");
  draft.acquired = trimValue("editAcquired");
  draft.source = trimValue("editSource");
  draft.fertilizerNpk = trimValue("editFertilizerNpk");
  draft.fertilizerMethod = trimValue("editFertilizerMethod");
  draft.notes = trimValue("editNotes");
  const waterRaw = value("editWaterInterval");
  const waterNumeric = waterRaw ? Number(waterRaw) : NaN;
  const suggestedWater = suggestWaterInterval(draft);
  if(Number.isFinite(waterNumeric) && waterNumeric > 0){
    draft.waterInterval = Math.max(1, Math.round(waterNumeric));
  }else{
    draft.waterInterval = suggestedWater;
  }
  const fertRaw = value("editFertInterval");
  draft.fertInterval = fertRaw ? Number(fertRaw) : 30;
  if(Number.isNaN(draft.fertInterval) || draft.fertInterval <= 0){
    draft.fertInterval = 30;
  }

  const removePhoto = checked("editRemovePhoto");
  const photoUrl = trimValue("editPhotoUrl");
  let photoData = draft.photo || "";
  if(removePhoto){
    photoData = "";
  }else if(photoUrl){
    photoData = photoUrl;
  }

  function finalize(photo){
    const id = draft.id || uid();
    const data = { ...draft, id, photo };
    delete data.name;
    if(!data.cultivarName){
      alert("Cultivar/Variety Name is required.");
      return;
    }
    if(plantEditorState.isNew){
      data.favorite = false;
      store.cultivars.push(data);
    }else{
      const existing = store.cultivars.find(c=>c.id===data.id);
      if(existing){
        Object.assign(existing, data);
        delete existing.name;
      }else{
        store.cultivars.push(data);
      }
    }
    selectedCultivarId = data.id;
    plantEditorState = { active: false, draft: null, isNew: false };
    saveStore();
  }

  const fileInput = form.querySelector("#plantPhotoInput");
  const file = fileInput?.files?.[0];
  if(file){
    if(file.size > 2_000_000){
      alert("Image is large; it will be stored locally and may impact storage. Try under 2 MB.");
    }
    const reader = new FileReader();
    reader.onload = ()=> finalize(reader.result);
    reader.readAsDataURL(file);
  }else{
    finalize(photoData);
  }
}

function quickUpdatePlantNotes(value){
  if(!selectedCultivarId) return;
  const plant = store.cultivars.find(c=>c.id===selectedCultivarId);
  if(!plant) return;
  plant.notes = value.trim();
  saveStore();
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
    if(c.favorite) div.classList.add("card-plant--favorite");
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
    if(c.favorite){
      const sr = document.createElement("span");
      sr.className = "sr-only";
      sr.textContent = "Favorited plant. ";
      const icon = document.createElement("span");
      icon.className = "card-plant-favorite-icon";
      icon.setAttribute("aria-hidden","true");
      icon.textContent = "★";
      h3.prepend(icon);
      h3.prepend(sr);
    }
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
    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = "btn-favorite";
    favoriteBtn.innerHTML = c.favorite ? "★ Favorited" : "☆ Favorite";
    favoriteBtn.setAttribute("aria-pressed", c.favorite ? "true" : "false");
    favoriteBtn.setAttribute("aria-label", c.favorite ? `Unfavorite ${plantLabel(c)}` : `Favorite ${plantLabel(c)}`);
    favoriteBtn.addEventListener("click", (event)=>{
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(c.id);
    });
    const edit = document.createElement("button"); edit.textContent = "Edit"; edit.addEventListener("click", ()=>startPlantEdit(c.id));
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
    actions.append(favoriteBtn, edit, care, del);
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

function toggleFavorite(id){
  const plant = store.cultivars.find(c=>c.id===id);
  if(!plant) return;
  plant.favorite = !plant.favorite;
  saveStore();
}

function closePlantProfile(){
  selectedCultivarId = null;
  plantEditorState = { active: false, draft: null, isNew: false };
  plantProfileTab = "overview";
  renderPlantProfile();
  renderCultivars();
}

function openPlantProfile(id){
  plantEditorState = { active: false, draft: null, isNew: false };
  plantProfileTab = "overview";
  selectedCultivarId = id;
  const navBtn = $(".nav-btn[data-tab='tab-cultivars']");
  if(navBtn && !navBtn.classList.contains("active")) navBtn.click();
  renderPlantProfile();
  renderCultivars();
  ensurePlantProfileVisible();
}



function renderPlantProfile(){
  const profile = $("#plantProfile");
  const content = $("#plantProfileContent");
  const editBtn = $("#profileEdit");
  const logBtn = $("#profileLogCare");
  const favoriteBtn = $("#profileFavorite");
  if(!profile || !content) return;

  const editing = plantEditorState.active;
  const plant = editing ? plantEditorState.draft : store.cultivars.find(c=>c.id===selectedCultivarId);

  if(!plant){
    if(selectedCultivarId){
      selectedCultivarId = null;
      renderCultivars();
    }
    profile.classList.add("hidden");
    profile.classList.remove("is-favorite");
    content.innerHTML = "<p class=\"muted\">Select a plant to view its profile.</p>";
    if(editBtn){
      editBtn.disabled = true;
      editBtn.textContent = "Edit";
    }
    if(logBtn) logBtn.disabled = true;
    if(favoriteBtn){
      favoriteBtn.disabled = true;
      favoriteBtn.textContent = "☆ Favorite";
      favoriteBtn.setAttribute("aria-pressed", "false");
      favoriteBtn.setAttribute("aria-label", "Favorite plant");
    }
    return;
  }

  profile.classList.remove("hidden");

  const isSavedPlant = Boolean(plant.id);
  const isFavorite = Boolean(plant.favorite && isSavedPlant && !plantEditorState.isNew);
  profile.classList.toggle("is-favorite", isFavorite);

  if(editBtn){
    editBtn.disabled = !isSavedPlant && !plantEditorState.isNew && !editing;
    editBtn.textContent = editing ? "Cancel Editing" : "Edit";
  }
  if(logBtn){
    logBtn.disabled = editing || !isSavedPlant;
  }
  if(favoriteBtn){
    const disableFavorite = editing || !isSavedPlant;
    favoriteBtn.disabled = disableFavorite;
    favoriteBtn.classList.add("btn-favorite");
    favoriteBtn.textContent = isFavorite ? "★ Favorited" : "☆ Favorite";
    favoriteBtn.setAttribute("aria-pressed", isFavorite ? "true" : "false");
    const labelName = plantLabel(plant) || "plant";
    favoriteBtn.setAttribute("aria-label", isFavorite ? `Unfavorite ${labelName}` : `Favorite ${labelName}`);
  }

  const disableTabs = editing && plantEditorState.isNew;
  if(disableTabs && plantProfileTab !== "overview"){
    plantProfileTab = "overview";
  }

  const badges = [];
  if(plant.blossom) badges.push(`<span class="profile-badge">${escapeHtml(plant.blossom)}</span>`);
  if(plant.color) badges.push(`<span class="profile-badge">${escapeHtml(plant.color)}</span>`);
  if(plant.leaf) badges.push(`<span class="profile-badge">${escapeHtml(plant.leaf)}</span>`);
  if(plant.location) badges.push(`<span class="profile-badge">📍 ${escapeHtml(plant.location)}</span>`);

  const info = [
    { label: "Cultivar", value: plant.cultivarName ? escapeHtml(plant.cultivarName) : "—" },
    { label: "Nickname", value: plant.nickname ? escapeHtml(plant.nickname) : "—" },
    { label: "Hybridizer", value: plant.hybridizer ? escapeHtml(plant.hybridizer) : "—" },
    { label: "Year", value: plant.year ? escapeHtml(plant.year) : "—" },
    { label: "Variegation", value: plant.variegation ? escapeHtml(plant.variegation) : "—" },
    { label: "Pot Size", value: plant.pot ? escapeHtml(`${plant.pot}"`) : "—" },
    { label: "Location", value: plant.location ? escapeHtml(plant.location) : "—" },
    { label: "Acquired", value: plant.acquired ? escapeHtml(formatDate(plant.acquired)) : "—" },
    { label: "Source", value: plant.source ? escapeHtml(plant.source) : "—" },
    { label: "Watering Interval", value: plant.waterInterval ? escapeHtml(`${plant.waterInterval} days`) : "—" },
    { label: "Fertilizer Interval", value: plant.fertInterval ? escapeHtml(`${plant.fertInterval} days`) : "—" },
    { label: "Fertilizer NPK", value: plant.fertilizerNpk ? escapeHtml(plant.fertilizerNpk) : "—" },
    { label: "Fertilizer Method", value: plant.fertilizerMethod ? escapeHtml(plant.fertilizerMethod) : "—" }
  ];

  const nextWater = plant.waterInterval ? nextDue(plant._lastWater || plant.acquired || todayStr(), plant.waterInterval) : null;
  const nextFert = plant.fertInterval ? nextDue(plant._lastFert || plant.acquired || todayStr(), plant.fertInterval) : null;

  const highlightParts = [];
  if(nextWater) highlightParts.push(`Next watering: ${escapeHtml(nextWater)}`);
  if(nextFert) highlightParts.push(`Next fertilizer: ${escapeHtml(nextFert)}`);

  const infoHtml = info.map(item => `
      <div>
        <dt>${item.label}</dt>
        <dd>${item.value || "—"}</dd>
      </div>
    `).join("");

  const careHistory = isSavedPlant
    ? store.care.filter(r => r.cultivarId === plant.id).slice().sort((a,b)=>b.date.localeCompare(a.date))
    : [];

  const { src: photoSrc, placeholder } = plantPhoto(plant);
  const photoClasses = ["profile-photo", placeholder ? "placeholder" : ""].filter(Boolean).join(" ");
  const title = plant.nickname || plant.cultivarName || "Unnamed plant";
  const cultivarLine = plant.cultivarName && plant.cultivarName !== title ? `<div class="profile-subtitle">${escapeHtml(plant.cultivarName)}</div>` : "";
  const altLabel = plantLabel(plant) || title;
  const favoriteHeading = isFavorite ? '<span class="sr-only">Favorited plant. </span><span class="card-plant-favorite-icon" aria-hidden="true">★</span>' : "";
  const photoUrlValue = plant.photo && !String(plant.photo).startsWith("data:") ? plant.photo : "";

  function buildOverviewView(){
    return `
      <div class="profile-header">
        <img src="${photoSrc}" alt="${escapeHtml(altLabel)}" class="${photoClasses}">
        <div class="profile-summary">
          <h3>${favoriteHeading}${escapeHtml(title)}</h3>
          ${cultivarLine}
          ${plant.notes ? `<p>${escapeHtml(plant.notes)}</p>` : `<p class="muted">No notes added.</p>`}
          ${highlightParts.length ? `<div class="muted profile-highlights">${highlightParts.join(" · ")}</div>` : ""}
          ${badges.length ? `<div class="profile-badges">${badges.join("")}</div>` : ""}
        </div>
      </div>
      <div class="profile-details">
        <dl class="profile-grid">
          ${infoHtml}
        </dl>
      </div>
    `;
  }

  function buildOverviewEdit(){
    const waterContext = analyzeWateringProfile(plant);
    const recommendedWater = suggestWaterInterval(plant, waterContext);
    const storedWater = Number(plant.waterInterval);
    const currentWater = Number.isFinite(storedWater) && storedWater > 0 ? storedWater : recommendedWater;
    const waterFeedback = waterIntervalFeedback(plant, currentWater, waterContext);
    const waterHintClass = waterFeedback.type === "warning" ? "form-hint warning" : "form-hint muted";
    const waterAriaInvalid = waterFeedback.type === "warning" ? " aria-invalid=\\\"true\\\"" : "";
    const waterHintText = escapeHtml(waterFeedback.message);
    const waterValueAttr = escapeHtml(String(currentWater));
    return `
      <form id="plantOverviewForm" class="profile-overview-form">
        <div class="profile-overview-edit-header">
          <img src="${photoSrc}" alt="${escapeHtml(altLabel)}" class="${photoClasses}">
          <div class="profile-edit-summary">
            <h3>${escapeHtml(title || "New plant")}</h3>
            ${cultivarLine}
            <p class="muted small">Adjust identity, location, and care cadence without leaving the page.</p>
          </div>
        </div>
        <div class="profile-overview-edit-grid">
          <section>
            <h4>Identity</h4>
            <div class="form-field">
              <label for="editCultivarName">Cultivar/Variety Name*</label>
              <input id="editCultivarName" required value="${escapeHtml(plant.cultivarName || "")}">
            </div>
            <div class="form-field">
              <label for="editNickname">Nickname</label>
              <input id="editNickname" value="${escapeHtml(plant.nickname || "")}" placeholder="Optional display name">
            </div>
            <div class="form-field">
              <label for="editHybridizer">Hybridizer</label>
              <input id="editHybridizer" value="${escapeHtml(plant.hybridizer || "")}">
            </div>
            <div class="form-field">
              <label for="editYear">Year</label>
              <input id="editYear" value="${escapeHtml(plant.year || "")}" inputmode="numeric">
            </div>
            <div class="form-field">
              <label for="editBlossom">Blossom Type</label>
              <select id="editBlossom">
                ${["","Single","Semi-double","Double","Star","Frilled","Fantasy","Chimera"].map(opt=>`<option value="${opt}"${plant.blossom===opt ? " selected" : ""}>${opt || "—"}</option>`).join("")}
              </select>
            </div>
            <div class="form-field">
              <label for="editColor">Blossom Color</label>
              <input id="editColor" value="${escapeHtml(plant.color || "")}" placeholder="Lavender fantasy, variegated…">
            </div>
            <div class="form-field">
              <label for="editLeaf">Leaf Type</label>
              <select id="editLeaf">
                ${["","Standard","Miniature","Semi-mini","Trailing","Variegated","Boy/Girl","Serrated"].map(opt=>`<option value="${opt}"${plant.leaf===opt ? " selected" : ""}>${opt || "—"}</option>`).join("")}
              </select>
            </div>
            <div class="form-field">
              <label for="editVariegation">Variegation</label>
              <input id="editVariegation" value="${escapeHtml(plant.variegation || "")}" placeholder="Tommie Lou, white edge…">
            </div>
          </section>
          <section>
            <h4>Location &amp; Care</h4>
            <div class="form-field">
              <label for="editLocation">Location</label>
              <input id="editLocation" value="${escapeHtml(plant.location || "")}" placeholder="Shelf, window, stand…">
            </div>
            <div class="form-field">
              <label for="editPot">Pot Size (in)</label>
              <input id="editPot" type="number" min="1" max="12" step="0.25" value="${escapeHtml(plant.pot || "")}">
            </div>
            <div class="form-field">
              <label for="editAcquired">Acquired</label>
              <input id="editAcquired" type="date" value="${escapeHtml(plant.acquired || "")}">
            </div>
            <div class="form-field">
              <label for="editSource">Source</label>
              <input id="editSource" value="${escapeHtml(plant.source || "")}" placeholder="Vendor, leaf, trade…">
            </div>
            <div class="form-field">
              <label for="editWaterInterval">Watering Interval (days)</label>
              <input id="editWaterInterval" type="number" min="1" value="${waterValueAttr}" aria-describedby="waterIntervalHint"${waterAriaInvalid}>
              <p class="${waterHintClass}" id="waterIntervalHint">${waterHintText}</p>
            </div>
            <div class="form-field">
              <label for="editFertInterval">Fertilizer Interval (days)</label>
              <input id="editFertInterval" type="number" min="1" value="${escapeHtml(String(plant.fertInterval ?? 30))}">
            </div>
            <div class="form-field">
              <label for="editFertilizerNpk">Fertilizer NPK</label>
              <input id="editFertilizerNpk" value="${escapeHtml(plant.fertilizerNpk || "")}" placeholder="14-12-14">
            </div>
            <div class="form-field">
              <label for="editFertilizerMethod">Fertilizer Method</label>
              <input id="editFertilizerMethod" value="${escapeHtml(plant.fertilizerMethod || "")}" placeholder="In water, soil drench…">
            </div>
          </section>
          <section>
            <h4>Photo</h4>
            <div class="form-field">
              <label for="editPhotoUrl">Photo URL</label>
              <input id="editPhotoUrl" type="url" value="${escapeHtml(photoUrlValue)}" placeholder="https://example.com/african-violet.jpg">
            </div>
            <div class="form-field">
              <label for="plantPhotoInput">Upload Image</label>
              <input id="plantPhotoInput" type="file" accept="image/*">
            </div>
            ${plant.photo ? `<div class="form-field checkbox-field"><label><input type="checkbox" id="editRemovePhoto"> Remove current photo</label></div>` : ""}
            <p class="muted small">Uploaded images stay on this device via local storage.</p>
          </section>
          <section class="full-width">
            <h4>Notes</h4>
            <div class="form-field">
              <label for="editNotes" class="sr-only">Notes</label>
              <textarea id="editNotes" rows="4" placeholder="Care observations, bloom tracking…">${escapeHtml(plant.notes || "")}</textarea>
            </div>
          </section>
        </div>
        <div class="profile-edit-actions">
          <button type="button" class="secondary" id="plantOverviewCancel">Cancel</button>
          <button type="submit" id="plantOverviewSave">Save Plant</button>
        </div>
      </form>
    `;
  }

  function buildTimeline(){
    if(!isSavedPlant){
      return `<p class="muted">Save this plant to build a care timeline.</p>`;
    }
    if(!careHistory.length){
      return `<p class="profile-empty">No care entries logged yet.</p>`;
    }
    return `
      <ol class="timeline-list">
        ${careHistory.map(entry=>`
          <li>
            <div class="timeline-marker" aria-hidden="true"></div>
            <div class="timeline-content">
              <div class="timeline-date">${escapeHtml(formatDate(entry.date))}</div>
              <div class="timeline-action">${escapeHtml(entry.action)}</div>
              ${entry.notes ? `<div class="timeline-notes muted">${escapeHtml(entry.notes)}</div>` : ""}
            </div>
          </li>
        `).join("")}
      </ol>
    `;
  }

  const relatedProjects = isSavedPlant ? store.projects.filter(project => {
    const parents = Array.isArray(project.parents) ? project.parents : [];
    const cultivarLower = (plant.cultivarName || "").toLowerCase();
    const nicknameLower = (plant.nickname || "").toLowerCase();
    const textBlob = `${project.name || ""} ${project.goal || ""} ${project.notes || ""}`.toLowerCase();
    if(cultivarLower && textBlob.includes(cultivarLower)) return true;
    if(nicknameLower && textBlob.includes(nicknameLower)) return true;
    return parents.some(parent => {
      if(parent.cultivarId && plant.id && parent.cultivarId === plant.id) return true;
      if(cultivarLower && parent.name && parent.name.toLowerCase() === cultivarLower) return true;
      return false;
    });
  }) : [];

  function buildProjects(){
    if(!isSavedPlant){
      return `<p class="muted">Save this plant to connect hybridization projects.</p>`;
    }
    if(!relatedProjects.length){
      return `<p class="profile-empty">No projects linked yet.</p>`;
    }
    return `
      <ul class="profile-projects">
        ${relatedProjects.map(project=>`
          <li class="profile-project-card">
            <div class="profile-project-card-head">
              <span class="profile-project-status status-${project.status}">${escapeHtml(projectStatusLabel(project.status))}</span>
              <h5>${escapeHtml(project.name)}</h5>
            </div>
            ${project.goal ? `<p class="muted small">${escapeHtml(project.goal)}</p>` : ""}
          </li>
        `).join("")}
      </ul>
    `;
  }

  function buildPhotos(){
    if(!isSavedPlant){
      return `<p class="muted">Save this plant to add photos.</p>`;
    }
    return `
      <div class="profile-photos">
        <figure class="profile-photo-frame ${placeholder ? "placeholder" : ""}">
          <img src="${photoSrc}" alt="${escapeHtml(altLabel)}">
          <figcaption class="muted small">${placeholder ? "No photo yet – add one from the Overview tab." : "Primary portrait"}</figcaption>
        </figure>
        <p class="muted small">Capture rosette progress, bloom stages, and leaf texture. Additional gallery slots are on the roadmap.</p>
      </div>
    `;
  }

  function buildNotes(){
    if(!isSavedPlant){
      return `<p class="muted">Save this plant to keep running notes.</p>`;
    }
    if(editing){
      return `<p class="muted">Notes can be updated from the Overview tab while editing.</p>`;
    }
    return `
      <div class="profile-notes-editor">
        <label for="notesQuickEdit">Notes</label>
        <textarea id="notesQuickEdit" rows="8" placeholder="Care observations, bloom tracking…">${escapeHtml(plant.notes || "")}</textarea>
        <p class="muted small">Updates save automatically.</p>
      </div>
    `;
  }

  const tabConfig = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Care Timeline" },
    { id: "photos", label: "Photos" },
    { id: "projects", label: "Projects" },
    { id: "notes", label: "Notes" }
  ];

  const panelContent = {
    overview: editing ? buildOverviewEdit() : buildOverviewView(),
    timeline: disableTabs ? `<p class="muted">Save this plant to build a care timeline.</p>` : buildTimeline(),
    photos: disableTabs ? `<p class="muted">Save this plant to add photos.</p>` : buildPhotos(),
    projects: disableTabs ? `<p class="muted">Save this plant to connect hybridization projects.</p>` : buildProjects(),
    notes: disableTabs ? `<p class="muted">Notes will be available after saving.</p>` : buildNotes()
  };

  const tabsHtml = tabConfig.map(tab => {
    const isActive = plantProfileTab === tab.id;
    const disabledAttr = disableTabs && tab.id !== "overview" ? " disabled aria-disabled=\"true\"" : "";
    return `<button type="button" id="profile-tab-${tab.id}" class="profile-tab${isActive ? " active" : ""}" data-tab="${tab.id}" role="tab" aria-selected="${isActive}" aria-controls="profile-panel-${tab.id}"${disabledAttr}>${tab.label}</button>`;
  }).join("");

  const panelsHtml = tabConfig.map(tab => {
    const isActive = plantProfileTab === tab.id;
    const hiddenAttr = isActive ? "" : " hidden";
    return `<section id="profile-panel-${tab.id}" class="profile-panel${isActive ? " active" : ""}" role="tabpanel" aria-labelledby="profile-tab-${tab.id}"${hiddenAttr}>${panelContent[tab.id]}</section>`;
  }).join("");

  content.innerHTML = `
    <div class="profile-tabs" role="tablist">
      ${tabsHtml}
    </div>
    <div class="profile-panels">
      ${panelsHtml}
    </div>
  `;

  $$(".profile-tab", content).forEach(btn => {
    btn.addEventListener("click", () => {
      if(btn.disabled) return;
      setPlantProfileTab(btn.dataset.tab);
    });
  });

  if(editing){
    const form = $("#plantOverviewForm");
    if(form){
      form.addEventListener("submit", e => {
        e.preventDefault();
        savePlantEdit();
      });
      attachWaterIntervalGuidance(form);
    }
    const cancelBtn = $("#plantOverviewCancel");
    if(cancelBtn){
      cancelBtn.addEventListener("click", e => {
        e.preventDefault();
        cancelPlantEdit();
      });
    }
    const saveBtn = $("#plantOverviewSave");
    if(saveBtn){
      saveBtn.addEventListener("click", e => {
        e.preventDefault();
        savePlantEdit();
      });
    }
  }else{
    const notesTextarea = $("#notesQuickEdit");
    if(notesTextarea){
      const commit = () => quickUpdatePlantNotes(notesTextarea.value);
      notesTextarea.addEventListener("change", commit);
      notesTextarea.addEventListener("blur", commit);
    }
  }
}

const profileBackBtn = $("#profileBack");
if(profileBackBtn) profileBackBtn.addEventListener("click", closePlantProfile);
const profileEditBtn = $("#profileEdit");
if(profileEditBtn) profileEditBtn.addEventListener("click", ()=>{
  if(plantEditorState.active){
    cancelPlantEdit();
  }else if(selectedCultivarId){
    startPlantEdit(selectedCultivarId);
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
const profileFavoriteBtn = $("#profileFavorite");
if(profileFavoriteBtn) profileFavoriteBtn.addEventListener("click", ()=>{
  if(!selectedCultivarId) return;
  toggleFavorite(selectedCultivarId);
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

  const sizeSelect = $("#carePageSize");
  if(sizeSelect && Number(sizeSelect.value) !== carePageSize){
    sizeSelect.value = String(carePageSize);
  }

  const totalRows = rows.length;
  const totalPages = carePageSize > 0 ? Math.ceil(totalRows / carePageSize) : 0;
  if(totalPages === 0){
    carePage = 1;
  }else if(carePage > totalPages){
    carePage = totalPages;
  }
  const startIndex = totalRows === 0 ? 0 : (carePage - 1) * carePageSize;
  const endIndex = totalRows === 0 ? 0 : startIndex + carePageSize;
  const pageRows = totalRows === 0 ? [] : rows.slice(startIndex, endIndex);

  tbody.innerHTML = "";
  if(pageRows.length===0){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "muted";
    td.textContent = "No care entries match the filters.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }else{
    pageRows.forEach(r=>{
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

  const status = $("#carePageStatus");
  if(status){
    if(totalRows === 0){
      status.textContent = "No entries";
    }else{
      const pageCount = Math.max(totalPages, 1);
      const shownStart = startIndex + 1;
      const shownEnd = Math.min(startIndex + pageRows.length, totalRows);
      status.textContent = `Page ${carePage} of ${pageCount} · ${shownStart}-${shownEnd} of ${totalRows}`;
    }
  }
  const prev = $("#carePrevPage");
  const next = $("#careNextPage");
  if(prev) prev.disabled = totalRows === 0 || carePage <= 1;
  if(next) next.disabled = totalRows === 0 || (totalPages > 0 && carePage >= totalPages);
}
const careFilterIds = ["careFilterCultivar","careFilterAction","careFilterFrom","careFilterTo"];
careFilterIds.forEach(id=>{
  $("#"+id).addEventListener("change", ()=>{
    carePage = 1;
    renderCareTable();
  });
});

const carePrevPageBtn = $("#carePrevPage");
if(carePrevPageBtn){
  carePrevPageBtn.addEventListener("click", ()=>{
    carePage = Math.max(1, carePage - 1);
    renderCareTable();
  });
}
const careNextPageBtn = $("#careNextPage");
if(careNextPageBtn){
  careNextPageBtn.addEventListener("click", ()=>{
    carePage += 1;
    renderCareTable();
  });
}
const carePageSizeSelect = $("#carePageSize");
if(carePageSizeSelect){
  carePageSizeSelect.value = String(carePageSize);
  carePageSizeSelect.addEventListener("change", ()=>{
    const nextSize = Number(carePageSizeSelect.value) || 10;
    if(nextSize !== carePageSize){
      carePageSize = nextSize;
      carePage = 1;
      renderCareTable();
    }
  });
}

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
function addManualTask(data){
  const entry = normalizeTask({ ...data, id: uid(), createdAt: new Date().toISOString() });
  if(!entry) return;
  store.tasks.push(entry);
  saveStore();
}

function removeManualTask(id){
  const before = store.tasks.length;
  store.tasks = store.tasks.filter(task=>task.id !== id);
  if(store.tasks.length !== before){
    saveStore();
  }
}

function setupTaskForm(formId, fields){
  const form = $("#" + formId);
  if(!form) return;
  const { title, date, icon, notes } = fields;
  const reset = ()=>{
    form.reset();
    if(date) date.value = todayStr();
    if(notes) notes.value = "";
  };
  reset();
  form.addEventListener("submit", e=>{
    e.preventDefault();
    const payload = {
      title: title?.value.trim() || "",
      date: date?.value || "",
      icon: icon?.value || "📌",
      notes: notes?.value.trim() || ""
    };
    if(!payload.title || !payload.date){
      alert("Please provide both a title and date.");
      return;
    }
    addManualTask(payload);
    reset();
  });
}

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
      items.push({type:"Water", plant:c, due, source:"care"});
    }
    if(c.fertInterval>0){
      const last = c._lastFert || c.acquired || today;
      const due = nextDue(last, c.fertInterval);
      items.push({type:"Fertilize", plant:c, due, source:"care"});
    }
  });
  store.tasks.forEach(task=>{
    if(!task?.date) return;
    items.push({ type: "Manual", task, due: task.date, source: "manual" });
  });

  // Filter into upcoming window or overdue
  const now = toDate(today);
  const until = new Date(now.getTime() + windowDays*86400000);
  const inWindow = items.filter(x=> toDate(x.due) <= until );
  inWindow.sort((a,b)=>{
    const dateDiff = a.due.localeCompare(b.due);
    if(dateDiff!==0) return dateDiff;
    if(a.source===b.source) return 0;
    return a.source === "care" ? -1 : 1;
  });

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
    const heading = document.createElement("div");
    if(it.source === "manual"){
      heading.innerHTML = `<strong>${escapeHtml(it.task.title)}</strong> <span class="badge">${escapeHtml(it.due)}${overdue?" · overdue":""}</span>`;
      left.appendChild(heading);
      if(it.task.notes){
        const notes = document.createElement("div");
        notes.className = "muted";
        notes.textContent = it.task.notes;
        left.appendChild(notes);
      }
    }else{
      heading.innerHTML = `<strong>${escapeHtml(it.type)}</strong> — ${escapeHtml(plantLabel(it.plant))} <span class="badge">${escapeHtml(it.due)}${overdue?" · overdue":""}</span>`;
      left.appendChild(heading);
    }
    const right = document.createElement("div");
    right.className = "row-actions";
    const doneBtn = document.createElement("button");
    if(it.source === "manual"){
      doneBtn.textContent = "Mark complete";
      doneBtn.addEventListener("click", ()=>{
        removeManualTask(it.task.id);
      });
    }else{
      doneBtn.textContent = "Mark done";
      doneBtn.addEventListener("click", ()=>{
        const action = it.type==="Water" ? "Watered" : "Fertilized";
        store.care.push({ id: uid(), cultivarId: it.plant.id, date: todayStr(), action, notes: "" });
        if(it.type==="Water") it.plant._lastWater = todayStr();
        if(it.type==="Fertilize") it.plant._lastFert = todayStr();
        saveStore();
      });
    }
    right.appendChild(doneBtn);
    li.append(left, right);
    list.appendChild(li);
  });
}
$("#filterTaskWindow").addEventListener("change", renderTasks);

function collectCalendarEntries(rangeStart, rangeEnd){
  const map = {};
  const add = (date, entry)=>{
    if(date < rangeStart || date > rangeEnd) return;
    (map[date] ??= []).push(entry);
  };

  store.tasks.forEach(task=>{
    if(!task?.date) return;
    const subtitle = task.notes || "";
    const description = subtitle ? "" : "Manual task";
    add(task.date, {
      type: "manual",
      order: CALENDAR_ENTRY_ORDER.manual,
      icon: task.icon || "📌",
      title: task.title,
      subtitle,
      description,
      taskId: task.id,
      source: "manual"
    });
  });

  store.cultivars.forEach(c=>{
    if(!c) return;
    const waterInterval = Number(c.waterInterval) || 0;
    if(waterInterval > 0){
      const base = c._lastWater || c.acquired || todayStr();
      generateRecurringDates(base, waterInterval, rangeStart, rangeEnd).forEach(date=>{
        add(date, {
          type: "care-water",
          order: CALENDAR_ENTRY_ORDER["care-water"],
          icon: CALENDAR_ICONS.water,
          title: `Water ${plantLabel(c)}`,
          subtitle: `Every ${waterInterval} days`,
          description: `Recurring watering for ${plantLabel(c)}.`,
          plantId: c.id,
          source: "care"
        });
      });
    }
    const fertInterval = Number(c.fertInterval) || 0;
    if(fertInterval > 0){
      const base = c._lastFert || c.acquired || todayStr();
      generateRecurringDates(base, fertInterval, rangeStart, rangeEnd).forEach(date=>{
        add(date, {
          type: "care-fertilize",
          order: CALENDAR_ENTRY_ORDER["care-fertilize"],
          icon: CALENDAR_ICONS.fertilize,
          title: `Fertilize ${plantLabel(c)}`,
          subtitle: `Every ${fertInterval} days`,
          description: `Recurring fertilizing for ${plantLabel(c)}.`,
          plantId: c.id,
          source: "care"
        });
      });
    }
  });

  store.projects.forEach(project=>{
    if(!Array.isArray(project?.timeline)) return;
    project.timeline.forEach(event=>{
      const date = event?.date ? String(event.date) : "";
      if(!date) return;
      if(date < rangeStart || date > rangeEnd) return;
      const note = String(event.note ?? "").trim();
      add(date, {
        type: "project",
        order: CALENDAR_ENTRY_ORDER.project,
        icon: CALENDAR_ICONS.project,
        title: project.name,
        subtitle: note || "Timeline milestone",
        description: `Project milestone for ${project.name}.`,
        projectId: project.id,
        timelineId: event.id,
        source: "project"
      });
    });
  });

  Object.values(map).forEach(list=>{
    list.sort((a,b)=>{
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if(orderDiff!==0) return orderDiff;
      return a.title.localeCompare(b.title);
    });
  });

  return map;
}

/* Calendar */
function renderCalendar(){
  const monthLabel = $("#calendarMonthLabel");
  const weekdaysRow = $("#calendarWeekdays");
  const grid = $("#calendarGrid");
  if(!monthLabel || !weekdaysRow || !grid) return;

  const monthStart = startOfMonth(calendarViewDate);
  const monthEnd = endOfMonth(calendarViewDate);
  const startDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  monthLabel.textContent = formatMonthLabel(monthStart);

  weekdaysRow.innerHTML = "";
  WEEKDAYS_SHORT.forEach(day=>{
    const el = document.createElement("div");
    el.className = "cal-weekday";
    el.textContent = day;
    weekdaysRow.appendChild(el);
  });

  const rangeStart = monthStart.toISOString().slice(0,10);
  const rangeEnd = monthEnd.toISOString().slice(0,10);
  const entriesMap = collectCalendarEntries(rangeStart, rangeEnd);

  grid.innerHTML = "";
  for(let i=0;i<startDay;i++){
    const empty = document.createElement("div");
    empty.className = "cal-cell cal-empty";
    grid.appendChild(empty);
  }

  for(let day=1; day<=daysInMonth; day++){
    const currentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const dateStr = currentDate.toISOString().slice(0,10);
    const entries = entriesMap[dateStr] ? entriesMap[dateStr].slice() : [];
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-cell";
    cell.dataset.date = dateStr;

    if(dateStr === todayStr()){
      cell.classList.add("is-today");
    }

    const label = document.createElement("div");
    label.className = "cal-date";
    label.textContent = day;
    cell.appendChild(label);

    if(entries.length){
      cell.classList.add("has-items");
      const icons = document.createElement("div");
      icons.className = "cal-icons";
      entries.slice(0,4).forEach(entry=>{
        const span = document.createElement("span");
        span.className = "cal-icon";
        span.textContent = entry.icon;
        icons.appendChild(span);
      });
      cell.appendChild(icons);

      const summary = document.createElement("div");
      summary.className = "cal-summary";
      summary.innerHTML = `<strong>${escapeHtml(entries[0].title)}</strong>`;
      if(entries[0].subtitle){
        const sub = document.createElement("div");
        sub.className = "cal-subtitle";
        sub.textContent = entries[0].subtitle;
        summary.appendChild(sub);
      }
      cell.appendChild(summary);

      if(entries.length > 4){
        const more = document.createElement("div");
        more.className = "cal-more";
        more.textContent = `+${entries.length - 4} more`;
        cell.appendChild(more);
      }
    }

    cell.addEventListener("click", ()=> openDayDetail(dateStr));
    cell.addEventListener("keydown", evt=>{
      if(evt.key === "Enter" || evt.key === " "){
        evt.preventDefault();
        openDayDetail(dateStr);
      }
    });
    grid.appendChild(cell);
  }

  const totalCells = startDay + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for(let i=0;i<trailing;i++){
    const empty = document.createElement("div");
    empty.className = "cal-cell cal-empty";
    grid.appendChild(empty);
  }
}

function openDayDetail(dateStr){
  const dialog = $("#dayDetailDialog");
  const content = $("#dayDetailContent");
  const title = $("#dayDetailTitle");
  if(!dialog || !content) return;

  dialog.dataset.date = dateStr;
  if(title) title.textContent = formatFullDate(dateStr);

  content.innerHTML = "";
  const entriesMap = collectCalendarEntries(dateStr, dateStr);
  const entries = entriesMap[dateStr] ? entriesMap[dateStr].slice() : [];

  if(entries.length===0){
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No scheduled items for this day. Add a task to get started.";
    content.appendChild(empty);
  }else{
    entries.forEach(entry=>{
      const row = document.createElement("div");
      row.className = "day-entry";
      const icon = document.createElement("div");
      icon.className = "day-entry-icon";
      icon.textContent = entry.icon;
      row.appendChild(icon);

      const body = document.createElement("div");
      body.className = "day-entry-body";
      const heading = document.createElement("h4");
      heading.textContent = entry.title;
      body.appendChild(heading);
      const details = [];
      if(entry.subtitle) details.push(entry.subtitle);
      if(entry.description && entry.description !== entry.subtitle) details.push(entry.description);
      details.forEach(text=>{
        if(!text) return;
        const p = document.createElement("p");
        p.textContent = text;
        body.appendChild(p);
      });
      row.appendChild(body);

      if(entry.source === "manual"){
        const actions = document.createElement("div");
        actions.className = "day-entry-actions";
        const doneBtn = document.createElement("button");
        doneBtn.className = "secondary";
        doneBtn.textContent = "Mark complete";
        doneBtn.addEventListener("click", ()=>{
          removeManualTask(entry.taskId);
          dialog.close();
        });
        actions.appendChild(doneBtn);
        row.appendChild(actions);
      }

      content.appendChild(row);
    });
  }

  if(typeof dialog.showModal === "function"){
    dialog.showModal();
  }
}

const calendarPrevBtn = $("#calendarPrev");
if(calendarPrevBtn){
  calendarPrevBtn.addEventListener("click", ()=>{
    calendarViewDate = startOfMonth(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
    renderCalendar();
  });
}
const calendarNextBtn = $("#calendarNext");
if(calendarNextBtn){
  calendarNextBtn.addEventListener("click", ()=>{
    calendarViewDate = startOfMonth(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
    renderCalendar();
  });
}

const dayDetailDialog = $("#dayDetailDialog");
const dayDetailClose = $("#dayDetailClose");
if(dayDetailClose && dayDetailDialog){
  dayDetailClose.addEventListener("click", ()=> dayDetailDialog.close());
}
const dayDetailAddTask = $("#dayDetailAddTask");
if(dayDetailAddTask && dayDetailDialog){
  dayDetailAddTask.addEventListener("click", ()=>{
    const date = dayDetailDialog.dataset.date || todayStr();
    dayDetailDialog.close();
    const calendarDateInput = $("#calTaskDate");
    if(calendarDateInput){
      calendarDateInput.value = date;
      const calendarTitle = $("#calTaskTitle");
      if(calendarTitle) calendarTitle.focus();
    }
    const dashDateInput = $("#dashTaskDate");
    if(dashDateInput) dashDateInput.value = date;
  });
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
    store = { cultivars: [], care: [], projects: [], tasks: [] };
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

setupTaskForm("dashboardTaskForm", {
  title: $("#dashTaskTitle"),
  date: $("#dashTaskDate"),
  icon: $("#dashTaskIcon"),
  notes: $("#dashTaskNotes")
});
setupTaskForm("calendarTaskForm", {
  title: $("#calTaskTitle"),
  date: $("#calTaskDate"),
  icon: $("#calTaskIcon"),
  notes: $("#calTaskNotes")
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
// AUTH & CLOUD SYNC
const CLOUD_TABLE = "user_store";

function isMissingTableError(error){
  if(!error) return false;
  if(error.code === "42P01") return true;
  const msg = String(error.message || "");
  return /does not exist/i.test(msg);
}

async function ensureSession(){
  if(typeof supabase === "undefined") return;
  const { data: { session } } = await supabase.auth.getSession();
  supabase.auth.onAuthStateChange((_evt, s) => {
    renderAuthUI(s);
    if(s){
      cloudPull();
    }
  });
  renderAuthUI(session);
  if(session){
    cloudPull();
  }
}
function setAuthExpanded(expanded){
  const widget = $("#authWidget");
  const toggle = $("#authToggle");
  const panel = $("#authPanel");
  if(!widget || !toggle || !panel) return;
  widget.classList.toggle("collapsed", !expanded);
  widget.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  panel.setAttribute("aria-hidden", expanded ? "false" : "true");
  if(expanded){
    const controls = $("#authControls");
    const focusTarget = controls && !controls.hidden ? $("#authEmail") : $("#btnSignOut");
    if(focusTarget){
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (_err) {
        focusTarget.focus();
      }
    }
  }
}
const authToggle = $("#authToggle");
if(authToggle){
  authToggle.addEventListener("click", () => {
    const widget = $("#authWidget");
    const shouldExpand = widget?.classList.contains("collapsed");
    setAuthExpanded(!!shouldExpand);
  });
}
const authClose = $("#authClose");
if(authClose){
  authClose.addEventListener("click", () => setAuthExpanded(false));
}
document.addEventListener("click", (evt) => {
  const widget = $("#authWidget");
  if(!widget) return;
  if(widget.contains(evt.target)) return;
  setAuthExpanded(false);
});
document.addEventListener("keydown", (evt) => {
  if(evt.key === "Escape"){
    setAuthExpanded(false);
  }
});
function renderAuthUI(session){
  const s = $("#authStatus"), password = $("#authPassword");
  const controls = $("#authControls"), out = $("#btnSignOut");
  const toggleLabel = $("#authToggleLabel");
  const toggle = $("#authToggle");
  if(session?.user){
    s.textContent = `Signed in as ${session.user.email}`;
    if(controls) controls.hidden = true;
    if(out) out.hidden = false;
    if(password) password.value="";
    if(toggleLabel) toggleLabel.textContent = "Account";
    if(toggle) toggle.setAttribute("aria-label", `Account options for ${session.user.email}`);
  }
  else {
    s.textContent="Not signed in";
    if(controls) controls.hidden = false;
    if(out) out.hidden = true;
    if(password) password.value="";
    if(toggleLabel) toggleLabel.textContent = "Sign in";
    if(toggle) toggle.setAttribute("aria-label", "Open sign in panel");
  }
}
$("#btnSignIn").addEventListener("click", async (evt)=>{
  evt.preventDefault();
  if(typeof supabase === "undefined") return alert("Supabase is not configured.");
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  if(!email || !password) return alert("Enter both email and password.");
  const btn = evt.currentTarget;
  btn.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error){
      alert(error.message);
      return;
    }
    $("#authPassword").value = "";
    setAuthExpanded(false);
  } finally {
    btn.disabled = false;
  }
});
$("#btnSignUp").addEventListener("click", async (evt)=>{
  evt.preventDefault();
  if(typeof supabase === "undefined") return alert("Supabase is not configured.");
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  if(!email || !password) return alert("Enter both email and password.");
  const btn = evt.currentTarget;
  btn.disabled = true;
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if(error){
      alert(error.message);
      return;
    }
    $("#authPassword").value = "";
    if(data?.session){
      alert("Account created and signed in!");
    }else{
      alert("Account created. Check your email to confirm your address.");
    }
    setAuthExpanded(false);
  } finally {
    btn.disabled = false;
  }
});
$("#btnSignOut").addEventListener("click", ()=> {
  setAuthExpanded(false);
  supabase.auth.signOut();
});

async function cloudPull(){
  if(typeof supabase === "undefined") return;
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return;
  const { data, error } = await supabase
    .from(CLOUD_TABLE)
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if(!error && (!data || !data.data)){
    await cloudPullLegacy(user);
    queueCloudPush();
    return;
  }
  if(!error && data?.data){
    const remote = normalizeStore(data.data);
    if(remote.updatedAt && store.updatedAt && new Date(store.updatedAt) > new Date(remote.updatedAt)){
      queueCloudPush();
      return;
    }
    store = remote;
    selectedCultivarId = null;
    selectedProjectId = null;
    saveStore({ skipCloud: true, skipTouch: true });
    return;
  }
  if(error && !isMissingTableError(error)){
    console.error("Failed to pull cloud data", error);
  }
  await cloudPullLegacy(user);
}

async function cloudPullLegacy(user){
  try{
    const { data: cvs, error: cvError } = await supabase
      .from("cultivars")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    if(cvError){
      if(isMissingTableError(cvError)) return;
      throw cvError;
    }
    const { data: care, error: careError } = await supabase
      .from("care")
      .select("*")
      .eq("user_id", user.id)
      .order("date");
    if(careError){
      if(isMissingTableError(careError)) return;
      throw careError;
    }
    const map = new Map();
    (cvs||[]).forEach(c => {
      const normalized = normalizePlant(c);
      map.set(normalized.id, normalized);
    });
    (store.cultivars||[]).forEach(local => {
      if(!map.has(local.id)) map.set(local.id, local);
    });
    store.cultivars = Array.from(map.values());
    store.care = Array.isArray(care) ? care.map(entry => ({ ...entry })) : [];
    saveStore({ skipCloud: true });
  }catch(err){
    console.error("Legacy cloud pull failed", err);
  }
}

async function cloudPushAll(){
  if(typeof supabase === "undefined") return;
  const { data: { user } } = await supabase.auth.getUser();
  if(!user) return;
  const payload = {
    user_id: user.id,
    data: store,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase
    .from(CLOUD_TABLE)
    .upsert(payload, { onConflict: "user_id" });
  if(!error) return;
  if(isMissingTableError(error)){
    await cloudPushLegacy(user);
    return;
  }
  throw error;
}

async function cloudPushLegacy(user){
  try{
    const localIds = new Set((store.cultivars||[]).map(c => c.id));
    const { data: remoteCvIds } = await supabase
      .from("cultivars")
      .select("id")
      .eq("user_id", user.id);
    const toDelete = (remoteCvIds||[])
      .map(row => row.id)
      .filter(id => !localIds.has(id));
    if(toDelete.length){
      await supabase.from("cultivars").delete().eq("user_id", user.id).in("id", toDelete);
    }
    const cvPayload = (store.cultivars||[]).map(c=>({
      id:c.id,
      user_id:user.id,
      name:c.cultivarName || c.name || null,
      hybridizer:c.hybridizer||null,
      year:c.year?Number(c.year):null,
      blossom:c.blossom||null,
      color:c.color||null,
      leaf:c.leaf||null,
      variegation:c.variegation||null,
      pot:c.pot?Number(c.pot):null,
      location:c.location||null,
      acquired:c.acquired||null,
      source:c.source||null,
      water_interval:c.waterInterval??7,
      fert_interval:c.fertInterval??30,
      notes:c.notes||null,
      photo:c.photo||null,
      last_water:c._lastWater||null,
      last_fert:c._lastFert||null
    }));
    if(cvPayload.length){
      await supabase.from("cultivars").upsert(cvPayload, { onConflict: "id" });
    }

    await supabase.from("care").delete().eq("user_id", user.id);
    if(store.care.length){
      const carePayload = store.care.map(r=>({
        id:r.id,
        user_id:user.id,
        cultivar_id:r.cultivarId,
        date:r.date,
        action:r.action,
        notes:r.notes||null
      }));
      await supabase.from("care").insert(carePayload);
    }
  }catch(err){
    if(isMissingTableError(err)) return;
    console.error("Legacy cloud push failed", err);
    throw err;
  }
}

function queueCloudPush(){
  if(typeof supabase === "undefined" || !supabase?.auth) return;
  if(cloudPushTimer){
    clearTimeout(cloudPushTimer);
  }
  cloudPushTimer = setTimeout(async ()=>{
    cloudPushTimer = null;
    try{
      await cloudPushAll();
    }catch(err){
      console.error("Cloud sync failed", err);
    }
  }, 750);
}

ensureSession();
