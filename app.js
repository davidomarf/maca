const $ = (id) => document.getElementById(id);
const screens = ['attract', 'home', 'gallery', 'capture', 'player'];
const screenBackgrounds = {
  attract: '001.jpg', home: '002.jpg', gallery: '008.jpg', capture: '010.jpg', player: '009.jpg',
};
const clips = [
  ['01', 'VIDEO 01', 'video-01.mp4', '✿', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'],
  ['02', 'VIDEO 02', 'video-02.mp4', '◉', 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'],
  ['03', 'VIDEO 03', 'video-03.mp4', '❋', 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.'],
  ['04', 'VIDEO 04', 'video-04.mp4', '⌘', 'Duis aute irure dolor in reprehenderit in voluptate velit esse.'],
  ['05', 'VIDEO 05', 'video-05.mp4', '✺', 'Excepteur sint occaecat cupidatat non proident, sunt in culpa.'],
  ['06', 'VIDEO 06', 'video-06.mp4', '❂', 'Curabitur blandit tempus porttitor. Nullam quis risus eget urna mollis.'],
];
const galleryGrid = $('galleryGrid');
let active = 'attract', idleTimeout, countdownInterval, lastActivity = Date.now();
let stream = null, recorder = null, chunks = [], recordingStarted = 0, recordTicker;
let outputDirectory = null, toastTimeout;

clips.forEach(([number, title, filename, symbol, description], index) => {
  const card = document.createElement('button');
  card.className = 'film-card';
  card.innerHTML = `<span class="film-art" style="--art:${['#d0a958','#a5aa70','#aa795d','#a89c6a','#ca8060','#7da09a'][index]}"><span class="film-symbol">${symbol}</span></span><span class="film-meta"><span>VIDEO ${number}</span><span>▶</span></span><span class="film-name">${title}</span><span class="film-description">${description}</span>`;
  card.querySelector('.film-art').style.backgroundImage = `linear-gradient(#1114,#1118),url('assets/backgrounds/web/${String(index + 2).padStart(3, '0')}.jpg')`;
  card.addEventListener('click', () => playClip(title, filename));
  galleryGrid.append(card);
});

function showScreen(name) {
  screens.forEach((id) => $(id).classList.toggle('hidden', id !== name));
  active = name;
  $('wallpaper').style.backgroundImage = `url('assets/backgrounds/web/${screenBackgrounds[name]}')`;
  if (name !== 'capture' && recorder?.state === 'recording') stopRecording();
  if (name === 'capture') startCamera();
  if (name !== 'capture') stopCamera();
  if (name === 'player') $('filmPlayer').play().catch(() => {});
  else { $('filmPlayer').pause(); $('filmPlayer').removeAttribute('src'); $('filmPlayer').load(); }
  armIdleTimer();
}
function enter() { showScreen('home'); }
function showToast(message) {
  const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove('show'), 3400);
}
function armIdleTimer() {
  clearTimeout(idleTimeout); clearInterval(countdownInterval);
  $('idleNote').classList.toggle('visible', active !== 'attract');
  if (active === 'attract') return;
  lastActivity = Date.now();
  idleTimeout = setTimeout(() => {
    if (active === 'capture' && recorder?.state === 'recording') stopRecording();
    showScreen('attract');
  }, 5 * 60 * 1000);
  countdownInterval = setInterval(() => {
    const left = Math.max(0, 300 - Math.floor((Date.now() - lastActivity) / 1000));
    $('idleCountdown').textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
  }, 1000);
}
function noteActivity() {
  if (active === 'attract') { enter(); return; }
  armIdleTimer();
}
async function startCamera() {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    $('cameraPlaceholder').classList.remove('hidden');
    $('cameraPlaceholder').querySelector('p').textContent = 'SE NECESITA HTTPS';
    $('cameraPlaceholder').querySelector('small').textContent = 'Abre el sitio con HTTPS o localhost para usar la cámara';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const camera = $('camera');
    camera.onloadedmetadata = () => {
      if (camera.videoWidth && camera.videoHeight) {
        const frame = document.querySelector('.camera-frame');
        frame.style.setProperty('--camera-ratio', camera.videoWidth / camera.videoHeight);
        frame.style.setProperty('--camera-aspect', `${camera.videoWidth} / ${camera.videoHeight}`);
      }
    };
    camera.srcObject = stream; $('cameraPlaceholder').classList.add('hidden');
  } catch (error) {
    $('cameraPlaceholder').classList.remove('hidden');
    $('cameraPlaceholder').querySelector('p').textContent = error.name === 'NotAllowedError' ? 'PERMITE EL ACCESO A LA CÁMARA' : 'NO SE ENCONTRÓ EL MICROSCOPIO';
    $('cameraPlaceholder').querySelector('small').textContent = 'Conecta el microscopio USB y permite el acceso a la cámara';
  }
}
function stopCamera() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null; $('camera').srcObject = null;
  $('cameraPlaceholder').classList.remove('hidden');
  $('cameraPlaceholder').querySelector('p').textContent = 'CONECTANDO MICROSCOPIO';
  $('cameraPlaceholder').querySelector('small').textContent = 'Permite el acceso a la cámara';
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
      $('saveStatus').textContent = 'CARPETA ELEGIDA';
      showToast('Los archivos se guardarán en la carpeta seleccionada');
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
    }
  }
  $('saveStatus').textContent = 'SE DESCARGARÁN AQUÍ';
  return true;
}
async function saveBlob(blob, name) {
  if (outputDirectory) {
    try {
      const handle = await outputDirectory.getFileHandle(name, { create: true });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
      showToast(`Guardado en la carpeta: ${name}`); return;
    } catch (error) {
      showToast('Se descargará el archivo en este dispositivo.');
    }
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  showToast(`Descargado: ${name}`);
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
    recorder.start(1000); recordingStarted = Date.now(); $('recordButton').classList.add('recording');
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
  recorder.stop(); clearInterval(recordTicker); $('recordButton').classList.remove('recording');
  $('recordLabel').textContent = 'VIDEO'; $('recordIndicator').classList.add('hidden');
}
async function takePhoto() {
  if (!stream || !$('camera').videoWidth) { showToast('Espera a que aparezca la imagen del microscopio'); return; }
  if (!await chooseSaveLocation()) return;
  const video = $('camera'), canvas = $('photoCanvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const context = canvas.getContext('2d'); context.drawImage(video, 0, 0);
  canvas.toBlob((blob) => { if (blob) saveBlob(blob, `microscope-photo-${timestamp()}.jpg`); }, 'image/jpeg', .94);
}
function playClip(title, filename) {
  $('filmPlayer').src = `assets/videos/${filename}`;
  $('playerTitle').textContent = title;
  showScreen('player');
  $('filmPlayer').play().catch(() => showToast('Agrega el archivo MP4 correspondiente en assets/videos/'));
  $('filmPlayer').onerror = () => showToast('Agrega el archivo MP4 correspondiente en assets/videos/');
}

$('wallpaper').style.backgroundImage = `url('assets/backgrounds/web/${screenBackgrounds.attract}')`;
$('attract').addEventListener('pointermove', noteActivity, { passive: true });
$('attract').addEventListener('pointerdown', noteActivity, { passive: true });
$('attract').addEventListener('click', noteActivity, { passive: true });
$('openGallery').addEventListener('click', () => showScreen('gallery'));
$('openCapture').addEventListener('click', () => showScreen('capture'));
document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', () => showScreen('home')));
document.querySelectorAll('[data-gallery]').forEach((button) => button.addEventListener('click', () => showScreen('gallery')));
$('recordButton').addEventListener('click', () => recorder?.state === 'recording' ? stopRecording() : beginRecording());
$('photoButton').addEventListener('click', takePhoto);
['pointermove', 'pointerdown', 'click', 'keydown', 'touchstart'].forEach((event) => document.addEventListener(event, noteActivity, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden && recorder?.state === 'recording') stopRecording(); });
