// Firebase Realtime Configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8XNNaxmNlGrFAXyHr3VG9pdVYDkibXPs",
  authDomain: "medflow-c2fb6.firebaseapp.com",
  databaseURL: "https://medflow-c2fb6-default-rtdb.firebaseio.com",
  projectId: "medflow-c2fb6",
  storageBucket: "medflow-c2fb6.firebasestorage.app",
  messagingSenderId: "782221373607",
  appId: "1:782221373607:web:97d10265c150b60d5fab82"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const rtdb = firebase.database();
const stateRef = rtdb.ref('medflow_live_state');
const WARDS = {
  ICU: { label: 'Intensive Care Unit', short: 'ICU', count: 8 },
  Emergency: { label: 'Emergency Ward', short: 'Emergency', count: 17 },
  General: { label: 'General Ward', short: 'General', count: 25 }
};

const PATIENT_NAMES = ['Ayush', 'Ketan', 'Marcus', 'Shreyansh', 'Sidhanth'];
const RESTORED_PATIENTS = [
  { id: 'P-HIST-AYUSH', name: 'Ayush', age: 20, concern: 'Diarrhea', phone: 'sdfg', emergencyContact: 'wedfg', address: 'edrfgh', insurance: 'sdfgh', doctor: 'Dr. David Kim', acuity: 3, bedType: 'General', wait: 9 },
  { id: 'P-HIST-KETAN', name: 'Ketan', age: 21, concern: 'Fever', phone: 'dsfdgf', emergencyContact: 'fdgfh', address: 'x', insurance: 'fdgf', doctor: 'Dr. David Kim', acuity: 1, bedType: 'General', wait: 13 },
  { id: 'P-HIST-MARCUS', name: 'Marcus', age: 19, concern: 'Chest Pain', phone: 'dfg', emergencyContact: 'dcfvb', address: 'dfg', insurance: 'cvbn', doctor: 'Dr. Marcus Vance', acuity: 3, bedType: 'General', wait: 8 },
  { id: 'P-HIST-SHREYANSH', name: 'Shreyansh', age: 20, concern: 'Joint pain', phone: 'dfg', emergencyContact: 'sdfg', address: 'dfg', insurance: 'dfg', doctor: 'Dr. Elena Gomez', acuity: 3, bedType: 'General', wait: 9 },
  { id: 'P-HIST-SIDHANTH', name: 'Sidhanth', age: 21, concern: 'Sprained ankle', phone: 'werfg', emergencyContact: 'ertg', address: 'erfgh', insurance: 'dfgh', doctor: 'Dr. Ananya Patel', acuity: 5, bedType: 'ICU', wait: 6 }
];
const STAFF_NAMES = ['Alex Morgan', 'Taylor Brooks', 'Riley Carter', 'Jordan Hayes', 'Casey Bennett', 'Morgan Ellis', 'Jamie Foster', 'Avery Collins', 'Cameron Reed', 'Drew Parker', 'Skyler Hayes', 'Quinn Sullivan', 'Peyton Ross', 'Reese Turner', 'Emerson Bailey', 'Finley Cooper', 'Harper Mitchell', 'Rowan Kelly'];
const DOCTOR_ROSTER = [
  { name: 'Dr. Sarah Rao', specialty: 'Emergency & Critical Care' },
  { name: 'Dr. Marcus Vance', specialty: 'Trauma Surgery' },
  { name: 'Dr. Ananya Patel', specialty: 'General Medicine' },
  { name: 'Dr. David Kim', specialty: 'Cardiology / ICU' },
  { name: 'Dr. Elena Gomez', specialty: 'Pediatrics / Observation' }
];
const DOCTORS = DOCTOR_ROSTER.map((doctor) => doctor.name);
const CRITICAL_RESERVE_DOCTOR = 'Dr. Critical Response';
const STORAGE_KEY = 'medflow_patients_data_manual_reset_v4';
const SYNC_API = '/api';
const DEFAULT_AMBULANCES = [
  { id: 'AMB-01', status: 'En route', eta: '4 min', district: 'North sector' },
  { id: 'AMB-02', status: 'Available', eta: 'Ready', district: 'City center' },
  { id: 'AMB-03', status: 'Transporting', eta: '12 min', district: 'East corridor' },
  { id: 'AMB-04', status: 'At base', eta: 'Ready', district: 'West hub' },
  { id: 'AMB-05', status: 'En route', eta: '7 min', district: 'South sector' }
];
let state;
let telemetryChart;
let toastTimer;
let activeRole = null;
let selectedDoctorName = DOCTOR_ROSTER[0].name;
let pendingRole = null;
let patientEntryMode = 'existing';
let selectedPatientName = '';
let captchaValue = '';
let syncReady = false;
let syncLeader = false;
let syncToken = '';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function createPatient(overrides = {}) {
  const acuity = overrides.acuity || randomInt(1, 5);
  return {
    id: overrides.id || `P-${String(Math.floor(Math.random() * 900) + 100)}`,
    name: overrides.name || PATIENT_NAMES[Math.floor(Math.random() * PATIENT_NAMES.length)],
    age: overrides.age || randomInt(19, 86),
    concern: overrides.concern || 'General care need',
    phone: overrides.phone || '',
    patientPassword: overrides.patientPassword || '',
    bloodGroup: overrides.bloodGroup || 'Unknown',
    emergencyContact: overrides.emergencyContact || '',
    address: overrides.address || '',
    insurance: overrides.insurance || '',
    doctor: overrides.doctor || '',
    acuity,
    bedType: overrides.bedType || (acuity >= 5 ? 'ICU' : acuity >= 4 ? 'Emergency' : 'General'),
    wait: overrides.wait || 0,
    temporary: Boolean(overrides.temporary),
    arrival: state ? state.elapsed : 0
  };
}

const PATIENT_DIRECTORY = PATIENT_NAMES.map((name, index) => ({
  id: `P-DIR-${String(index + 1).padStart(2, '0')}`,
  name,
  age: 22 + ((index * 7) % 61),
  concern: ['Routine observation', 'Respiratory care', 'Post-operative review', 'Chest discomfort', 'Mobility support'][index % 5],
  status: ['In care', 'Waiting', 'Monitoring', 'Discharged'][index % 4],
  bed: index % 4 === 1 ? 'Queue' : `${['ICU', 'Emergency', 'General'][index % 3]}-${String((index % 8) + 1).padStart(2, '0')}`,
  physician: DOCTORS[index % DOCTORS.length],
  treatment: `${18 + ((index * 11) % 67)} min`,
  activity: ['Vitals checked 5 min ago', 'Care plan reviewed today', 'Medication administered 20 min ago', 'Awaiting bed assignment'][index % 4]
}));

function createInitialState() {
  const beds = [];
  Object.entries(WARDS).forEach(([type, ward]) => {
    for (let index = 0; index < ward.count; index += 1) {
      beds.push({ id: `${type}-${String(index + 1).padStart(2, '0')}`, type, index, patient: null });
    }
  });
  return {
    speed: 1,
    strategy: 'c',
    elapsed: 0,
    clockMinutes: 480,
    beds,
    queue: [],
    patientRecords: [],
    doctors: 9,
    nurses: 18,
    icuOutage: 0,
    ambulances: [...DEFAULT_AMBULANCES],
    history: { labels: ['08:00'], waits: [12], utilization: [53] },
    nextId: 600
  };
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function initials(name) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2); }
function formatClock(minutes) { const hour = Math.floor(minutes / 60) % 24; const minute = minutes % 60; return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; }
function remainingMinutes(minutes) { return Math.ceil(Math.max(0, minutes)); }
function getCondition(patient) {
  const acuity = Number(patient?.acuity ?? 1);
  if (acuity >= 5) return { label: 'Critical', className: 'critical', tier: 5 };
  if (acuity >= 3) return { label: 'Urgent', className: 'urgent', tier: 3 };
  return { label: 'Routine', className: 'routine', tier: 1 };
}
function getBadge(patient) { const acuity = Number(patient?.acuity ?? 1); const effectiveAcuity = state.strategy === 'c' && patient.wait >= (acuity <= 2 ? 25 : 45) ? 5 : acuity; return effectiveAcuity >= 5 ? { label: 'Critical', className: 'critical' } : effectiveAcuity >= 3 ? { label: 'Urgent', className: 'urgent' } : { label: 'Routine', className: 'routine' }; }
function getAllActivePatients() {
  return [
    ...state.queue.map((patient) => ({ ...patient, context: 'queue' })),
    ...state.beds.filter((bed) => bed.patient).map((bed) => ({ ...bed.patient, context: 'bed', bedId: bed.id }))
  ];
}
function getAverageWaitTime() {
  const queuedPatients = state.queue.filter((patient) => patient && Number.isFinite(Number(patient.wait)));
  if (!queuedPatients.length) return 0;
  const totalWait = queuedPatients.reduce((sum, patient) => sum + Math.max(0, Number(patient.wait || 0)), 0);
  return Math.round(totalWait / queuedPatients.length);
}
function getEstimatedWait(patient, position = 1) {
  const acuity = Number(patient?.acuity ?? 1);
  if (acuity >= 5) return 0;
  if (acuity >= 3) return 2 + Math.min(Math.max(position - 1, 0), 1);
  return Math.max(5, position * 3);
}
function getPriority(patient) {
  const acuity = Number(patient?.acuity ?? 1);
  const wait = Math.max(0, Number(patient?.wait ?? 0));
  const uploadFactor = patient?.temporary || patient?.source === 'uploaded' ? 18 : 0;
  const conditionBoost = acuity >= 5 ? 150 : acuity >= 4 ? 90 : acuity >= 3 ? 55 : 20;
  const waitingBoost = Math.min(wait * 3.5, 120);
  const deteriorationBoost = wait >= 30 ? 85 : wait >= 15 ? 45 : 0;
  if (state.strategy === 'a') return (1000 - (patient.arrival || 0)) + conditionBoost + uploadFactor;
  if (state.strategy === 'b') return (acuity * 100) + waitingBoost + conditionBoost + uploadFactor;
  return (acuity * 100) + waitingBoost + conditionBoost + deteriorationBoost + uploadFactor;
}
function availableBeds() { return state.beds.filter((bed) => !bed.patient && !isOutageBed(bed)).length; }
function assignedDoctorNames() { return new Set(state.beds.filter((bed) => bed.patient && bed.patient.doctor).map((bed) => bed.patient.doctor)); }
function findAvailableDoctor(patient) {
  const assigned = assignedDoctorNames();
  if (DOCTORS.includes(patient.doctor) && !assigned.has(patient.doctor)) return patient.doctor;
  const availableDoctor = DOCTORS.find((doctor) => !assigned.has(doctor));
  if (availableDoctor) return availableDoctor;
  return Number(patient?.acuity) >= 5 ? CRITICAL_RESERVE_DOCTOR : '';
}
function availableDoctors() { const regularDoctors = DOCTORS.filter((doctor) => !assignedDoctorNames().has(doctor)).length; const criticalWaiting = state.queue.some((patient) => Number(patient.acuity) >= 5); return regularDoctors + (criticalWaiting ? 1 : 0); }
function isOutageBed(bed) { return bed.type === 'ICU' && bed.index >= WARDS.ICU.count - state.icuOutage; }
function sortedQueue() { return [...state.queue].sort((a, b) => getPriority(b) - getPriority(a)); }
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* Storage can be unavailable in restricted browser contexts. */ }
  if (typeof stateRef !== 'undefined') {
  stateRef.set(state);
}
  if (syncReady) fetch(`${SYNC_API}/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, version: state._version || 0 }) }).catch(() => {});
}
function saveStateBeforeClose() { saveState(); }

function applySharedState(sharedState) {
  if (!sharedState || !Array.isArray(sharedState.beds) || !Array.isArray(sharedState.queue)) return;
  if ((sharedState._version || 0) < (state?._version || 0)) return;
  state = normalizeDoctorAssignments(sharedState);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* Local cache is optional. */ }
  if (typeof stateRef !== 'undefined') {
  stateRef.set(state);
}
  render();
}

function connectSharedState() {
  if (typeof stateRef === 'undefined') return;
  stateRef.on('value', (snapshot) => {
    const remoteData = snapshot.val();
    if (remoteData && Array.isArray(remoteData.beds) && Array.isArray(remoteData.queue)) {
      state = restoreHistoricalPatients(normalizeDoctorAssignments({ ...createInitialState(), ...remoteData }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (typeof renderAll === 'function') renderAll();
      else if (typeof updateUI === 'function') updateUI();
    }
  });
}
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const desiredBedCount = Object.values(WARDS).reduce((sum, ward) => sum + ward.count, 0);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.queue) && Array.isArray(parsed.beds)) {
        const freeBeds = parsed.beds.filter((bed) => !bed.patient).length;
        if (parsed.beds.length === desiredBedCount && freeBeds > 0) {
          return restoreHistoricalPatients(normalizeDoctorAssignments(parsed));
        }
      }
    }
    return restoreHistoricalPatients(normalizeDoctorAssignments(createInitialState()));
  } catch (error) {
    return createInitialState();
  }
}
function ensureAmbulanceFleet(currentState) {
  if (!Array.isArray(currentState.ambulances) || currentState.ambulances.length !== DEFAULT_AMBULANCES.length) {
    currentState.ambulances = [...DEFAULT_AMBULANCES];
  }
  return currentState;
}
function normalizeDoctorAssignments(savedState) {
  if (!Array.isArray(savedState.patientRecords)) savedState.patientRecords = [];
  savedState.doctors = Math.max(9, Number(savedState.doctors) || 0);
  const assignDefaultBloodGroup = (patient) => {
    if (patient && !String(patient.bloodGroup || '').trim()) patient.bloodGroup = 'A+';
  };
  savedState.patientRecords.forEach(assignDefaultBloodGroup);
  savedState.queue.forEach(assignDefaultBloodGroup);
  savedState.beds.forEach((bed, index) => {
    assignDefaultBloodGroup(bed.patient);
    if (bed.patient && !DOCTORS.includes(bed.patient.doctor) && bed.patient.doctor !== CRITICAL_RESERVE_DOCTOR) bed.patient.doctor = DOCTORS[index % DOCTORS.length];
  });
  ensureAmbulanceFleet(savedState);
  return savedState;
}
function restoreHistoricalPatients(currentState) {
  const existingNames = new Set([
    ...currentState.patientRecords.map((patient) => patient.name),
    ...currentState.queue.map((patient) => patient.name),
    ...currentState.beds.filter((bed) => bed.patient).map((bed) => bed.patient.name)
  ]);
  RESTORED_PATIENTS.filter((patient) => !existingNames.has(patient.name)).forEach((patient) => {
    const restored = createPatient({ ...patient, bloodGroup: 'A+' });
    currentState.patientRecords.push({ ...restored, physician: restored.doctor, status: 'Waiting', bed: 'Queue', treatment: 'Pending', activity: 'Restored from previous patient admission' });
    currentState.queue.push(restored);
  });
  return currentState;
}
function resetSavedData() { localStorage.removeItem(STORAGE_KEY); state = createInitialState(); saveState(); render(); showToast('Default demo data restored.'); }

function render() {
  renderStats(); renderFleet(); renderFloorPlan(); renderQueue(); renderChart(); renderDoctorPortal(); renderPatientPortal();
  $('#insightText').textContent = state.strategy === 'c' ? 'Current run is protected against patient starvation.' : 'Switch to Strategy C to activate starvation prevention.';
}

function renderFleet() {
  const fleet = $('#ambulanceFleet');
  if (!fleet) return;
  const ambulances = Array.isArray(state.ambulances) && state.ambulances.length ? state.ambulances : DEFAULT_AMBULANCES;
  fleet.innerHTML = ambulances.map((ambulance) => `
    <div class="ambulance-card">
      <div class="ambulance-top">
        <span class="ambulance-id">${ambulance.id}</span>
        <span class="ambulance-status ${ambulance.status === 'Available' || ambulance.status === 'At base' ? 'ready' : 'active'}">${ambulance.status}</span>
      </div>
      <div class="ambulance-meta">${ambulance.district}</div>
      <div class="ambulance-eta">ETA ${ambulance.eta}</div>
    </div>
  `).join('');
}

function renderDoctorPortal() {
  const doctor = DOCTOR_ROSTER.find((item) => item.name === selectedDoctorName) || DOCTOR_ROSTER[0];
  selectedDoctorName = doctor.name;
  $('#doctorHeading').innerHTML = `${doctor.name} <span>— ${doctor.specialty}</span>`;
  $('#doctorGreeting').textContent = `Good morning, Doctor. Here are ${doctor.name}'s active patients and their live care signals.`;
  const assigned = state.beds.filter((bed) => bed.patient && bed.patient.doctor === doctor.name);
  $('#doctorPatientCount').textContent = assigned.length;
  $('#doctorCriticalCount').textContent = assigned.filter((bed) => bed.patient.acuity >= 5).length;
  $('#doctorAvailableCount').textContent = Math.max(0, assigned.length - assigned.filter((bed) => bed.patient.acuity >= 5).length);
  $('#doctorPatientGrid').innerHTML = assigned.length ? assigned.map(({ id, patient }) => `<article class="doctor-card panel"><div class="doctor-card-top"><div class="patient-avatar">${initials(patient.name)}</div><span class="triage-badge ${getBadge(patient).className}">${getBadge(patient).label}</span></div><h3>${patient.name}</h3><p class="doctor-bed">Bed ${id}</p><div class="doctor-vitals"><div><span>Heart rate</span><strong>${patient.heartRate} <small>BPM</small></strong></div><div><span>SpO2</span><strong>${patient.spo2}<small>%</small></strong></div><div><span>Time remaining</span><strong>${remainingMinutes(patient.treatment)} <small>min</small></strong></div></div><label class="note-label">Quick care note<textarea data-note-id="${id}" placeholder="Add a note for the care team...">${patient.note || ''}</textarea></label><button class="button button-primary wide" data-discharge-id="${id}">Complete Treatment / Discharge</button></article>`).join('') : '<div class="empty-role panel"><strong>No active patients assigned currently.</strong><p>Monitoring floor intake.</p></div>';
  $$('#doctorPatientGrid [data-discharge-id]').forEach((button) => button.addEventListener('click', () => dischargePatient(button.dataset.dischargeId)));
  $$('#doctorPatientGrid [data-note-id]').forEach((textarea) => textarea.addEventListener('input', (event) => { const bed = state.beds.find((item) => item.id === event.target.dataset.noteId); if (bed && bed.patient) { bed.patient.note = event.target.value; saveState(); } }));
}

function renderPatientPortal() {
  const isNewAdmission = patientEntryMode === 'new';
  $('#patientPrivateLabel').hidden = isNewAdmission;
  $('#patientSignupPanel').hidden = !isNewAdmission;
  $('#patientSelector').hidden = true;
  $('#patientStatusCard').hidden = false;
  $('#patientDirectorySection').hidden = true;
  $('#patientPortalLabel').textContent = isNewAdmission ? 'New patient admission' : 'Existing patient access';
  $('#patientPortalHeading').textContent = isNewAdmission ? 'Begin your hospital entry.' : 'Your care, clearly explained.';
  $('#patientPortalDescription').textContent = isNewAdmission ? 'Provide the basic details the hospital team needs to begin your admission.' : 'Follow your place in the live hospital queue with simple, up-to-date information.';
  if (isNewAdmission) { $('#patientSelect').innerHTML = ''; $('#patientStatusCard').innerHTML = ''; $('#patientDirectory').innerHTML = ''; return; }
  const patients = [...sortedQueue().map((patient) => ({ ...patient, source: 'queue' })), ...state.beds.filter((bed) => bed.patient).map((bed) => ({ ...bed.patient, bedId: bed.id, source: 'bed' }))].filter((patient) => patient.name === selectedPatientName);
  const select = $('#patientSelect'); const selected = select.value || patients[0]?.id;
  select.innerHTML = patients.length ? patients.map((patient) => { const queueIndex = sortedQueue().findIndex((queuedPatient) => queuedPatient.id === patient.id); return `<option value="${patient.id}">${patient.name} (${patient.source === 'queue' ? `Position #${String(queueIndex + 1).padStart(2, '0')}` : patient.bedId})</option>`; }).join('') : '<option>No active patients</option>';
  if (patients.some((patient) => patient.id === selected)) select.value = selected;
  const patient = patients.find((item) => item.id === select.value) || patients[0];
  if (!patient) { $('#patientStatusCard').innerHTML = '<div class="patient-empty">No active patient records yet.</div>'; return; }
  const waiting = patient.source === 'queue'; const position = waiting ? sortedQueue().findIndex((item) => item.id === patient.id) + 1 : 'Admitted';
  const estimatedWait = waiting ? (patient.estimatedWait ?? getEstimatedWait(patient, position)) : 0;
  $('#patientStatusCard').innerHTML = `<div class="status-card-header"><div class="patient-avatar">${initials(patient.name)}</div><div><p class="eyebrow teal-text">Saved patient details</p><h3>${patient.name}</h3><span>Patient ID ${patient.id}</span></div><span class="status-pill ${waiting ? 'waiting' : 'receiving'}">${waiting ? 'Waiting' : 'In care'}</span></div><div class="admission-bar ${waiting ? 'not-admitted' : 'admitted'}"><span class="admission-dot"></span><strong>${waiting ? 'Not admitted' : 'Admitted'}</strong>${waiting ? '<span>Waiting for bed assignment</span>' : `<span>Assigned to ${patient.bedId}</span>`}</div><div class="patient-status-main"><div class="status-message"><span class="status-icon">${waiting ? '◷' : '✓'}</span><div><strong>${waiting ? 'Admission request received' : `Currently Receiving Care in ${patient.bedId}`}</strong><p>${waiting ? 'Your details are saved. Our team is preparing the right care space for you.' : 'Your care team is actively monitoring your treatment.'}</p></div></div><div class="patient-metrics"><div><span>Contact</span><strong class="patient-detail-value">${patient.phone || 'Not provided'}</strong></div><div><span>Blood group</span><strong>${patient.bloodGroup || 'Unknown'}</strong></div><div><span>Preferred physician</span><strong class="physician-name">${patient.doctor || 'Assigning now'}</strong></div><div><span>Problem / symptoms</span><strong class="patient-detail-value">${patient.concern}</strong></div><div><span>Home address</span><strong class="patient-detail-value">${patient.address || 'Not provided'}</strong></div><div><span>${waiting ? 'Estimated wait' : 'Time remaining'}</span><strong>${waiting ? estimatedWait : remainingMinutes(patient.treatment)} <small>min</small></strong></div></div></div>`;
}

function populateAdmissionOptions() {
  const doctorSelect = $('#admissionDoctor');
  if (!doctorSelect) return;
  const selectedDoctor = doctorSelect.value || DOCTORS[0];
  doctorSelect.innerHTML = DOCTOR_ROSTER.map((doctor) => `<option value="${doctor.name}">${doctor.name} · ${doctor.specialty}</option>`).join('');
  doctorSelect.value = DOCTORS.includes(selectedDoctor) ? selectedDoctor : DOCTORS[0];
}

function renderPatientDirectory() {
  const dir = Array.isArray(PATIENT_DIRECTORY) ? PATIENT_DIRECTORY : [];
  const recs = (state && Array.isArray(state.patientRecords)) ? state.patientRecords : [];
  const queue = (state && Array.isArray(state.queue)) ? state.queue : [];
  const beds = (state && Array.isArray(state.beds)) ? state.beds.filter(b => b && b.patient).map(b => b.patient) : [];
  
  const directoryPatients = [...dir, ...recs, ...queue, ...beds].filter((patient, index, self) => 
    patient && patient.name && index === self.findIndex(p => p && p.name === patient.name)
  );

  const container = $('#patientDirectory');
  if (container) {
    container.innerHTML = directoryPatients.map(patient => `
      <article class="patient-directory-card">
        <div class="patient-card-header">
          <strong>${patient.name}</strong>
          <span class="badge">${patient.triageCategory || patient.severity || 'Stable'}</span>
        </div>
      </article>
    `).join('');
  }
}

function getPatientLoginNames() {
  const baseNames = Array.isArray(PATIENT_NAMES) ? PATIENT_NAMES : [];
  const queue = (state && Array.isArray(state.queue)) ? state.queue : [];
  const beds = (state && Array.isArray(state.beds)) ? state.beds.filter(b => b && b.patient).map(b => b.patient) : [];
  const recs = (state && Array.isArray(state.patientRecords)) ? state.patientRecords : [];

  const storedNames = [...queue, ...beds, ...recs].map(p => p && p.name).filter(Boolean);
  return [...new Set([...baseNames, ...storedNames])];
}

function dischargePatient(bedId) { const bed = state.beds.find((item) => item.id === bedId); if (!bed || !bed.patient) return; const name = bed.patient.name; const record = state.patientRecords.find((patient) => patient.id === bed.patient.id); if (record) { record.status = 'Discharged'; record.bed = 'Discharged'; record.physician = bed.patient.doctor || 'Care team'; record.treatment = 'Complete'; record.activity = 'Treatment completed and patient discharged'; } bed.patient = null; saveState(); render(); showToast(`${name} discharged. ${bedId} is now available.`); }

function switchRole(role) { activeRole = role; $('#portalSelector').hidden = true; $('.topbar').hidden = false; $('#signInModal').hidden = true; $('#staffView').hidden = role !== 'staff'; $('#doctorView').hidden = role !== 'doctor'; $('#patientView').hidden = role !== 'patient'; if (role === 'staff' && telemetryChart) telemetryChart.resize(); render(); }
function createCaptcha() { captchaValue = String(Math.floor(1000 + Math.random() * 9000)); $('#captchaCode').textContent = captchaValue; }
function openSignIn(role, entryMode = 'existing') { pendingRole = role; if (role === 'patient') patientEntryMode = entryMode; const patientNameList = role === 'patient' && entryMode === 'new' ? [] : role === 'staff' ? STAFF_NAMES : role === 'doctor' ? DOCTORS : getPatientLoginNames(); $('#signInRoleLabel').textContent = `${role === 'staff' ? 'Hospital operations' : role === 'doctor' ? 'Individual doctor' : entryMode === 'new' ? 'New patient admission' : 'Existing patient'} access`; $('#signInTitle').textContent = role === 'patient' && entryMode === 'new' ? 'Start a new patient admission' : `Sign in to the ${role === 'staff' ? 'staff' : role === 'doctor' ? 'doctor' : 'patient'} portal`; $('#signInForm').reset(); $('#signInError').hidden = true; $('#demoCredentials').textContent = 'Interface preview only · Authentication is not connected.'; $('#doctorNames').innerHTML = patientNameList.map((name) => `<option value="${name}"></option>`).join(''); if (role === 'patient' && entryMode === 'new') $('#signInName').removeAttribute('list'); else $('#signInName').setAttribute('list', 'doctorNames'); $('#signInName').placeholder = role === 'staff' ? 'Select staff name' : role === 'doctor' ? 'Select doctor name' : entryMode === 'new' ? 'Enter new patient name' : 'Select existing patient name'; createCaptcha(); $('#signInModal').hidden = false; $('#signInName').focus(); }
function closeSignIn() { $('#signInModal').hidden = true; pendingRole = null; }
function authenticate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const password = String(new FormData(form).get('password') || '');
  const passwordError = $('#signInPasswordError');
  if (password.length > 10) { passwordError.hidden = false; $('#signInError').textContent = 'Please correct the password before continuing.'; $('#signInError').hidden = false; return; }
  const role = pendingRole; const name = String(new FormData(form).get('name')).trim();
  if (role === 'doctor' && DOCTORS.includes(name)) selectedDoctorName = name;
  if (role === 'patient' && patientEntryMode === 'existing') selectedPatientName = name;
  closeSignIn(); switchRole(role);
}
function openPatientCheckin() { openSignIn('patient', 'existing'); }
function openNewPatientAdmission() { patientEntryMode = 'new'; switchRole('patient'); }
function showPortalSelector() { activeRole = null; closeSignIn(); $('#portalSelector').hidden = false; $('.topbar').hidden = true; $('#staffView').hidden = true; $('#doctorView').hidden = true; $('#patientView').hidden = true; }

function renderStats() {
  const free = availableBeds(); const total = state.beds.length - state.icuOutage; const used = total - free; const utilization = Math.round((used / total) * 100); const averageWait = getAverageWaitTime();
  const activePatients = getAllActivePatients();
  const criticalPatients = activePatients.filter((patient) => getCondition(patient).tier >= 5).length;
  const urgentPatients = activePatients.filter((patient) => getCondition(patient).tier === 3).length;
  $('#bedStat').innerHTML = `${free} <small>/ ${total} free</small>`; $('#bedProgress').style.width = `${Math.max(3, 100 - utilization)}%`; $('#bedFoot').textContent = `${utilization}% capacity utilized`;
  $('#waitStat').innerHTML = `${averageWait} <small>mins</small>`; $('#waitFoot').textContent = averageWait > 30 ? 'Above target · consider surge response' : 'Target under 30 minutes'; $('#waitTrend').textContent = averageWait > 30 ? 'Needs attention' : 'Live';
  $('#doctorStat').innerHTML = `${state.doctors} <small>/ 10</small>`; $('#nurseStat').innerHTML = `${state.nurses} <small>/ 20</small>`; $('#staffFoot').textContent = state.doctors < 8 ? 'Reduced clinical coverage' : 'Full clinical coverage';
  $('#occupiedCount').textContent = used; $('#criticalCount').textContent = criticalPatients + urgentPatients;
}

function renderFloorPlan() {
  $('#floorPlan').innerHTML = Object.entries(WARDS).map(([type, ward]) => `<div class="ward ${type === 'ICU' ? 'icu' : ''}"><div class="ward-header"><strong>${ward.label}</strong><span>${state.beds.filter((bed) => bed.type === type && bed.patient).length} / ${ward.count - (type === 'ICU' ? state.icuOutage : 0)} occupied</span></div><div class="beds">${state.beds.filter((bed) => bed.type === type).map((bed) => { const outage = isOutageBed(bed); const classes = outage ? 'outage' : bed.patient ? bed.patient.acuity >= 5 ? 'critical' : 'occupied' : ''; return `<button class="bed ${classes}" data-bed-id="${bed.id}" ${outage ? 'disabled' : ''} title="${outage ? 'Equipment outage' : bed.patient ? `View ${bed.patient.name}` : 'Available bed'}">${outage ? 'OFF' : bed.patient ? bed.patient.id : bed.id.split('-')[1]}</button>`; }).join('')}</div></div>`).join('');
  $$('.bed:not([disabled])').forEach((button) => button.addEventListener('click', () => { const bed = state.beds.find((item) => item.id === button.dataset.bedId); if (bed.patient) openBedModal(bed); }));
}

function renderQueue() {
  const queue = sortedQueue(); const noBeds = availableBeds() === 0; const noDoctors = availableDoctors() === 0; const overflowMessage = noBeds ? '<div class="queue-alert" role="status"><strong>No beds available</strong><span>All beds are currently occupied. New patients will remain safely in the queue until a bed opens.</span></div>' : noDoctors ? '<div class="queue-alert" role="status"><strong>No doctors available</strong><span>All doctors are currently assigned. Patients will remain safely in the queue until a doctor is free.</span></div>' : ''; $('#queueCount').textContent = `${state.queue.length} waiting`; $('#queueList').innerHTML = overflowMessage + (queue.length ? queue.map((patient, index) => { const badge = getBadge(patient); const condition = getCondition(patient); const position = String(index + 1).padStart(2, '0'); const estimatedWait = patient.estimatedWait ?? getEstimatedWait(patient, index + 1); return `<div class="queue-item"><div class="queue-avatar">${initials(patient.name)}</div><div class="queue-main"><strong>${patient.name}</strong><div class="queue-meta"><span>${patient.id}</span><span>Age ${patient.age}</span><span class="triage-badge ${badge.className}">${badge.label}</span><span>${condition.label} condition</span></div><small class="queue-concern">${patient.concern}</small></div><div class="queue-side"><div class="queue-position"><span>Exact position</span><strong>#${position}</strong></div><div class="admission-bar not-admitted"><span class="admission-dot"></span><strong>Not admitted</strong></div><strong class="queue-score">${Math.round(getPriority(patient))}</strong><span class="queue-wait">${estimatedWait} min estimated wait</span></div></div>`; }).join('') : '<div class="queue-empty"><div><strong>Queue clear</strong><p>No patients waiting for triage.</p></div></div>');
}

function addPatientFromCheckin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const acuity = Number(form.get('urgency'));
  const noBedsAvailable = availableBeds() === 0;
  const name = String(form.get('name')).trim();
  const phone = String(form.get('phone')).trim();
  const patientPassword = String(form.get('patientPassword')).trim();
  if (!/^\d{10}$/.test(phone)) { showToast('Phone number must contain exactly 10 digits.'); return; }
  if (patientPassword.length > 10) { showToast('Password must be 10 characters or fewer.'); return; }
  const doctor = String(form.get('doctor')).trim();
  const patient = createPatient({ id: `P-${state.nextId++}`, name, age: Number(form.get('age')), phone, patientPassword, bloodGroup: String(form.get('bloodGroup')).trim(), emergencyContact: String(form.get('emergencyContact')).trim(), address: String(form.get('address')).trim(), insurance: String(form.get('insurance')).trim(), concern: String(form.get('concern')).trim(), doctor, acuity, wait: 0, estimatedWait: getEstimatedWait({ acuity }, state.queue.length + 1) });
  if (!PATIENT_NAMES.includes(patient.name)) PATIENT_NAMES.push(patient.name);
  state.patientRecords.push({ id: patient.id, name: patient.name, age: patient.age, concern: patient.concern, phone: patient.phone, patientPassword: patient.patientPassword, bloodGroup: patient.bloodGroup, emergencyContact: patient.emergencyContact, address: patient.address, insurance: patient.insurance, status: 'Waiting', bed: 'Queue', physician: patient.doctor, treatment: 'Pending', activity: 'New patient sign-in completed' });
  const directAdmission = acuity >= 5 && !noBedsAvailable && findAvailableDoctor(patient);
  if (directAdmission) admitPatient(patient);
  else state.queue.push(patient);
  selectedPatientName = name;
  saveState();
  event.currentTarget.reset();
  patientEntryMode = 'existing';
  render();
  $('#patientSelect').value = patient.id;
  renderPatientPortal();
  showToast(directAdmission ? `${patient.name} was admitted immediately as a critical case.` : noBedsAvailable ? `No beds are vacant. ${patient.name} was added to the waiting queue.` : `${patient.name} joined the live care queue.`);
}

function renderChart() { if (!telemetryChart) return; telemetryChart.data.labels = state.history.labels; telemetryChart.data.datasets[0].data = state.history.waits; telemetryChart.data.datasets[1].data = state.history.utilization; telemetryChart.update('none'); }

function tick() {
  if (!state) return;
  const increments = state.speed; state.elapsed += increments; state.clockMinutes += increments;
  state.queue.forEach((patient) => { patient.wait += increments; });
  state.beds.forEach((bed) => { if (bed.patient) { bed.patient.treatment -= increments / 60; if (bed.patient.treatment <= 0) bed.patient = null; } });
  admitAvailableCriticalPatients();
  if (state.queue.length && state.elapsed % 3 === 0) admitNextPatient();
  if (state.elapsed % 5 === 0) addTelemetryPoint();
  saveState();
  render();
}

function admitAvailableCriticalPatients() {
  const criticalPatients = sortedQueue().filter((patient) => Number(patient.acuity) >= 5);
  criticalPatients.forEach((patient) => {
    if (findBedFor(patient) && findAvailableDoctor(patient)) admitPatient(patient);
  });
}
function admitPatient(candidate) { const bed = findBedFor(candidate); const doctor = findAvailableDoctor(candidate); if (!bed || !doctor) return false; bed.patient = { ...candidate, doctor, heartRate: candidate.acuity >= 5 ? randomInt(108, 132) : randomInt(70, 105), spo2: candidate.acuity >= 5 ? randomInt(89, 96) : randomInt(95, 100), treatment: randomInt(22, 85) }; const record = state.patientRecords.find((patient) => patient.id === candidate.id); if (record) { record.status = 'In care'; record.bed = bed.id; record.physician = doctor; record.treatment = `${remainingMinutes(bed.patient.treatment)} min`; record.activity = 'Admitted and assigned to a care team'; } state.queue = state.queue.filter((patient) => patient.id !== candidate.id); return true; }
function admitNextPatient() { const ordered = sortedQueue(); const admission = ordered.find((patient) => findBedFor(patient) && findAvailableDoctor(patient)); if (!admission) return; admitPatient(admission); saveState(); }
function findBedFor(patient) { const preferred = state.beds.find((bed) => bed.type === patient.bedType && !bed.patient && !isOutageBed(bed)); return preferred || state.beds.find((bed) => bed.type !== 'ICU' && !bed.patient && !isOutageBed(bed)); }
function addTelemetryPoint() { const free = availableBeds(); const total = state.beds.length - state.icuOutage; state.history.labels.push(formatClock(state.clockMinutes)); state.history.waits.push(Math.round(state.queue.reduce((sum, patient) => sum + patient.wait, 0) / Math.max(state.queue.length, 1))); state.history.utilization.push(Math.round(((total - free) / total) * 100)); if (state.history.labels.length > 12) { Object.values(state.history).forEach((values) => values.shift()); } }

function openBedModal(bed) { const patient = bed.patient; $('#modalBedLabel').textContent = `BED ${bed.id.toUpperCase()}`; $('#modalPatientName').textContent = patient.name; $('#modalPatientMeta').textContent = `Age ${patient.age} · ${getBadge(patient).label} care`; $('#modalAvatar').textContent = initials(patient.name); $('#modalBadge').textContent = getBadge(patient).label; $('#modalBadge').className = `triage-badge ${getBadge(patient).className}`; $('#modalHeartRate').innerHTML = `${patient.heartRate} <small>BPM</small>`; $('#modalSpo2').innerHTML = `${patient.spo2}<small>% SpO2</small>`; $('#modalDoctor').textContent = patient.doctor; $('#modalTreatment').innerHTML = `${remainingMinutes(patient.treatment)} <small>min</small>`; $('#bedModal').hidden = false; }
function closeModals() { $$('.modal-backdrop').forEach((modal) => { modal.hidden = true; }); }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); }

function initScene() {
  if (!window.THREE) return;
  const canvas = $('#sceneCanvas');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    canvas.hidden = true;
    return;
  }
  const core = new THREE.Group();
  const rings = [];
  const nodes = [];
  const blue = new THREE.Color('#2B7BB9');
  const red = new THREE.Color('#B0122B');
  const teal = new THREE.Color('#12807C');
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  camera.position.set(0, 0, 8.5);
  scene.add(core);
  core.position.set(2.1, 0.1, 0);
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), new THREE.MeshBasicMaterial({ color: blue, wireframe: true, transparent: true, opacity: .3 })));
  [1.35, 1.7, 2.05].forEach((radius, index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .012 + index * .006, 6, 72), new THREE.MeshBasicMaterial({ color: index === 1 ? teal : blue, transparent: true, opacity: .55 - index * .1 }));
    ring.rotation.set(index * .65, index * .42, index * .25);
    core.add(ring);
    rings.push(ring);
  });
  const particlePositions = new Float32Array(42 * 3);
  for (let index = 0; index < 42; index += 1) {
    const radius = 1.3 + Math.random() * .95;
    const angle = Math.random() * Math.PI * 2;
    particlePositions[index * 3] = Math.cos(angle) * radius;
    particlePositions[index * 3 + 1] = (Math.random() - .5) * 2.5;
    particlePositions[index * 3 + 2] = Math.sin(angle) * radius;
    const node = new THREE.Mesh(new THREE.SphereGeometry(.035 + Math.random() * .025, 6, 6), new THREE.MeshBasicMaterial({ color: index % 7 === 0 ? red : teal, transparent: true, opacity: .85 }));
    node.position.set(particlePositions[index * 3], particlePositions[index * 3 + 1], particlePositions[index * 3 + 2]);
    core.add(node);
    nodes.push(node);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height, false);
  }

  function handlePointer(event) {
    pointer.targetX = (event.clientX / window.innerWidth - .5) * .45;
    pointer.targetY = (event.clientY / window.innerHeight - .5) * .3;
  }

  function animate(time) {
    const seconds = time * .001;
    const scrollProgress = Math.min(window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1), 1);
    const pulse = (Math.sin(seconds * 2.4) + 1) / 2;
    const pulseColor = blue.clone().lerp(red, Math.pow(pulse, 7));
    pointer.x += (pointer.targetX - pointer.x) * .04;
    pointer.y += (pointer.targetY - pointer.y) * .04;
    core.rotation.y += reducedMotion ? 0 : .0018;
    core.rotation.x += reducedMotion ? 0 : .0007;
    core.rotation.y += scrollProgress * .001;
    core.rotation.x += pointer.y * .002;
    core.rotation.z = pointer.x * .08;
    core.scale.setScalar(1 + pulse * .045);
    core.position.y = .1 - scrollProgress * .5 + pointer.y * .35;
    camera.position.x += ((2.1 - scrollProgress * .8 + pointer.x) - camera.position.x) * .025;
    camera.position.y += ((scrollProgress * .35 - pointer.y) - camera.position.y) * .025;
    rings.forEach((ring, index) => { ring.rotation.z += (index + 1) * .0015; ring.material.color.copy(index === 1 ? teal : pulse > .92 ? pulseColor : blue); });
    nodes.forEach((node, index) => { node.position.y += Math.sin(seconds * 1.2 + index) * .0006; node.material.color.copy(index % 7 === 0 && pulse > .7 ? pulseColor : teal); });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', handlePointer, { passive: true });
  requestAnimationFrame(animate);
}

function initChart() {
  const ctx = $('#telemetryChart');
  if (!ctx || !window.Chart) return;
  telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: state.history.labels,
      datasets: [
        { label: 'Average wait time', data: state.history.waits, borderColor: '#2B7BB9', backgroundColor: 'rgba(43,123,185,.08)', tension: .4, fill: true, pointRadius: 2, pointBackgroundColor: '#2B7BB9' },
        { label: 'Bed utilization %', data: state.history.utilization, borderColor: '#12807C', backgroundColor: 'transparent', tension: .4, pointRadius: 2, pointBackgroundColor: '#12807C' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#14324F', padding: 10, titleFont: { family: 'DM Sans' }, bodyFont: { family: 'DM Sans' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#718397', font: { size: 10 } } },
        y: { beginAtZero: true, suggestedMax: 100, grid: { color: '#edf1f3' }, ticks: { color: '#718397', font: { size: 10 } } }
      }
    }
  });
}

function bindEvents() {
  $$('[data-role]').forEach((card) => {
    card.addEventListener('click', () => {
      const mode = card.dataset.entryMode === 'new' ? 'new' : 'existing';
      if (card.dataset.role === 'patient' && mode === 'new') openNewPatientAdmission();
      else openSignIn(card.dataset.role, mode);
    });
  });

  $('#landingCheckinBtn')?.addEventListener('click', openPatientCheckin);
  $('#patientCheckinBtn')?.addEventListener('click', openPatientCheckin);
  $('#switchPortal')?.addEventListener('click', showPortalSelector);
  $('#patientSelect')?.addEventListener('change', renderPatientPortal);
  $('#patientCheckinForm')?.addEventListener('submit', addPatientFromCheckin);
  $('#signInForm')?.addEventListener('submit', authenticate);
  $('#closeSignIn')?.addEventListener('click', closeSignIn);
  $('#patientCheckinForm')?.querySelector('[name="phone"]')?.addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 10); });
  $('#patientCheckinForm')?.querySelector('[name="patientPassword"]')?.addEventListener('input', (event) => { event.target.value = event.target.value.slice(0, 10); });
  $('#signInPassword')?.addEventListener('input', (event) => { event.target.value = event.target.value.slice(0, 10); $('#signInPasswordError').hidden = true; });
  $('#signInModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'signInModal') closeSignIn();
  });
}

state = loadState();
admitAvailableCriticalPatients();
initChart();
bindEvents();
initScene();
showPortalSelector();
populateAdmissionOptions();
render();
window.addEventListener('beforeunload', saveStateBeforeClose);
setInterval(tick, 1000);
connectSharedState();