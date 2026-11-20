# Venago VM

The virtual machine of the Venago block-coding editor (a fork of OpenBlock VM / Scratch VM,
package name `openblock-vm`). It defines the boards, their blocks and how blocks run.

## What is new in this version

- **Sensors category for every board** – ultrasonic distance, DHT11/DHT22, and grouped
  *Digital Sensors* / *Analog Sensors* blocks with a sensor drop-down (IR, PIR, touch, flame,
  sound, rain, tilt, button, line, LDR, potentiometer, soil, gas, water, LM35 …).
  `src/devices/common/sensor-blocks.js`
- **Same categories on every board** – Display (MAX7219 LED matrix), Wireless (HC-05 / HC-06
  Bluetooth), Console, software serial and Data are added to every Arduino-framework board;
  micro:bit gets Serial and Data. `src/devices/common/board-extra-blocks.js`
- **Stage mode for every board** – boards without realtime firmware can stay in Stage mode;
  their hardware blocks show an "Upload mode" hint and the Firmata handshake is skipped.
- **Data blocks work in Stage mode** (map, constrain, convert, ASCII).
- **Headings inside a category** (`BlockType.LABEL`), e.g. "Digital Sensors".
- **Live port list** for the editor's Serial / Bluetooth menu (`didUpdatePeripheralList`).

## Where the code generators are

The C++ / MicroPython generators for these blocks live in the editor (scratch-gui):
`src/lib/sensor-generators.js` and `src/lib/board-extra-generators.js`.

## Run the whole Venago editor locally

Venago is made of four projects that sit next to each other in one folder:

| Folder | Repository | What it is |
|---|---|---|
| `venago-gui` | [scratch-gui](https://github.com/Chauu-koudge/scratch-gui) | The editor (React / Scratch GUI) |
| `venago-vm` | [scratch-vm](https://github.com/Chauu-koudge/-scratch-vm) | Blocks, boards, sensors, runtime |
| `venago-blocks` | [scratch-blocks](https://github.com/Chauu-koudge/scratch-blocks) | Blockly blocks and code generators |
| `venago-link` | [scratch-link](https://github.com/Chauu-koudge/scratch-link) | Serial / Bluetooth connection and upload service |

```
git clone https://github.com/Chauu-koudge/scratch-gui.git venago-gui
git clone https://github.com/Chauu-koudge/-scratch-vm.git venago-vm
git clone https://github.com/Chauu-koudge/scratch-blocks.git venago-blocks
git clone https://github.com/Chauu-koudge/scratch-link.git venago-link
```

Install dependencies in each folder (`npm install`), then in two terminals:

```
cd venago-link && npm start
cd venago-gui && set NODE_OPTIONS=--openssl-legacy-provider && npx webpack-dev-server --host 127.0.0.1 --port 8601
```

Open http://127.0.0.1:8601
