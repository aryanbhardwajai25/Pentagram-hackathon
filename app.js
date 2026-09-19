const WARDS = {
  ICU: { label: 'Intensive Care Unit', short: 'ICU', count: 8 },
  Emergency: { label: 'Emergency Ward', short: 'Emergency', count: 15 },
  General: { label: 'General Ward', short: 'General', count: 15 }
};

const PATIENT_NAMES = ['Maya Patel', 'Jordan Davis', 'Liam Chen', 'Sofia Williams', 'Noah Wilson', 'Ava Martinez', 'Ethan Brooks', 'Olivia Thompson', 'Amir Hassan', 'Grace Kim', 'Theo Morgan', 'Nora Johnson', 'Sam Rivera', 'Priya Shah', 'Leo Anderson', 'Emma Carter', 'Daniel Lee', 'Iris Moore'];
const DOCTORS = ['Dr. Sarah Rao', 'Dr. Chen', 'Dr. Okafor', 'Dr. Rivera', 'Dr. Singh', 'Dr. Williams'];
let state;
let timerId;
let telemetryChart;
let toastTimer;
let activeRole = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function createPatient(overrides = {}) {
  const acuity = overrides.acuity || randomInt(1, 5);
  return {
    id: overrides.id || `P-${String(Math.floor(Math.random() * 900) + 100)}`,
    name: overrides.name || PATIENT_NAMES[Math.floor(Math.random() * PATIENT_NAMES.length)],
    age: overrides.age || randomInt(19, 86),
    acuity,
    bedType: overrides.bedType || (acuity >= 5 ? 'ICU' : acuity >= 4 ? 'Emergency' : 'General'),
    wait: overrides.wait || 0,
    arrival: state ? state.elapsed : 0
  };
}

function createInitialState() {
  const occupied = [
    ['ICU', 0, 'Jordan Davis', 5, 42], ['ICU', 1, 'Maya Patel', 5, 29], ['ICU', 2, 'Liam Chen', 4, 67], ['ICU', 3, 'Sofia Williams', 3, 54],
    ['Emergency', 0, 'Noah Wilson', 5, 31], ['Emergency', 1, 'Ava Martinez', 4, 45], ['Emergency', 2, 'Ethan Brooks', 4, 71], ['Emergency', 3, 'Olivia Thompson', 3, 22], ['Emergency', 4, 'Amir Hassan', 5, 58], ['Emergency', 5, 'Grace Kim', 2, 36],
    ['General', 0, 'Theo Morgan', 3, 63], ['General', 1, 'Nora Johnson', 2, 41], ['General', 2, 'Sam Rivera', 3, 76], ['General', 3, 'Priya Shah', 1, 25], ['General', 4, 'Leo Anderson', 2, 52]
  ];
  const beds = [];
  Object.entries(WARDS).forEach(([type, ward]) => {
    for (let index = 0; index < ward.count; index += 1) {
      const found = occupied.find((item) => item[0] === type && item[1] === index);
      const patient = found ? { id: `P-${String(100 + index + type.length).padStart(3, '0')}`, name: found[2], age: found[4], acuity: found[3], doctor: index % 3 === 0 ? 'Dr. Sarah Rao' : DOCTORS[index % DOCTORS.length], heartRate: found[3] >= 5 ? randomInt(106, 128) : randomInt(72, 102), spo2: found[3] >= 5 ? randomInt(89, 96) : randomInt(95, 100), treatment: randomInt(18, 94), note: '' } : null;
      beds.push({ id: `${type}-${String(index + 1).padStart(2, '0')}`, type, index, patient });
    }
  });
  return { running: false, speed: 1, strategy: 'c', elapsed: 0, clockMinutes: 480, beds, queue: [createPatient({ id: 'P-482', name: 'Elena Garcia', age: 48, acuity: 4, wait: 7, bedType: 'Emergency' }), createPatient({ id: 'P-517', name: 'Marcus Reed', age: 36, acuity: 3, wait: 13, bedType: 'General' }), createPatient({ id: 'P-533', name: 'Rina Das', age: 24, acuity: 2, wait: 18, bedType: 'General' }), createPatient({ id: 'P-548', name: 'William Scott', age: 79, acuity: 4, wait: 22, bedType: 'Emergency' }), createPatient({ id: 'P-561', name: 'Camila Torres', age: 19, acuity: 1, wait: 29, bedType: 'General' })], doctors: 8, nurses: 18, icuOutage: 0, history: { labels: ['08:00'], waits: [12], utilization: [53] }, nextId: 600 };
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function initials(name) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2); }
function formatClock(minutes) { const hour = Math.floor(minutes / 60) % 24; const minute = minutes % 60; return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; }
function getBadge(patient) { const effectiveAcuity = state.strategy === 'c' && patient.wait >= (patient.acuity <= 2 ? 25 : 45) ? 5 : patient.acuity; return effectiveAcuity >= 5 ? { label: 'Critical', className: 'critical' } : effectiveAcuity >= 3 ? { label: 'Urgent', className: 'urgent' } : { label: 'Routine', className: 'routine' }; }
function getPriority(patient) { if (state.strategy === 'a') return 1000 - patient.arrival; if (state.strategy === 'b') return patient.acuity * 100 + (100 - patient.wait); return patient.acuity * 100 + Math.min(patient.wait * 2.3, 100) + (patient.wait >= 30 ? 65 : 0); }
function availableBeds() { return state.beds.filter((bed) => !bed.patient && !isOutageBed(bed)).length; }
function isOutageBed(bed) { return bed.type === 'ICU' && bed.index >= WARDS.ICU.count - state.icuOutage; }
function sortedQueue() { return [...state.queue].sort((a, b) => getPriority(b) - getPriority(a)); }

function render() {
  renderStats(); renderFloorPlan(); renderQueue(); renderChart(); renderDoctorPortal(); renderPatientPortal();
  $('#simulationClock').textContent = formatClock(state.clockMinutes);
  $('#simulationStatus').textContent = state.running ? `Running · ${state.speed}x` : state.elapsed ? 'Paused' : 'Ready';
  $('#strategySelect').value = state.strategy;
  $('#insightText').textContent = state.strategy === 'c' ? 'Current run is protected against patient starvation.' : 'Switch to Strategy C to activate starvation prevention.';
}

function renderDoctorPortal() {
  const assigned = state.beds.filter((bed) => bed.patient && bed.patient.doctor === 'Dr. Sarah Rao');
  $('#doctorPatientCount').textContent = assigned.length;
  $('#doctorCriticalCount').textContent = assigned.filter((bed) => bed.patient.acuity >= 5).length;
  $('#doctorAvailableCount').textContent = Math.max(0, assigned.length - assigned.filter((bed) => bed.patient.acuity >= 5).length);
  $('#doctorPatientGrid').innerHTML = assigned.length ? assigned.map(({ id, patient }) => `<article class="doctor-card panel"><div class="doctor-card-top"><div class="patient-avatar">${initials(patient.name)}</div><span class="triage-badge ${getBadge(patient).className}">${getBadge(patient).label}</span></div><h3>${patient.name}</h3><p class="doctor-bed">Bed ${id}</p><div class="doctor-vitals"><div><span>Heart rate</span><strong>${patient.heartRate} <small>BPM</small></strong></div><div><span>SpO2</span><strong>${patient.spo2}<small>%</small></strong></div><div><span>Time remaining</span><strong>${Math.max(0, patient.treatment)} <small>min</small></strong></div></div><label class="note-label">Quick care note<textarea data-note-id="${id}" placeholder="Add a note for the care team...">${patient.note || ''}</textarea></label><button class="button button-primary wide" data-discharge-id="${id}">Complete Treatment / Discharge</button></article>`).join('') : '<div class="empty-role panel"><strong>No active patients assigned</strong><p>New assignments will appear here as the simulation progresses.</p></div>';
  $$('#doctorPatientGrid [data-discharge-id]').forEach((button) => button.addEventListener('click', () => dischargePatient(button.dataset.dischargeId)));
  $$('#doctorPatientGrid [data-note-id]').forEach((textarea) => textarea.addEventListener('input', (event) => { const bed = state.beds.find((item) => item.id === event.target.dataset.noteId); if (bed && bed.patient) bed.patient.note = event.target.value; }));
}

function renderPatientPortal() {
  const patients = [...sortedQueue().map((patient) => ({ ...patient, source: 'queue' })), ...state.beds.filter((bed) => bed.patient).map((bed) => ({ ...bed.patient, bedId: bed.id, source: 'bed' }))];
  const select = $('#patientSelect'); const selected = select.value || patients[0]?.id;
  select.innerHTML = patients.length ? patients.map((patient) => { const queueIndex = sortedQueue().findIndex((queuedPatient) => queuedPatient.id === patient.id); return `<option value="${patient.id}">${patient.name} (${patient.source === 'queue' ? `Triage #${String(queueIndex + 1).padStart(2, '0')}` : patient.bedId})</option>`; }).join('') : '<option>No active patients</option>';
  if (patients.some((patient) => patient.id === selected)) select.value = selected;
  const patient = patients.find((item) => item.id === select.value) || patients[0];
  if (!patient) { $('#patientStatusCard').innerHTML = '<div class="patient-empty">No active patient records yet.</div>'; return; }
  const waiting = patient.source === 'queue'; const position = waiting ? sortedQueue().findIndex((item) => item.id === patient.id) + 1 : 0;
  $('#patientStatusCard').innerHTML = `<div class="status-card-header"><div class="patient-avatar">${initials(patient.name)}</div><div><p class="eyebrow teal-text">Live care status</p><h3>${patient.name}</h3><span>Patient ID ${patient.id}</span></div><span class="status-pill ${waiting ? 'waiting' : 'receiving'}">${waiting ? 'Waiting' : 'In care'}</span></div><div class="patient-status-main"><div class="status-message"><span class="status-icon">${waiting ? '◷' : '✓'}</span><div><strong>${waiting ? 'Waiting for Bed Assignment' : `Currently Receiving Care in ${patient.bedId}`}</strong><p>${waiting ? 'Our team is preparing the right care space for you.' : 'Your care team is actively monitoring your treatment.'}</p></div></div><div class="patient-metrics"><div><span>${waiting ? 'Estimated wait' : 'Time remaining'}</span><strong>${waiting ? Math.max(1, 30 - patient.wait) : Math.max(0, patient.treatment)} <small>min</small></strong></div><div><span>Queue position</span><strong>${waiting ? `#${position}` : '—'}</strong></div><div><span>Assigned physician</span><strong class="physician-name">${patient.doctor || 'Assigning now'}</strong></div></div></div>`;
}

function dischargePatient(bedId) { const bed = state.beds.find((item) => item.id === bedId); if (!bed || !bed.patient) return; const name = bed.patient.name; bed.patient = null; render(); showToast(`${name} discharged. ${bedId} is now available.`); }

function switchRole(role) { activeRole = role; $('#portalSelector').hidden = true; $('.topbar').hidden = false; $('#staffView').hidden = role !== 'staff'; $('#doctorView').hidden = role !== 'doctor'; $('#patientView').hidden = role !== 'patient'; if (role === 'staff' && telemetryChart) telemetryChart.resize(); render(); }
function showPortalSelector() { activeRole = null; $('#portalSelector').hidden = false; $('.topbar').hidden = true; $('#staffView').hidden = true; $('#doctorView').hidden = true; $('#patientView').hidden = true; }

function renderStats() {
  const free = availableBeds(); const total = state.beds.length - state.icuOutage; const used = total - free; const utilization = Math.round((used / total) * 100); const averageWait = Math.round(state.queue.reduce((sum, patient) => sum + patient.wait, 0) / Math.max(state.queue.length, 1));
  $('#bedStat').innerHTML = `${free} <small>/ ${total} free</small>`; $('#bedProgress').style.width = `${Math.max(3, 100 - utilization)}%`; $('#bedFoot').textContent = `${utilization}% capacity utilized`;
  $('#waitStat').innerHTML = `${averageWait} <small>mins</small>`; $('#waitFoot').textContent = averageWait > 30 ? 'Above target · consider surge response' : 'Target under 30 minutes'; $('#waitTrend').textContent = averageWait > 30 ? 'Needs attention' : 'Live';
  $('#doctorStat').innerHTML = `${state.doctors} <small>/ 10</small>`; $('#nurseStat').innerHTML = `${state.nurses} <small>/ 20</small>`; $('#staffFoot').textContent = state.doctors < 8 ? 'Reduced clinical coverage' : 'Full clinical coverage';
  $('#occupiedCount').textContent = used; $('#criticalCount').textContent = state.beds.filter((bed) => bed.patient && bed.patient.acuity >= 5).length + state.queue.filter((patient) => getBadge(patient).className === 'critical').length;
}

function renderFloorPlan() {
  $('#floorPlan').innerHTML = Object.entries(WARDS).map(([type, ward]) => `<div class="ward ${type === 'ICU' ? 'icu' : ''}"><div class="ward-header"><strong>${ward.label}</strong><span>${state.beds.filter((bed) => bed.type === type && bed.patient).length} / ${ward.count - (type === 'ICU' ? state.icuOutage : 0)} occupied</span></div><div class="beds">${state.beds.filter((bed) => bed.type === type).map((bed) => { const outage = isOutageBed(bed); const classes = outage ? 'outage' : bed.patient ? bed.patient.acuity >= 5 ? 'critical' : 'occupied' : ''; return `<button class="bed ${classes}" data-bed-id="${bed.id}" ${outage ? 'disabled' : ''} title="${outage ? 'Equipment outage' : bed.patient ? `View ${bed.patient.name}` : 'Available bed'}">${outage ? 'OFF' : bed.patient ? bed.patient.id : bed.id.split('-')[1]}</button>`; }).join('')}</div></div>`).join('');
  $$('.bed:not([disabled])').forEach((button) => button.addEventListener('click', () => { const bed = state.beds.find((item) => item.id === button.dataset.bedId); if (bed.patient) openBedModal(bed); }));
}

function renderQueue() {
  const queue = sortedQueue(); $('#queueCount').textContent = `${state.queue.length} waiting`; $('#queueList').innerHTML = queue.length ? queue.map((patient) => { const badge = getBadge(patient); return `<div class="queue-item"><div class="queue-avatar">${initials(patient.name)}</div><div class="queue-main"><strong>${patient.name}</strong><div class="queue-meta"><span>${patient.id}</span><span>Age ${patient.age}</span><span class="triage-badge ${badge.className}">${badge.label}</span></div></div><div class="queue-side"><strong class="queue-score">${Math.round(getPriority(patient))}</strong><span class="queue-wait">${patient.wait} min wait</span></div></div>`; }).join('') : '<div class="queue-empty"><div><strong>Queue clear</strong><p>No patients waiting for triage.</p></div></div>';
}

function renderChart() { if (!telemetryChart) return; telemetryChart.data.labels = state.history.labels; telemetryChart.data.datasets[0].data = state.history.waits; telemetryChart.data.datasets[1].data = state.history.utilization; telemetryChart.update('none'); }

function tick() {
  const increments = state.speed; state.elapsed += increments; state.clockMinutes += increments;
  state.queue.forEach((patient) => { patient.wait += increments; });
  state.beds.forEach((bed) => { if (bed.patient) { bed.patient.treatment -= increments; if (bed.patient.treatment <= 0) bed.patient = null; } });
  if (state.elapsed % 3 === 0) admitNextPatient();
  if (state.elapsed % 5 === 0) addTelemetryPoint();
  render();
}

function admitNextPatient() { const ordered = sortedQueue(); const candidate = ordered.find((patient) => findBedFor(patient)); if (!candidate) return; const bed = findBedFor(candidate); bed.patient = { ...candidate, doctor: DOCTORS[(state.elapsed + bed.index) % DOCTORS.length], heartRate: candidate.acuity >= 5 ? randomInt(108, 132) : randomInt(70, 105), spo2: candidate.acuity >= 5 ? randomInt(89, 96) : randomInt(95, 100), treatment: randomInt(22, 85) }; state.queue = state.queue.filter((patient) => patient.id !== candidate.id); }
function findBedFor(patient) { const preferred = state.beds.find((bed) => bed.type === patient.bedType && !bed.patient && !isOutageBed(bed)); return preferred || state.beds.find((bed) => bed.type !== 'ICU' && !bed.patient && !isOutageBed(bed)); }
function addTelemetryPoint() { const free = availableBeds(); const total = state.beds.length - state.icuOutage; state.history.labels.push(formatClock(state.clockMinutes)); state.history.waits.push(Math.round(state.queue.reduce((sum, patient) => sum + patient.wait, 0) / Math.max(state.queue.length, 1))); state.history.utilization.push(Math.round(((total - free) / total) * 100)); if (state.history.labels.length > 12) { Object.values(state.history).forEach((values) => values.shift()); } }

function openBedModal(bed) { const patient = bed.patient; $('#modalBedLabel').textContent = `BED ${bed.id.toUpperCase()}`; $('#modalPatientName').textContent = patient.name; $('#modalPatientMeta').textContent = `Age ${patient.age} · ${getBadge(patient).label} care`; $('#modalAvatar').textContent = initials(patient.name); $('#modalBadge').textContent = getBadge(patient).label; $('#modalBadge').className = `triage-badge ${getBadge(patient).className}`; $('#modalHeartRate').innerHTML = `${patient.heartRate} <small>BPM</small>`; $('#modalSpo2').innerHTML = `${patient.spo2}<small>% SpO2</small>`; $('#modalDoctor').textContent = patient.doctor; $('#modalTreatment').innerHTML = `${Math.max(0, patient.treatment)} <small>min</small>`; $('#bedModal').hidden = false; }
function closeModals() { $$('.modal-backdrop').forEach((modal) => { modal.hidden = true; }); }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); }

function loadDataset() { const names = ['Harper Lewis', 'Michael Young', 'Zoe King', 'Andre Brown', 'Luna Flores', 'Henry Green', 'Layla Adams', 'Owen Baker', 'Mila Nelson', 'Isaac Hall']; state.queue = Array.from({ length: 50 }, (_, index) => createPatient({ id: `ED-${String(index + 1).padStart(2, '0')}`, name: `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`, age: randomInt(18, 89), acuity: index < 7 ? 5 : index < 20 ? 4 : randomInt(1, 3), wait: randomInt(0, 8), bedType: index < 7 ? 'ICU' : index < 25 ? 'Emergency' : 'General' })); render(); showToast('50 anonymized emergency records loaded into triage.'); }
function addCustomPatient(event) { event.preventDefault(); const form = new FormData(event.currentTarget); state.queue.push(createPatient({ id: `P-${state.nextId++}`, name: form.get('name'), age: Number(form.get('age')), acuity: Number(form.get('acuity')), bedType: form.get('bedType') })); event.currentTarget.reset(); $('#customModal').hidden = true; render(); showToast('Patient added to the live triage queue.'); }

function initChart() { const ctx = $('#telemetryChart'); telemetryChart = new Chart(ctx, { type: 'line', data: { labels: state.history.labels, datasets: [{ label: 'Average wait time', data: state.history.waits, borderColor: '#2B7BB9', backgroundColor: 'rgba(43,123,185,.08)', tension: .4, fill: true, pointRadius: 2, pointBackgroundColor: '#2B7BB9' }, { label: 'Bed utilization %', data: state.history.utilization, borderColor: '#12807C', backgroundColor: 'transparent', tension: .4, pointRadius: 2, pointBackgroundColor: '#12807C' }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#14324F', padding: 10, titleFont: { family: 'DM Sans' }, bodyFont: { family: 'DM Sans' } } }, scales: { x: { grid: { display: false }, ticks: { color: '#718397', font: { size: 10 } } }, y: { beginAtZero: true, suggestedMax: 100, grid: { color: '#edf1f3' }, ticks: { color: '#718397', font: { size: 10 } } } } } }); }

function bindEvents() {
  $$('[data-role]').forEach((card) => card.addEventListener('click', () => switchRole(card.dataset.role)));
  $('#switchPortal').addEventListener('click', showPortalSelector);
  $('#patientSelect').addEventListener('change', renderPatientPortal);
  $('#startBtn').addEventListener('click', () => { state.running = true; clearInterval(timerId); timerId = setInterval(tick, 1000); render(); });
  $('#pauseBtn').addEventListener('click', () => { state.running = false; clearInterval(timerId); render(); });
  $('#stepBtn').addEventListener('click', () => { const patient = createPatient({ id: `P-${state.nextId++}` }); state.queue.push(patient); tick(); showToast(`${patient.name} joined triage with acuity ${patient.acuity}.`); });
  $('#resetBtn').addEventListener('click', () => { clearInterval(timerId); state = createInitialState(); render(); showToast('Simulation reset to baseline conditions.'); });
  $$('.segment').forEach((button) => button.addEventListener('click', () => { $$('.segment').forEach((item) => item.classList.remove('active')); button.classList.add('active'); state.speed = Number(button.dataset.speed); render(); }));
  $('#strategySelect').addEventListener('change', (event) => { state.strategy = event.target.value; render(); showToast(`Prioritization changed to Strategy ${event.target.value.toUpperCase()}.`); });
  $('#customPatientBtn').addEventListener('click', () => { $('#customModal').hidden = false; }); $('#datasetBtn').addEventListener('click', loadDataset); $('#customForm').addEventListener('submit', addCustomPatient);
  $('#surgeBtn').addEventListener('click', () => { for (let i = 0; i < 8; i += 1) state.queue.push(createPatient({ id: `SURGE-${state.nextId++}`, acuity: i < 3 ? 5 : 4, bedType: i < 3 ? 'ICU' : 'Emergency' })); render(); showToast('Ambulance surge simulated: 8 emergency cases added.'); });
  $('#shortageBtn').addEventListener('click', () => { state.doctors = Math.max(2, state.doctors - 4); render(); showToast('Staff shortage active: 4 doctors unavailable.'); });
  $('#outageBtn').addEventListener('click', () => { state.icuOutage = Math.min(3, state.icuOutage + 3); render(); showToast('ICU equipment outage active: 3 beds offline.'); });
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals)); $$('.modal-backdrop').forEach((backdrop) => backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModals(); }));
}

state = createInitialState();
initChart();
bindEvents();
showPortalSelector();
render();
