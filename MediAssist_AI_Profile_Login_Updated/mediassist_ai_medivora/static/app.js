const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function toast(message){const e=$("#toast");e.textContent=message;e.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove("show"),3000)}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function api(path,options={}){const r=await fetch(path,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.detail||"Request failed. Try again.");return d}
function showView(name){$$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));$$("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));const titles={overview:"Your health, in one place.",symptoms:"Your health companion.",hospitals:"Find a place to start.",reminders:"Keep care on track.",records:"Your health vault."};$("#page-title").textContent=titles[name]||"MediAssist AI";if(name==="records")loadRecords();if(name==="reminders")loadReminders();window.scrollTo({top:0,behavior:"smooth"})}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
async function loadSummary(){
  let rec = 0, rem = 0, upc = 0;
  let backendOk = false;
  try {
    const d = await api("/api/summary");
    if (typeof d.records === "number") rec = d.records;
    if (typeof d.reminders === "number") rem = d.reminders;
    if (typeof d.upcoming === "number") upc = d.upcoming;
    backendOk = true;
    $("#status").textContent = "Companion connected";
  } catch {
    $("#status").textContent = "Local companion mode";
  }
  const localReminders = typeof getLocalReminders === "function" ? getLocalReminders() : [];
  if (!backendOk || localReminders.length > rem) {
    rem = localReminders.length;
    const nowIso = new Date().toISOString().slice(0, 16);
    upc = localReminders.filter(r => String(r.remind_at || "") >= nowIso).length;
  }
  const localRecords = typeof getLocalRecords === "function" ? getLocalRecords() : [];
  if (!backendOk || localRecords.length > rec) {
    rec = localRecords.length;
  }
  $("#stat-records").textContent = rec;
  $("#stat-reminders").textContent = rem;
  $("#stat-upcoming").textContent = upc;
}
function setAgentState(agent,state){const row=$(`[data-agent="${agent}"]`);if(!row)return;row.classList.remove("running","completed","alert");if(state==="Running")row.classList.add("running");if(state==="Completed")row.classList.add("completed");if(state==="Urgent alert")row.classList.add("alert");row.querySelector(".workflow-state").textContent=state}
function resetAgentStates(){["safety","intake","guidance","routing"].forEach(k=>setAgentState(k,"Ready"))}
let lastAssessment=null;
function downloadAssessment(){if(!lastAssessment){toast("Run an assessment first.");return}const d=lastAssessment;const lines=["MEDIASSIST AI — EDUCATIONAL ASSESSMENT REPORT",`Generated: ${new Date().toLocaleString()}`,`Age: ${d.age??"Not provided"}`,`Symptoms entered: ${d.symptoms}`,`Urgent warning flagged: ${d.urgent?"YES — seek immediate professional assessment":"No selected warning phrase detected (this does not rule out an emergency)"}`,"","SAFETY SCREEN",...(d.safety.messages.length?d.safety.messages:["No selected emergency warning phrase matched."]),"", "INTAKE SUMMARY",d.intake.summary,"", "FOLLOW-UP QUESTIONS",...d.intake.follow_up_prompts.map(x=>"- "+x),"", "GENERAL GUIDANCE",d.guidance.answer,"", "CARE NAVIGATION",d.routing.suggestion,d.routing.reason,"", "LIMITATION: Student educational prototype only. Not a diagnosis, medical device, or substitute for a licensed clinician. The keyword screen is incomplete and may miss emergencies."];const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="mediassist-assessment.txt";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
$("#symptom-form").addEventListener("submit",async e=>{e.preventDefault();const btn=$("#symptom-submit"),symptoms=$("#symptoms").value.trim(),age=$("#age").value;btn.disabled=true;btn.textContent="Running agents…";$("#agent-status").textContent="Safety screening is running first…";$("#symptom-result").innerHTML='<div class="empty">Processing the entered information. Agent states update as results arrive.</div>';resetAgentStates();setAgentState("safety","Running");try{
 const safety=await api("/api/emergency-check",{method:"POST",body:JSON.stringify({symptoms,age:age===""?null:Number(age)})});setAgentState("safety",safety.urgent?"Urgent alert":"Completed");setAgentState("intake","Running");
 const d=await api("/api/symptoms",{method:"POST",body:JSON.stringify({symptoms,age:age===""?null:Number(age)})});setAgentState("intake","Completed");setAgentState("guidance","Running");if(d.guidance.mode==="safety response")setAgentState("guidance","Completed");else setAgentState("guidance","Completed");setAgentState("routing","Completed");lastAssessment={...d,symptoms,age:age===""?null:Number(age)};
 $("#agent-status").textContent=`Assessment completed · Guidance source: ${d.guidance.mode}`;const alert=d.urgent?`<div class="urgent-box"><b>⚠ Emergency warning phrase detected</b><br>${(d.safety.messages||[]).map(esc).join("<br>")}<br><br>Contact your local emergency number or seek emergency care now. Do not wait for this app.</div>`:"";const route=d.routing||{},intake=d.intake||{},safetyData=d.safety||{};
 const followups=(intake.follow_up_prompts||[]).map(q=>`<li>${esc(q)}</li>`).join("");const safetyMessages=(safetyData.messages||[]).map(q=>`<li>${esc(q)}</li>`).join("");
 $("#symptom-result").innerHTML=`${alert}<div class="answer">${esc(d.guidance.answer)}</div><div class="agent-detail-grid"><article class="agent-detail"><h4>✳ INTAKE AGENT · STRUCTURED SUMMARY</h4><p><b>Age:</b> ${age===""?"Not provided":esc(age)} years</p><p style="margin-top:6px"><b>Reported:</b> ${esc(intake.summary||symptoms)}</p></article><article class="agent-detail"><h4>⚑ SAFETY AGENT · SCREENING</h4><p>${d.urgent?"Selected emergency warning phrase(s) matched:":"No selected emergency phrase matched. This does not rule out an emergency."}</p>${safetyMessages?`<ul>${safetyMessages}</ul>`:""}<p style="margin-top:7px">${esc(safetyData.disclaimer||"")}</p></article><article class="agent-detail"><h4>✦ HEALTH GUIDANCE AGENT</h4><p><b>Source:</b> ${esc(d.guidance.mode||"unknown")}${d.guidance.model?` · ${esc(d.guidance.model)}`:""}</p><p style="margin-top:6px">General information only; not a diagnosis or treatment plan.</p></article><article class="agent-detail"><h4>⌖ CARE NAVIGATION AGENT</h4><p>${esc(route.suggestion||"Contact a qualified healthcare professional for personal guidance.")}</p><p style="margin-top:6px">${esc(route.reason||"")}</p></article><article class="agent-detail"><h4>▤ INFORMATION TO DISCUSS</h4><ul>${followups}</ul><p style="margin-top:6px">These are prompts for a clinician, not diagnostic questions.</p></article><article class="agent-detail"><h4>◈ WORKFLOW SUMMARY</h4><p>Safety screening → symptom intake → general guidance → care navigation. Agents use limited rules and/or a local language model; outputs are not clinically validated.</p></article></div><div class="report-actions"><button type="button" id="download-report">↓ Download assessment report (.txt)</button><button type="button" id="copy-summary">▣ Copy summary</button></div><div class="notice"><strong>Safety note:</strong> A missing alert does not mean a person is safe. If symptoms are severe, sudden, or worsening, seek urgent professional care.</div>`;
 $("#download-report").addEventListener("click",downloadAssessment);$("#copy-summary").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(`Symptoms: ${symptoms}\nGuidance: ${d.guidance.answer}\nCare navigation: ${route.suggestion||""}\nEmergency warning flagged: ${d.urgent}\nEducational prototype; not a diagnosis.`);toast("Summary copied.")}catch{toast("Copy is unavailable in this browser.")}});
 }catch(err){["intake","guidance","routing"].forEach(k=>setAgentState(k,"Error"));$("#agent-status").textContent="Assessment could not complete";$("#symptom-result").innerHTML=`<div class="urgent-box">${esc(err.message)}<br>Please check the backend and try again.</div>`}finally{btn.disabled=false;btn.innerHTML='Get general guidance <span>↗</span>'}});
$("#hospital-form").addEventListener("submit",async e=>{e.preventDefault();const city=$("#city").value.trim(),box=$("#hospital-results");box.innerHTML='<div class="empty">Searching public map listings…</div>';try{const d=await api(`/api/hospitals?city=${encodeURIComponent(city)}`);if(!d.results.length){box.innerHTML=`<div class="empty"><span class="empty-icon">⌖</span><b>No results returned</b><p>Try another area or open the map search.</p></div><div class="result-item"><div><h4>Map search</h4><p>${esc(d.note)}</p></div><a href="${esc(d.search_url)}" target="_blank" rel="noopener">Open map ↗</a></div>`;return}box.innerHTML=d.results.map(x=>`<article class="result-item"><div><h4>${esc(x.name)}</h4><p>${esc(x.address)}</p></div><a href="${esc(x.map_url)}" target="_blank" rel="noopener">Map ↗</a></article>`).join("")+`<div class="notice">${esc(d.note)}</div>`}catch(err){box.innerHTML=`<div class="urgent-box">${esc(err.message)}</div>`}});
function fmt(v){
  if(!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

const REMINDERS_KEY = "mediassist_reminders_v1";
const RECORDS_KEY = "mediassist_records_v1";

function getLocalReminders(){
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalReminders(list){
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
  } catch {}
}

function renderReminders(list){
  const box = $("#reminder-list");
  if (!box) return;
  if (!Array.isArray(list) || list.length === 0){
    box.innerHTML = '<div class="empty"><span class="empty-icon">◷</span><b>No reminders yet</b><p>Add a date and time to keep a task on your list.</p></div>';
    return;
  }
  const sorted = [...list].sort((a,b) => String(a.remind_at || "").localeCompare(String(b.remind_at || "")));
  box.innerHTML = sorted.map(x => `
    <article class="result-item">
      <div>
        <span class="tag">${esc(x.kind || "Appointment")}</span>
        <h4>${esc(x.title)}</h4>
        <p>${esc(fmt(x.remind_at))}</p>
        ${x.notes ? `<p>${esc(x.notes)}</p>` : ""}
      </div>
      <button class="delete" data-del-reminder="${esc(x.id)}">Delete</button>
    </article>
  `).join("");
}

async function loadReminders(){
  const box = $("#reminder-list");
  const cached = getLocalReminders();
  if (cached.length > 0) {
    renderReminders(cached);
  }

  try {
    const serverList = await api("/api/reminders");
    if (Array.isArray(serverList)) {
      const localOnly = cached.filter(item => String(item.id).startsWith("local_"));
      const merged = [...serverList, ...localOnly];
      saveLocalReminders(merged);
      renderReminders(merged);
    } else if (cached.length === 0) {
      renderReminders([]);
    }
  } catch (err) {
    if (cached.length > 0) {
      renderReminders(cached);
    } else if (box) {
      box.innerHTML = '<div class="empty"><span class="empty-icon">◷</span><b>No reminders yet</b><p>Add a date and time to keep a task on your list.</p></div>';
    }
  }
}

$("#reminder-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  if (btn) btn.disabled = true;

  const title = $("#reminder-title").value.trim();
  const kind = $("#reminder-kind").value;
  const remind_at = $("#reminder-time").value;
  const notes = $("#reminder-notes").value.trim();
  const payload = { title, kind, remind_at, notes };

  try {
    const saved = await api("/api/reminders", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (saved && saved.id) {
      const current = getLocalReminders().filter(r => r.id !== saved.id);
      current.push(saved);
      saveLocalReminders(current);
      renderReminders(current);
      e.target.reset();
      toast("Reminder saved.");
    } else {
      throw new Error("Invalid response");
    }
  } catch (err) {
    const fallbackItem = {
      ...payload,
      id: "local_" + Date.now(),
      created_at: new Date().toISOString()
    };
    const current = getLocalReminders();
    current.push(fallbackItem);
    saveLocalReminders(current);
    renderReminders(current);
    e.target.reset();
    toast("Reminder saved to browser storage.");
  } finally {
    if (btn) btn.disabled = false;
    await loadSummary();
  }
});

$("#reminder-list")?.addEventListener("click", async e => {
  const b = e.target.closest("[data-del-reminder]");
  if (!b) return;
  const id = b.dataset.delReminder;

  const current = getLocalReminders().filter(r => String(r.id) !== String(id));
  saveLocalReminders(current);
  renderReminders(current);

  if (!String(id).startsWith("local_")) {
    try {
      await api(`/api/reminders/${id}`, { method: "DELETE" });
      toast("Reminder deleted.");
    } catch {
      toast("Reminder deleted from local view.");
    }
  } else {
    toast("Reminder deleted.");
  }
  await loadSummary();
});

function getLocalRecords(){
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRecords(list){
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(list));
  } catch {}
}

function renderRecords(list){
  const box = $("#record-list");
  if (!box) return;
  if (!Array.isArray(list) || list.length === 0){
    box.innerHTML = '<div class="empty"><span class="empty-icon">▤</span><b>Your vault is ready</b><p>Add a note you want to keep for your own reference.</p></div>';
    return;
  }
  box.innerHTML = list.map(x => `
    <article class="result-item">
      <div>
        <span class="tag">${esc(x.category || "Note")}</span>
        <p class="record-body">${esc(x.content)}</p>
        <div class="record-date">${esc(fmt(x.created_at))}</div>
      </div>
      <button class="delete" data-del-record="${esc(x.id)}">Delete</button>
    </article>
  `).join("");
}

async function loadRecords(){
  const box = $("#record-list");
  const cached = getLocalRecords();
  if (cached.length > 0) {
    renderRecords(cached);
  }

  try {
    const serverList = await api("/api/records");
    if (Array.isArray(serverList)) {
      const localOnly = cached.filter(item => String(item.id).startsWith("local_"));
      const merged = [...serverList, ...localOnly];
      saveLocalRecords(merged);
      renderRecords(merged);
    } else if (cached.length === 0) {
      renderRecords([]);
    }
  } catch (err) {
    if (cached.length > 0) {
      renderRecords(cached);
    } else if (box) {
      box.innerHTML = '<div class="empty"><span class="empty-icon">▤</span><b>Your vault is ready</b><p>Add a note you want to keep for your own reference.</p></div>';
    }
  }
}

$("#record-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  if (btn) btn.disabled = true;

  const category = $("#record-category").value;
  const content = $("#record-content").value.trim();
  const payload = { category, content };

  try {
    const saved = await api("/api/records", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (saved && saved.id) {
      const current = getLocalRecords().filter(r => r.id !== saved.id);
      current.unshift(saved);
      saveLocalRecords(current);
      renderRecords(current);
      e.target.reset();
      toast("Note saved to health vault.");
    } else {
      throw new Error("Invalid response");
    }
  } catch (err) {
    const fallbackItem = {
      ...payload,
      id: "local_" + Date.now(),
      created_at: new Date().toISOString()
    };
    const current = getLocalRecords();
    current.unshift(fallbackItem);
    saveLocalRecords(current);
    renderRecords(current);
    e.target.reset();
    toast("Note saved to browser vault.");
  } finally {
    if (btn) btn.disabled = false;
    await loadSummary();
  }
});

$("#record-list")?.addEventListener("click", async e => {
  const b = e.target.closest("[data-del-record]");
  if (!b) return;
  const id = b.dataset.delRecord;

  const current = getLocalRecords().filter(r => String(r.id) !== String(id));
  saveLocalRecords(current);
  renderRecords(current);

  if (!String(id).startsWith("local_")) {
    try {
      await api(`/api/records/${id}`, { method: "DELETE" });
      toast("Record deleted.");
    } catch {
      toast("Record deleted from local view.");
    }
  } else {
    toast("Record deleted.");
  }
  await loadSummary();
});

loadSummary();loadReminders();loadRecords();


// Profile menu and Google Identity Services integration.
// Configure GOOGLE_CLIENT_ID with an OAuth 2.0 Web client ID from Google Cloud Console.
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";
const profileButton = document.querySelector("#profile-button");
const profileMenu = document.querySelector("#profile-menu");
const authBackdrop = document.querySelector("#auth-backdrop");
const authConfigNote = document.querySelector("#auth-config-note");
const googleSlot = document.querySelector("#google-signin-button");
const profileStateKey = "mediassist_profile_v1";
function currentProfile(){try{return JSON.parse(sessionStorage.getItem(profileStateKey)||"null")}catch{return null}}
function renderProfile(profile){
  const name=profile?.name||"Guest profile", email=profile?.email||"Not signed in", initial=profile?.name?.trim()?.[0]?.toUpperCase()||"M";
  $("#profile-name").textContent=name;$("#profile-email").textContent=email;$("#profile-button").textContent=initial;$("#profile-mini-avatar").textContent=initial;
  $("#profile-signin").hidden=!!profile;$("#profile-signout").hidden=!profile;
  $("#profile-help").textContent=profile?"Signed in for this browser session. Health records remain local to this demo.":"Sign in to personalize this browser session.";
}
function openAuthDialog(){authBackdrop.hidden=false;profileMenu.hidden=true;profileButton.setAttribute("aria-expanded","false");
  if(GOOGLE_CLIENT_ID.startsWith("YOUR_")){authConfigNote.textContent="Setup required: add a Google OAuth Web Client ID in static/app.js, then register http://127.0.0.1:8000 and http://localhost:8000 as authorized JavaScript origins in Google Cloud Console. This demo does not ask for or store your Google password.";googleSlot.innerHTML='<button class="google-demo-config" type="button" id="google-setup-help">Google sign-in setup required</button>';return;}
  authConfigNote.textContent="Google will share your basic profile details with this app after you consent. Do not store sensitive medical data in this demo.";
  const draw=()=>{if(!window.google?.accounts?.id){setTimeout(draw,250);return}googleSlot.innerHTML="";google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:handleGoogleCredential,auto_select:false});google.accounts.id.renderButton(googleSlot,{theme:"outline",size:"large",shape:"pill",text:"continue_with",width:280});};draw();
}
function handleGoogleCredential(response){
  // Google Identity Services provides the credential. For production, verify it server-side before trusting identity.
  try{const payload=response.credential.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");const data=JSON.parse(decodeURIComponent(escape(atob(payload))));if(!data.email||!data.name)throw new Error("Google did not return a profile.");const profile={name:data.name,email:data.email,picture:data.picture||"",signedInAt:new Date().toISOString()};sessionStorage.setItem(profileStateKey,JSON.stringify(profile));renderProfile(profile);authBackdrop.hidden=true;toast("Signed in as "+profile.email+".");}catch(e){authConfigNote.textContent="Could not read the Google profile. Please try again.";}
}
profileButton?.addEventListener("click",()=>{profileMenu.hidden=!profileMenu.hidden;profileButton.setAttribute("aria-expanded",String(!profileMenu.hidden));});
$("#profile-signin")?.addEventListener("click",openAuthDialog);
$("#profile-signout")?.addEventListener("click",()=>{sessionStorage.removeItem(profileStateKey);renderProfile(null);profileMenu.hidden=true;profileButton.setAttribute("aria-expanded","false");toast("You have signed out.");});
$("#auth-close")?.addEventListener("click",()=>authBackdrop.hidden=true);
authBackdrop?.addEventListener("click",e=>{if(e.target===authBackdrop)authBackdrop.hidden=true});
document.addEventListener("click",e=>{if(profileMenu&&!profileMenu.hidden&&!e.target.closest(".profile-wrap")){profileMenu.hidden=true;profileButton.setAttribute("aria-expanded","false")}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){profileMenu.hidden=true;authBackdrop.hidden=true;profileButton?.setAttribute("aria-expanded","false")}});
renderProfile(currentProfile());
