const express = require('express');
const WebSocket = require('ws');
const { UareU, CONSTANTS } = require('uareu-node');
const uareu = UareU.getInstance();

const app = express();
const PORT = 4000;
const WSPORT = 4001;
let readerHandle;

app.use(express.static('public'));
app.listen(PORT, () => console.log(`[SERVER] REST API en http://localhost:${PORT}`));

const wss = new WebSocket.Server({ port: WSPORT }, () =>
  console.log(`[SERVER] WebSocket en ws://localhost:${WSPORT}`)
);

async function initReader() {
  console.log('[INIT] Cargando librerías...');
  await uareu.loadLibs();
  await uareu.dpfpddInit();

  const devices = await uareu.dpfpddQueryDevices();
  if (!devices.devicesList.length) throw new Error('No se encontraron dispositivos');

  console.log(`[INIT] Dispositivo encontrado: ${devices.devicesList[0].name}`);
  const opened = await uareu.dpfpddOpen(devices.devicesList[0]);
  if (!opened) throw new Error('No se pudo abrir el lector');
  readerHandle = opened;
  console.log('[INIT] Lector abierto correctamente');
}

async function captureFingerprint(ws) {
  console.log('[CAPTURE] Iniciando captura...');
  try {
    uareu.dpfpddCaptureAsync(
      readerHandle,
      CONSTANTS.DPFPDD_IMAGE_FMT.DPFPDD_IMG_FMT_ANSI381,
      CONSTANTS.DPFPDD_IMAGE_PROC.DPFPDD_IMG_PROC_DEFAULT,
      async (result, resultSize) => {
        if (!result || !result.imageData) {
          console.error('[CAPTURE] Error: resultado inválido');
          ws.send(JSON.stringify({ event: 'error', message: 'Error al capturar huella' }));
          return;
        }

        // Convertir buffer a base64
        const rawBuffer = Buffer.from(result.data['ref.buffer']);
        const base64Image = rawBuffer.toString('base64');
        console.log('[CAPTURE] Captura exitosa. Enviando datos al cliente...');

        ws.send(JSON.stringify({ event: 'fingerprint', data: base64Image }));
      }
    );
  } catch (err) {
    console.error('[CAPTURE] Error en captura:', err);
    ws.send(JSON.stringify({ event: 'error', message: 'Error en captura' }));
  }
}

wss.on('connection', (ws) => {
  console.log('[WS] Cliente WebSocket conectado');

  ws.on('message', (message) => {
    console.log('[WS] Mensaje recibido:', message.toString());
    const { command } = JSON.parse(message);

    if (command === 'capture') {
      captureFingerprint(ws);
    }
  });

  ws.on('close', () => console.log('[WS] Cliente WebSocket desconectado'));
});

initReader().catch((err) => console.error('[INIT] Error durante inicialización:', err));
