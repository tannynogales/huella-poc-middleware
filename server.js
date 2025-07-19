const express = require('express');
const WebSocket = require('ws');
const { UareU, CONSTANTS } = require('uareu-node');

const app = express();
const port = 4000;
const wss = new WebSocket.Server({ port: 4001 });

let uareu = UareU.getInstance();
let reader;

async function initReader() {
  try {
    console.log('Cargando librerías...');
    await uareu.loadLibs('bin/dpfpdd.dll', 'bin/dpfj.dll');
    console.log('Librerías cargadas');

    await uareu.dpfpddInit();
    console.log('SDK inicializado');

    const { devicesList } = await uareu.dpfpddQueryDevices();
    if (!devicesList.length) throw new Error('No se encontraron lectores conectados');

    reader = await uareu.dpfpddOpen(devicesList[0]);
    console.log('Lector abierto:', devicesList[0]);
  } catch (err) {
    console.error('Error al inicializar lector:', err.message);
  }
}

initReader();

app.get('/status', (_, res) => res.send(reader ? 'Lector listo' : 'Lector no inicializado'));

wss.on('connection', ws => {
  console.log('Cliente WS conectado');

  const capture = () => {
    uareu.dpfpddCaptureAsync(
      reader,
      CONSTANTS.DPFPDD_IMAGE_FMT.DPFPDD_IMG_FMT_PNG,
      CONSTANTS.DPFPDD_IMAGE_PROC.DPFPDD_IMG_PROC_DEFAULT,
      (err, data) => {
        if (err) {
          console.error('Error al capturar huella:', err.message);
          ws.send(JSON.stringify({ event: 'error', message: err.message }));
          return;
        }

        console.log('Huella capturada, enviando...');
        ws.send(JSON.stringify({
          event: 'finger-captured',
          data: data.toString('base64')
        }));

        capture(); // Captura continua
      }
    );
  };

  capture();
});

app.listen(port, () => {
  console.log(`REST API en http://localhost:${port}`);
  console.log(`WebSocket en ws://localhost:${port + 1}`);
});
