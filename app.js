const $ = (id) => document.getElementById(id);
const screens = ['attract', 'home', 'gallery', 'capture', 'player'];
const screenBackgrounds = {
  attract: '001.jpg', home: '002.jpg', gallery: '008.jpg', capture: '010.jpg', player: '009.jpg',
};
const MAIN_VIDEO_START_KEY = 'maca.mainVideoStartedAt.v1';
function loadMainVideoStartTime() {
  try {
    const saved = Number(localStorage.getItem(MAIN_VIDEO_START_KEY));
    if (Number.isFinite(saved) && saved > 0) return saved;
    const initial = Date.now();
    localStorage.setItem(MAIN_VIDEO_START_KEY, String(initial));
    return initial;
  } catch (error) {
    return Date.now();
  }
}
let mainVideoStartedAt = loadMainVideoStartTime();
const clips = [
  ['1.mp4', '✿', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'],
  ['2.mp4', '◉', 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'],
];
const galleryGrid = $('galleryGrid');
let active = 'attract', idleTimeout, playerCloseTimeout, attractTransitionTimeout, attractFadeTimeout;
let stream = null, recorder = null, chunks = [], recordingStarted = 0, recordTicker;
let outputDirectory = null, toastTimeout, cameraLoadingInterval, cameraRequestId = 0;

clips.forEach(([filename, symbol, description], index) => {
  const card = document.createElement('button');
  card.className = 'film-card';
  card.innerHTML = `<span class="film-art" style="--art:${['#d0a958','#a5aa70','#aa795d','#a89c6a','#ca8060','#7da09a'][index]}"><span class="film-symbol">${symbol}</span></span><span class="film-meta"><img class="small-play-icon" src="assets/ui/play.png" alt=""></span><span class="film-description">${description}</span>`;
  card.querySelector('.film-art').style.backgroundImage = `linear-gradient(#1114,#1118),url('assets/backgrounds/web/${String(index + 2).padStart(3, '0')}.jpg')`;
  card.addEventListener('click', () => playClip(filename));
  galleryGrid.append(card);
});

function showScreen(name) {
  clearTimeout(playerCloseTimeout);
  clearTimeout(attractTransitionTimeout);
  clearTimeout(attractFadeTimeout);
  $('attract').classList.remove('leaving');
  $('home').classList.remove('home-transition-in', 'home-transition-visible');
  screens.forEach((id) => $(id).classList.toggle('hidden', id !== name));
  $('player').classList.remove('close-visible');
  active = name;
  $('app').classList.toggle('attract-mode', name === 'attract');
  $('wallpaper').style.backgroundImage = `url('assets/backgrounds/web/${screenBackgrounds[name]}')`;
  if (name !== 'capture' && recorder?.state === 'recording') stopRecording();
  if (name === 'capture') startCamera();
  if (name !== 'capture') stopCamera();
  if (name === 'player') $('filmPlayer').play().catch(() => {});
  else { $('filmPlayer').pause(); $('filmPlayer').removeAttribute('src'); $('filmPlayer').load(); }
  armIdleTimer();
}
function enter() { showScreen('home'); }
function scheduleAttractTransition() {
  if (active !== 'attract' || attractTransitionTimeout) return;
  attractTransitionTimeout = setTimeout(() => {
    attractTransitionTimeout = null;
    if (active !== 'attract') return;
    const attract = $('attract');
    const home = $('home');
    active = 'home';
    $('app').classList.remove('attract-mode');
    $('wallpaper').style.backgroundImage = `url('assets/backgrounds/web/${screenBackgrounds.home}')`;
    home.classList.remove('hidden');
    home.classList.add('home-transition-in');
    attract.classList.add('leaving');
    requestAnimationFrame(() => home.classList.add('home-transition-visible'));
    armIdleTimer();
    attractFadeTimeout = setTimeout(() => {
      attract.classList.add('hidden');
      attract.classList.remove('leaving');
      home.classList.remove('home-transition-in', 'home-transition-visible');
      attractFadeTimeout = null;
    }, 900);
  }, 1000);
}
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove('show'), 3400);
}
function armIdleTimer() {
  clearTimeout(idleTimeout);
  if (active === 'attract') return;
  idleTimeout = setTimeout(() => {
    if (active === 'capture' && recorder?.state === 'recording') stopRecording();
    showScreen('attract');
  }, 5 * 60 * 1000);
}
function noteActivity(event) {
  if (active === 'attract') {
    if (event?.type === 'pointermove') { scheduleAttractTransition(); return; }
    enter(); return;
  }
  armIdleTimer();
}
async function startCamera() {
  if (stream) return;
  const requestId = ++cameraRequestId;
  const loadingStartedAt = Date.now();
  const loadingMessages = ['PREPARANDO CÁMARA', 'BUSCANDO MICROSCOPIO', 'AJUSTANDO SEÑAL', 'ESPERANDO IMAGEN'];
  let messageIndex = 0;
  const placeholder = $('cameraPlaceholder');
  const status = placeholder.querySelector('p');
  const detail = placeholder.querySelector('small');
  placeholder.classList.add('loading');
  status.textContent = loadingMessages[messageIndex];
  detail.textContent = 'Conectando microscopio';
  clearInterval(cameraLoadingInterval);
  cameraLoadingInterval = setInterval(() => {
    messageIndex = (messageIndex + 1) % loadingMessages.length;
    status.textContent = loadingMessages[messageIndex];
  }, 800);
  if (!navigator.mediaDevices?.getUserMedia) {
    clearInterval(cameraLoadingInterval);
    placeholder.classList.remove('loading', 'hidden');
    status.textContent = 'SE NECESITA HTTPS';
    detail.textContent = 'Abre el sitio con HTTPS o localhost para usar la cámara';
    return;
  }
  try {
    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (requestId !== cameraRequestId || active !== 'capture') {
      cameraStream.getTracks().forEach((track) => track.stop());
      return;
    }
    const camera = $('camera');
    const metadataReady = new Promise((resolve) => camera.addEventListener('loadedmetadata', resolve, { once: true }));
    camera.srcObject = cameraStream;
    await Promise.race([metadataReady, new Promise((resolve) => setTimeout(resolve, 2500))]);
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 4400 - (Date.now() - loadingStartedAt))));
    if (requestId !== cameraRequestId || active !== 'capture') {
      cameraStream.getTracks().forEach((track) => track.stop());
      camera.srcObject = null;
      return;
    }
    if (camera.videoWidth && camera.videoHeight) {
      const frame = document.querySelector('.camera-frame');
      frame.style.setProperty('--camera-ratio', camera.videoWidth / camera.videoHeight);
      frame.style.setProperty('--camera-aspect', `${camera.videoWidth} / ${camera.videoHeight}`);
    }
    stream = cameraStream;
    clearInterval(cameraLoadingInterval);
    placeholder.classList.remove('loading');
    placeholder.classList.add('hidden');
  } catch (error) {
    if (requestId !== cameraRequestId) return;
    clearInterval(cameraLoadingInterval);
    placeholder.classList.remove('loading', 'hidden');
    status.textContent = error.name === 'NotAllowedError' ? 'PERMITE EL ACCESO A LA CÁMARA' : 'NO SE ENCONTRÓ EL MICROSCOPIO';
    detail.textContent = 'Conecta el microscopio USB y permite el acceso a la cámara';
  }
}
function stopCamera() {
  cameraRequestId += 1;
  clearInterval(cameraLoadingInterval);
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null; $('camera').srcObject = null;
  $('cameraPlaceholder').classList.add('loading');
  $('cameraPlaceholder').classList.remove('hidden');
  $('cameraPlaceholder').querySelector('p').textContent = 'PREPARANDO CÁMARA';
  $('cameraPlaceholder').querySelector('small').textContent = 'Conectando microscopio';
}
function getRecordingType() {
  if (!window.MediaRecorder) return '';
  return ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}
function extensionFor(type) { return type.includes('mp4') ? 'mp4' : 'webm'; }
function timestamp() { return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', ''); }

async function chooseSaveLocation() {
  if (outputDirectory) return true;
  if (window.showDirectoryPicker && window.isSecureContext) {
    try {
      outputDirectory = await window.showDirectoryPicker({ mode: 'readwrite' });
      showToast('Los archivos se guardarán en la carpeta seleccionada');
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
    }
  }
  return true;
}
async function saveBlob(blob, name) {
  if (outputDirectory) {
    try {
      const handle = await outputDirectory.getFileHandle(name, { create: true });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
      showToast('¡Guardado!'); return;
    } catch (error) {
      showToast('Se descargará el archivo en este dispositivo.');
    }
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  showToast('¡Guardado!');
}
async function beginRecording() {
  if (!stream) { showToast('Conecta el microscopio y permite el acceso a la cámara'); return; }
  if (!window.MediaRecorder) { showToast('Este navegador no permite grabar video'); return; }
  if (!await chooseSaveLocation()) return;
  const type = getRecordingType();
  try {
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
      saveBlob(blob, `microscope-video-${timestamp()}.${extensionFor(blob.type)}`);
      chunks = [];
    };
    recorder.start(1000); recordingStarted = Date.now(); $('recordButton').classList.add('recording'); $('recordIcon').src = 'assets/ui/stop.png';
    $('recordLabel').textContent = 'DETENER'; $('recordIndicator').classList.remove('hidden');
    recordTicker = setInterval(updateRecordTimer, 250); updateRecordTimer();
    setTimeout(() => { if (recorder?.state === 'recording') { stopRecording(); showToast('Se alcanzó el límite de dos minutos'); } }, 120000);
  } catch (error) { showToast('No se pudo iniciar la grabación'); }
}
function updateRecordTimer() {
  const sec = Math.min(120, Math.floor((Date.now() - recordingStarted) / 1000));
  $('timer').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
function stopRecording() {
  if (recorder?.state !== 'recording') return;
  recorder.stop(); clearInterval(recordTicker); $('recordButton').classList.remove('recording'); $('recordIcon').src = 'assets/ui/record.png';
  $('recordLabel').textContent = 'VIDEO'; $('recordIndicator').classList.add('hidden');
}
async function takePhoto() {
  if (!stream || !$('camera').videoWidth) { showToast('Espera a que aparezca la imagen del microscopio'); return; }
  if (!await chooseSaveLocation()) return;
  const video = $('camera'), canvas = $('photoCanvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const context = canvas.getContext('2d'); context.drawImage(video, 0, 0);
  canvas.toBlob((blob) => { if (blob) saveBlob(blob, `microscope-photo-${timestamp()}.jpg`); }, 'image/jpeg', .94);
}
function playClip(filename) {
  $('filmPlayer').src = `src/${filename}`;
  showScreen('player');
  $('filmPlayer').play().catch(() => showToast('No se pudo reproducir el video'));
  $('filmPlayer').onerror = () => showToast('No se pudo reproducir el video');
}

function syncMainVideo(force = false) {
  const video = document.querySelector('.main-loop');
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
  const targetTime = ((Date.now() - mainVideoStartedAt) / 1000 % video.duration + video.duration) % video.duration;
  if (!force && Math.abs(video.currentTime - targetTime) < 1.5) return;
  try { video.currentTime = targetTime; } catch (error) { /* Metadata may not be seekable yet. */ }
}

function resetMainVideoStart() {
  mainVideoStartedAt = Date.now();
  try { localStorage.setItem(MAIN_VIDEO_START_KEY, String(mainVideoStartedAt)); } catch (error) { /* Keep the current tab in sync if storage is unavailable. */ }
  syncMainVideo(true);
}

function revealPlayerClose() {
  $('player').classList.add('close-visible');
  clearTimeout(playerCloseTimeout);
  playerCloseTimeout = setTimeout(() => $('player').classList.remove('close-visible'), 2200);
}

$('wallpaper').style.backgroundImage = `url('assets/backgrounds/web/${screenBackgrounds.attract}')`;
const mainVideo = document.querySelector('.main-loop');
mainVideo?.addEventListener('loadedmetadata', () => syncMainVideo(true), { once: true });
if (mainVideo?.readyState >= 1) syncMainVideo(true);
$('attract').addEventListener('pointerdown', noteActivity, { passive: true });
$('attract').addEventListener('click', noteActivity, { passive: true });
$('openGallery').addEventListener('click', () => showScreen('gallery'));
$('openCapture').addEventListener('click', () => showScreen('capture'));
document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', () => showScreen('home')));
document.querySelectorAll('[data-gallery]').forEach((button) => button.addEventListener('click', () => showScreen('gallery')));
$('closePlayer').addEventListener('click', () => showScreen('gallery'));
$('player').addEventListener('pointermove', revealPlayerClose, { passive: true });
document.addEventListener('keydown', (event) => {
  if (event.altKey && event.shiftKey && event.code === 'KeyM' && !event.ctrlKey && !event.metaKey && !event.repeat) {
    event.preventDefault();
    resetMainVideoStart();
  }
  if (event.key === 'Escape' && active === 'player') showScreen('gallery');
});
$('recordButton').addEventListener('click', () => recorder?.state === 'recording' ? stopRecording() : beginRecording());
$('photoButton').addEventListener('click', takePhoto);
['pointermove', 'pointerdown', 'click', 'keydown', 'touchstart'].forEach((event) => document.addEventListener(event, noteActivity, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden && recorder?.state === 'recording') stopRecording(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncMainVideo(true); });
window.addEventListener('pageshow', () => syncMainVideo(true));
