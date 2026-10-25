const preview = document.getElementById('live-preview');
const badge = document.getElementById('rec-state-badge');
const timerEl = document.getElementById('rec-timer');
const countdownEl = document.getElementById('countdown-overlay');

const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnPipCam = document.getElementById('btn-pip-cam');
const btnStop = document.getElementById('btn-stop');
const btnDownload = document.getElementById('btn-download-video');

let mediaRecorder = null;
let recordedChunks = [];
let combinedStream = null;
let displayStream = null;
let micStream = null;
let audioCtx = null;
let recordedBlobUrl = null;

let startTime = 0;
let elapsedBeforePause = 0;
let timerInterval = null;

const params = new URLSearchParams(window.location.search);
const quality = params.get('quality') || '1080p';
const useMic = params.get('mic') !== '0';
const useSysAudio = params.get('sysAudio') !== '0';
const useCountdown = params.get('countdown') !== '0';

btnStart.addEventListener('click', startRecordingFlow);
btnPause.addEventListener('click', togglePause);
btnStop.addEventListener('click', stopRecording);
btnPipCam.addEventListener('click', toggleWebcamPiP);
btnDownload.addEventListener('click', () => {
  if (!recordedBlobUrl) return;
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  chrome.downloads.download({
    url: recordedBlobUrl,
    filename: `c13-shoot-video-${ts}.webm`
  });
});

async function startRecordingFlow() {
  try {
    recordedChunks = [];
    btnDownload.classList.add('hidden');

    const resMap = {
      '4k': { width: 3840, height: 2160, frameRate: 60 },
      '1080p': { width: 1920, height: 1080, frameRate: 60 },
      '720p': { width: 1280, height: 720, frameRate: 30 }
    };
    const q = resMap[quality] || resMap['1080p'];

    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: q.width },
        height: { ideal: q.height },
        frameRate: { ideal: q.frameRate }
      },
      audio: useSysAudio
    });

    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    let hasAudio = false;

    if (displayStream.getAudioTracks().length > 0) {
      const sysSource = audioCtx.createMediaStreamSource(new MediaStream([displayStream.getAudioTracks()[0]]));
      sysSource.connect(dest);
      hasAudio = true;
    }

    if (useMic) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (micStream.getAudioTracks().length > 0) {
          const micSource = audioCtx.createMediaStreamSource(micStream);
          micSource.connect(dest);
          hasAudio = true;
        }
      } catch (e) {
        console.warn('Micrófono no disponible o denegado:', e);
      }
    }

    const tracks = [...displayStream.getVideoTracks()];
    if (hasAudio && dest.stream.getAudioTracks().length > 0) {
      tracks.push(...dest.stream.getAudioTracks());
    }

    combinedStream = new MediaStream(tracks);
    preview.srcObject = displayStream;
    preview.controls = false;
    preview.muted = true;

    displayStream.getVideoTracks()[0].onended = () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        stopRecording();
      }
    };

    if (useCountdown) {
      countdownEl.classList.remove('hidden');
      for (let i = 3; i > 0; i--) {
        countdownEl.textContent = String(i);
        await new Promise((r) => setTimeout(r, 950));
      }
      countdownEl.classList.add('hidden');
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: quality === '4k' ? 16000000 : 8000000
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = onRecordingFinished;
    mediaRecorder.start(500);

    badge.textContent = 'GRABANDO EN VIVO';
    badge.classList.add('recording');
    btnStart.disabled = true;
    btnPause.disabled = false;
    btnStop.disabled = false;

    elapsedBeforePause = 0;
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 250);
  } catch (err) {
    console.error('Grabación cancelada o error:', err);
  }
}

function togglePause() {
  if (!mediaRecorder) return;
  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    elapsedBeforePause += Date.now() - startTime;
    clearInterval(timerInterval);
    badge.textContent = 'EN PAUSA';
    btnPause.textContent = '▶️ Reanudar';
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 250);
    badge.textContent = 'GRABANDO EN VIVO';
    btnPause.textContent = '⏸️ Pausar';
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  clearInterval(timerInterval);
  displayStream?.getTracks().forEach((t) => t.stop());
  micStream?.getTracks().forEach((t) => t.stop());
  audioCtx?.close();

  badge.textContent = 'GRABACIÓN COMPLETADA';
  badge.classList.remove('recording');
  btnStart.disabled = false;
  btnPause.disabled = true;
  btnStop.disabled = true;
}

function onRecordingFinished() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  recordedBlobUrl = URL.createObjectURL(blob);
  preview.srcObject = null;
  preview.src = recordedBlobUrl;
  preview.controls = true;
  preview.muted = false;
  preview.play();

  btnDownload.classList.remove('hidden');
}

async function toggleWebcamPiP() {
  const pipVideo = document.getElementById('webcam-pip');
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      pipVideo.srcObject?.getTracks().forEach((t) => t.stop());
      btnPipCam.textContent = '📷 Activar Cámara Flotante (PiP)';
    } else {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480 } });
      pipVideo.srcObject = camStream;
      await pipVideo.play();
      await pipVideo.requestPictureInPicture();
      btnPipCam.textContent = '❌ Cerrar Cámara Flotante';
    }
  } catch (err) {
    alert('No se pudo abrir la cámara en modo flotante: ' + err.message);
  }
}

function updateTimer() {
  const totalMs = elapsedBeforePause + (Date.now() - startTime);
  const totalSec = Math.floor(totalMs / 1000);
  const hrs = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSec % 60).padStart(2, '0');
  timerEl.textContent = `${hrs}:${mins}:${secs}`;
}
