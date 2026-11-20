/**
 * Venago: give every board the same set of block categories as the Arduino Uno:
 *
 *   Pins · Sensors · Display · Serial · Data · Wireless · Console
 *
 * (Pins come from each board; Sensors from sensor-blocks.js.) A board that already
 * has a category keeps its own (e.g. the Uno R4 WiFi / micro:bit display, the
 * micro:bit wireless); a missing one is added here:
 *
 *  Arduino-framework boards (opcodes `arduino_<category>_<opcode>`,
 *  generators in venago-gui/src/lib/board-extra-generators.js):
 *  - Serial   : a second serial port on any 2 pins ("software serial" blocks).
 *               SoftwareSerial on AVR / ESP8266 / Uno R4, a hardware UART on ESP32,
 *               PIO serial on Raspberry Pi Pico. Skipped on boards that already
 *               have several serial ports in their Serial category (ESP32, Mega, K210).
 *  - Display  : the Uno R4 WiFi display blocks, driving a MAX7219 8x8 LED matrix
 *               (1 or 2 chained modules).
 *  - Wireless : the micro:bit wireless blocks, over an HC-05 / HC-06 Bluetooth module.
 *  - Console  : the micro:bit console "print" block, printing to the serial monitor.
 *
 *  micro:bit (MicroPython, opcodes `microbit_<category>_<opcode>`):
 *  - Serial and Data categories, matching the Arduino ones.
 *
 * Boards without realtime (Firmata) firmware can still be put in Stage mode: their
 * hardware blocks are marked Upload-only, so in Stage mode each category shows the
 * "These blocks work in Upload mode" hint, and the peripheral skips the Firmata handshake.
 *
 * Also, on every board:
 *  - the Data blocks have Stage-mode (realtime) implementations;
 *  - a category whose blocks only work in Upload mode shows a hint label in Stage
 *    mode instead of disappearing from the palette.
 */
const formatMessage = require('format-message');

const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const ProgramModeType = require('../../extension-support/program-mode-type');
const Cast = require('../../util/cast');

const UPLOAD = [ProgramModeType.UPLOAD];

const msg = (id, defaultText) => formatMessage({
    id: `venago.board.${id}`,
    default: defaultText,
    description: `Venago board extra block: ${id}`
});

/**
 * Board family, used to pick sensible default pins.
 * @param {string} deviceId - e.g. 'arduinoEsp32'.
 * @return {string} family name.
 */
const familyOf = deviceId => {
    const id = String(deviceId || '');
    if (id.startsWith('microbit')) return 'microbit';
    if (id === 'arduinoLeonardo' || id === 'makeyMakey') return 'leonardo';
    if (id === 'arduinoMega2560') return 'mega';
    if (id === 'arduinoEsp32S3') return 'esp32s3';
    if (id.startsWith('arduinoEsp32')) return 'esp32';
    if (id.startsWith('arduinoEsp8266')) return 'esp8266';
    if (id.startsWith('arduinoK210')) return 'k210';
    if (id.startsWith('arduinoRaspberryPiPico')) return 'rp2040';
    return 'uno';
};

/**
 * Default pins per family. Software-serial RX pins on Leonardo / Mega must support
 * pin-change interrupts; ESP32 defaults avoid the flash and boot-strap pins.
 */
const DEFAULT_PINS = {
    uno: {ssRx: 10, ssTx: 11, btRx: 2, btTx: 3, din: 12, cs: 10, clk: 11},
    leonardo: {ssRx: 8, ssTx: 9, btRx: 10, btTx: 11, din: 4, cs: 5, clk: 6},
    mega: {ssRx: 10, ssTx: 11, btRx: 12, btTx: 13, din: 4, cs: 5, clk: 6},
    esp32: {ssRx: 16, ssTx: 17, btRx: 25, btTx: 26, din: 23, cs: 5, clk: 18},
    esp32s3: {ssRx: 17, ssTx: 18, btRx: 15, btTx: 16, din: 11, cs: 10, clk: 12},
    esp8266: {ssRx: 4, ssTx: 5, btRx: 14, btTx: 12, din: 13, cs: 15, clk: 16},
    k210: {ssRx: 6, ssTx: 7, btRx: 8, btTx: 9, din: 10, cs: 11, clk: 12},
    rp2040: {ssRx: 5, ssTx: 4, btRx: 9, btTx: 8, din: 19, cs: 17, clk: 18},
    microbit: {ssRx: 1, ssTx: 0}
};

const pinMenu = device => (device.PINS_MENU && device.PINS_MENU.length ? device.PINS_MENU :
    Array.from({length: 14}, (_, i) => ({text: String(i), value: String(i)})));

const firstValue = (menu, fallback) => (menu && menu.length > 0 ? menu[0].value : fallback);
const pinValue = (menu, pin) => (menu.some(item => item.value === String(pin)) ? String(pin) : firstValue(menu, '0'));

const BAUD_MENU = ['4800', '9600', '19200', '38400', '57600', '115200'].map(b => ({text: b, value: b}));

const EOL_MENU = () => [
    {text: msg('eol.warp', 'warp'), value: 'warp'},
    {text: msg('eol.noWarp', 'no-warp'), value: 'noWarp'}
];

const DATA_TYPE_MENU = () => [
    {text: msg('dataType.integer', 'integer'), value: 'INTEGER'},
    {text: msg('dataType.decimal', 'decimal'), value: 'DECIMAL'},
    {text: msg('dataType.string', 'string'), value: 'STRING'}
];

const DEFAULT_IMAGE = '000000000000' +
    '011001100000' +
    '111111110000' +
    '111111110000' +
    '011111100000' +
    '001111000000' +
    '000110000000' +
    '000000000000';

const uploadHint = () => ({
    blockType: BlockType.LABEL,
    text: msg('uploadHint', 'These blocks work in Upload mode'),
    programMode: [ProgramModeType.REALTIME]
});

/* ---------------------------------------------------------------- Serial */

const softwareSerialBlocks = (device, defaults) => {
    const pins = pinMenu(device);
    return {
        blocks: [
            '---',
            {blockType: BlockType.LABEL, text: msg('softSerial.label', 'Software Serial (any 2 pins)'),
                programMode: UPLOAD},
            {
                opcode: 'softSerialBegin',
                text: msg('softSerial.begin', 'software serial begin RX [RX] TX [TX] baudrate [VALUE]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    RX: {type: ArgumentType.STRING, menu: 'venagoSoftSerialPins',
                        defaultValue: pinValue(pins, defaults.ssRx)},
                    TX: {type: ArgumentType.STRING, menu: 'venagoSoftSerialPins',
                        defaultValue: pinValue(pins, defaults.ssTx)},
                    VALUE: {type: ArgumentType.STRING, menu: 'venagoBaudrate', defaultValue: '9600'}
                },
                programMode: UPLOAD
            },
            {
                opcode: 'softSerialPrint',
                text: msg('softSerial.print', 'software serial print [VALUE] [EOL]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    VALUE: {type: ArgumentType.STRING, defaultValue: 'Hello Venago'},
                    EOL: {type: ArgumentType.STRING, menu: 'venagoEol', defaultValue: 'warp'}
                },
                programMode: UPLOAD
            },
            {
                opcode: 'softSerialAvailable',
                text: msg('softSerial.available', 'software serial available data length'),
                blockType: BlockType.REPORTER,
                disableMonitor: true,
                programMode: UPLOAD
            },
            {
                opcode: 'softSerialReadAByte',
                text: msg('softSerial.readAByte', 'software serial read a byte'),
                blockType: BlockType.REPORTER,
                disableMonitor: true,
                programMode: UPLOAD
            }
        ],
        menus: {
            venagoSoftSerialPins: {items: pins},
            venagoBaudrate: {items: BAUD_MENU},
            venagoEol: {items: EOL_MENU()}
        }
    };
};

/** micro:bit Serial category (MicroPython `uart`). */
const microbitSerialCategory = (device, defaults) => {
    const pins = pinMenu(device);
    return {
        id: 'serial',
        name: msg('category.serial', 'Serial'),
        color1: '#9966FF',
        color2: '#774DCB',
        color3: '#774DCB',
        blocks: [
            {
                opcode: 'serialBegin',
                text: msg('serial.begin', 'serial begin baudrate [VALUE]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    VALUE: {type: ArgumentType.STRING, menu: 'venagoBaudrate', defaultValue: '115200'}
                }
            },
            {
                opcode: 'serialBeginPins',
                text: msg('serial.beginPins', 'serial begin RX [RX] TX [TX] baudrate [VALUE]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    RX: {type: ArgumentType.STRING, menu: 'venagoSerialPins', defaultValue: pinValue(pins, defaults.ssRx)},
                    TX: {type: ArgumentType.STRING, menu: 'venagoSerialPins', defaultValue: pinValue(pins, defaults.ssTx)},
                    VALUE: {type: ArgumentType.STRING, menu: 'venagoBaudrate', defaultValue: '9600'}
                }
            },
            {
                opcode: 'serialPrint',
                text: msg('serial.print', 'serial print [VALUE] [EOL]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    VALUE: {type: ArgumentType.STRING, defaultValue: 'Hello Venago'},
                    EOL: {type: ArgumentType.STRING, menu: 'venagoEol', defaultValue: 'warp'}
                }
            },
            {
                opcode: 'serialAvailable',
                text: msg('serial.available', 'serial data available?'),
                blockType: BlockType.BOOLEAN
            },
            {
                opcode: 'serialReadAByte',
                text: msg('serial.readAByte', 'serial read a byte'),
                blockType: BlockType.REPORTER,
                disableMonitor: true
            }
        ],
        menus: {
            venagoSerialPins: {items: pins},
            venagoBaudrate: {items: BAUD_MENU},
            venagoEol: {items: EOL_MENU()}
        }
    };
};

/* ------------------------------------------------------------------ Data */

/** Data category for boards that have none (micro:bit); same blocks as the Arduino boards. */
const dataCategory = () => ({
    id: 'data',
    name: msg('category.data', 'Data'),
    color1: '#CF63CF',
    color2: '#C94FC9',
    color3: '#BD42BD',
    blocks: [
        {
            opcode: 'dataMap',
            text: msg('data.map', 'map [DATA] from ([ARG0], [ARG1]) to ([ARG2], [ARG3])'),
            blockType: BlockType.REPORTER,
            arguments: {
                DATA: {type: ArgumentType.NUMBER, defaultValue: '50'},
                ARG0: {type: ArgumentType.NUMBER, defaultValue: '1'},
                ARG1: {type: ArgumentType.NUMBER, defaultValue: '100'},
                ARG2: {type: ArgumentType.NUMBER, defaultValue: '1'},
                ARG3: {type: ArgumentType.NUMBER, defaultValue: '1000'}
            }
        },
        {
            opcode: 'dataConstrain',
            text: msg('data.constrain', 'constrain [DATA] between ([ARG0], [ARG1])'),
            blockType: BlockType.REPORTER,
            arguments: {
                DATA: {type: ArgumentType.NUMBER, defaultValue: '50'},
                ARG0: {type: ArgumentType.NUMBER, defaultValue: '1'},
                ARG1: {type: ArgumentType.NUMBER, defaultValue: '100'}
            }
        },
        '---',
        {
            opcode: 'dataConvert',
            text: msg('data.convert', 'convert [DATA] to [TYPE]'),
            blockType: BlockType.REPORTER,
            arguments: {
                DATA: {type: ArgumentType.STRING, defaultValue: '123'},
                TYPE: {type: ArgumentType.STRING, menu: 'venagoDataType', defaultValue: 'INTEGER'}
            }
        },
        {
            opcode: 'dataConvertASCIICharacter',
            text: msg('data.asciiCharacter', 'convert [DATA] to ASCII character'),
            blockType: BlockType.REPORTER,
            arguments: {
                DATA: {type: ArgumentType.NUMBER, defaultValue: '97'}
            }
        },
        {
            opcode: 'dataConvertASCIINumber',
            text: msg('data.asciiNumber', 'convert [DATA] to ASCII number'),
            blockType: BlockType.REPORTER,
            arguments: {
                DATA: {type: ArgumentType.STRING, defaultValue: 'a'}
            }
        }
    ],
    menus: {
        venagoDataType: {items: DATA_TYPE_MENU()}
    }
});

/* --------------------------------------------------------------- Display */

const displayCategory = (device, defaults) => {
    const pins = pinMenu(device);
    return {
        id: 'display',
        name: msg('category.display', 'Display'),
        color1: '#7BBED1',
        color2: '#5E9EAD',
        color3: '#5E9EAD',
        blocks: [
            {
                opcode: 'ledMatrixSetup',
                text: msg('display.setup', 'set up LED matrix (MAX7219) DIN [DIN] CS [CS] CLK [CLK]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    DIN: {type: ArgumentType.STRING, menu: 'venagoMatrixPins', defaultValue: pinValue(pins, defaults.din)},
                    CS: {type: ArgumentType.STRING, menu: 'venagoMatrixPins', defaultValue: pinValue(pins, defaults.cs)},
                    CLK: {type: ArgumentType.STRING, menu: 'venagoMatrixPins', defaultValue: pinValue(pins, defaults.clk)}
                },
                programMode: UPLOAD
            },
            '---',
            {
                opcode: 'ledMatrixShowImage',
                text: msg('display.showImage', 'show image [VALUE]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    VALUE: {type: ArgumentType.MATRIX8X12, defaultValue: DEFAULT_IMAGE}
                },
                programMode: UPLOAD
            },
            {
                opcode: 'ledMatrixShowImageFor',
                text: msg('display.showImageFor', 'show image [VALUE] for [TIME] secs'),
                blockType: BlockType.COMMAND,
                arguments: {
                    VALUE: {type: ArgumentType.MATRIX8X12, defaultValue: DEFAULT_IMAGE},
                    TIME: {type: ArgumentType.NUMBER, defaultValue: '1'}
                },
                programMode: UPLOAD
            },
            {
                opcode: 'ledMatrixScrollText',
                text: msg('display.scrollText', 'show [TEXT] until scroll done'),
                blockType: BlockType.COMMAND,
                arguments: {
                    TEXT: {type: ArgumentType.STRING, defaultValue: 'Hello Venago'}
                },
                programMode: UPLOAD
            },
            {
                opcode: 'ledMatrixClear',
                text: msg('display.clear', 'clear screen'),
                blockType: BlockType.COMMAND,
                programMode: UPLOAD
            },
            {
                opcode: 'ledMatrixLightPixel',
                text: msg('display.lightPixel', 'light [STATE] at the x: [X] axis, y: [Y] axis'),
                blockType: BlockType.COMMAND,
                arguments: {
                    STATE: {type: ArgumentType.STRING, menu: 'venagoLedState', defaultValue: '1'},
                    X: {type: ArgumentType.NUMBER, defaultValue: '0'},
                    Y: {type: ArgumentType.NUMBER, defaultValue: '0'}
                },
                programMode: UPLOAD
            },
            {
                opcode: 'ledMatrixBrightness',
                text: msg('display.brightness', 'set screen brightness to [VALUE] (0-15)'),
                blockType: BlockType.COMMAND,
                arguments: {
                    VALUE: {type: ArgumentType.NUMBER, defaultValue: '4'}
                },
                programMode: UPLOAD
            }
        ],
        menus: {
            venagoMatrixPins: {items: pins},
            venagoLedState: {
                items: [
                    {text: msg('ledState.on', 'on'), value: '1'},
                    {text: msg('ledState.off', 'off'), value: '0'}
                ]
            }
        }
    };
};

/* -------------------------------------------------------------- Wireless */

const wirelessCategory = (device, defaults) => {
    const pins = pinMenu(device);
    return {
        id: 'wireless',
        name: msg('category.wireless', 'Wireless'),
        color1: '#F4A28C',
        color2: '#5BA8B3',
        color3: '#5BA8B3',
        blocks: [
            {
                opcode: 'openWireless',
                text: msg('wireless.open',
                    'open wireless communication (Bluetooth) RX [RX] TX [TX] baudrate [BAUD]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    RX: {type: ArgumentType.STRING, menu: 'venagoBtPins', defaultValue: pinValue(pins, defaults.btRx)},
                    TX: {type: ArgumentType.STRING, menu: 'venagoBtPins', defaultValue: pinValue(pins, defaults.btTx)},
                    BAUD: {type: ArgumentType.STRING, menu: 'venagoBtBaudrate', defaultValue: '9600'}
                },
                programMode: UPLOAD
            },
            {
                opcode: 'closeWireless',
                text: msg('wireless.close', 'close wireless communication'),
                blockType: BlockType.COMMAND,
                programMode: UPLOAD
            },
            {
                opcode: 'resetWireless',
                text: msg('wireless.reset', 'reset wireless communication'),
                blockType: BlockType.COMMAND,
                programMode: UPLOAD
            },
            '---',
            {
                opcode: 'sendWirelessMessage',
                text: msg('wireless.send', 'send wireless message [TEXT]'),
                blockType: BlockType.COMMAND,
                arguments: {
                    TEXT: {type: ArgumentType.STRING, defaultValue: 'Hello Venago'}
                },
                programMode: UPLOAD
            },
            {
                opcode: 'wirelessMessageAvailable',
                text: msg('wireless.available', 'wireless message received?'),
                blockType: BlockType.BOOLEAN,
                programMode: UPLOAD
            },
            {
                opcode: 'receiveWirelessMessage',
                text: msg('wireless.receive', 'receive wireless message'),
                blockType: BlockType.REPORTER,
                disableMonitor: true,
                programMode: UPLOAD
            }
        ],
        menus: {
            venagoBtPins: {items: pins},
            venagoBtBaudrate: {items: BAUD_MENU}
        }
    };
};

/* --------------------------------------------------------------- Console */

const consoleCategory = () => ({
    id: 'console',
    name: msg('category.console', 'Console'),
    color1: '#F4A28C',
    color2: '#D27A65',
    color3: '#D27A65',
    blocks: [
        {
            opcode: 'consolePrint',
            text: msg('console.print', 'print [TEXT]'),
            blockType: BlockType.COMMAND,
            arguments: {
                TEXT: {type: ArgumentType.STRING, defaultValue: 'Hello Venago'}
            },
            programMode: UPLOAD
        }
    ],
    menus: {}
});

/* ------------------------------------------------- Data in Stage mode */

const toNumber = value => Cast.toNumber(value);

const dataImplementations = {
    dataMap: args => {
        const value = toNumber(args.DATA);
        const fromLow = toNumber(args.ARG0);
        const fromHigh = toNumber(args.ARG1);
        const toLow = toNumber(args.ARG2);
        const toHigh = toNumber(args.ARG3);
        if (fromHigh === fromLow) return toLow;
        // Arduino map() uses integer (long) arithmetic.
        return Math.trunc(((value - fromLow) * (toHigh - toLow) / (fromHigh - fromLow)) + toLow);
    },
    dataConstrain: args => {
        const value = toNumber(args.DATA);
        const low = Math.min(toNumber(args.ARG0), toNumber(args.ARG1));
        const high = Math.max(toNumber(args.ARG0), toNumber(args.ARG1));
        return Math.min(Math.max(value, low), high);
    },
    dataConvert: args => {
        const text = Cast.toString(args.DATA);
        switch (args.TYPE) {
        case 'INTEGER': {
            const n = parseInt(text, 10);
            return isNaN(n) ? 0 : n;
        }
        case 'DECIMAL': {
            const n = parseFloat(text);
            return isNaN(n) ? 0 : n;
        }
        default:
            return text;
        }
    },
    dataConvertASCIICharacter: args => String.fromCharCode(Math.trunc(toNumber(args.DATA)) & 0xFF),
    dataConvertASCIINumber: args => {
        const text = Cast.toString(args.DATA);
        return text.length > 0 ? text.charCodeAt(0) : 0;
    }
};

const DATA_OPCODES = Object.keys(dataImplementations);

/**
 * Data blocks run in Stage mode, and a category whose blocks are all Upload-only
 * shows a hint instead of disappearing.
 * @param {Array} info - device getInfo() result (modified in place).
 */
const applyStageModeFixes = info => {
    info.forEach(category => {
        const blocks = category.blocks || [];
        blocks.forEach(block => {
            if (block && typeof block === 'object' && DATA_OPCODES.includes(block.opcode)) {
                delete block.programMode;
            }
        });
        const realBlocks = blocks.filter(block => block && typeof block === 'object' &&
            block.blockType !== BlockType.LABEL);
        const hasHint = blocks.some(block => block && block.blockType === BlockType.LABEL &&
            block.programMode && block.programMode.includes(ProgramModeType.REALTIME));
        const allUploadOnly = realBlocks.length > 0 && realBlocks.every(block =>
            block.programMode && !block.programMode.includes(ProgramModeType.REALTIME));
        if (allUploadOnly && !hasHint) {
            category.blocks = blocks.concat([uploadHint()]);
        }
    });
};

const hasCategory = (info, id) => info.some(category => category.id === id);
const insertBefore = (info, beforeId, category) => {
    const index = info.findIndex(c => c.id === beforeId);
    info.splice(index === -1 ? info.length : index, 0, category);
};

/** Boards whose realtime (Stage-mode) Firmata firmware is supported. */
const REALTIME_BOARDS = ['arduinoUno', 'arduinoNano', 'arduinoMega2560', 'arduinoUnoUltra'];

/**
 * Whether a board can run its hardware blocks live in Stage mode.
 * @param {string} deviceId - real device id, e.g. 'arduinoEsp32'.
 * @param {Array.<string>} [programMode] - the device's program modes from the device list, if known.
 * @return {boolean} true if the board supports realtime mode.
 */
const supportsRealtime = (deviceId, programMode) => {
    if (Array.isArray(programMode)) return programMode.includes(ProgramModeType.REALTIME);
    return REALTIME_BOARDS.includes(deviceId);
};

/**
 * On a board without realtime firmware, every hardware block is Upload-only
 * (the Data blocks still run in Stage mode, they are computed in the editor).
 * @param {Array} info - device getInfo() result (modified in place).
 */
const markUploadOnly = info => {
    info.forEach(category => {
        (category.blocks || []).forEach(block => {
            if (!block || typeof block !== 'object' || DATA_OPCODES.includes(block.opcode)) return;
            if (block.blockType === BlockType.LABEL && block.programMode) return;
            block.programMode = UPLOAD;
        });
    });
};

/** Add the missing categories to an Arduino-framework board. */
const addArduinoCategories = (info, device, defaults) => {
    const serial = info.find(category => category.id === 'serial');
    if (serial) {
        const blocks = serial.blocks || [];
        const hasExtraPorts = blocks.some(b => b && /^multiSerial/.test(b.opcode));
        const hasSoftSerial = blocks.some(b => b && b.opcode === 'softSerialBegin');
        if (!hasExtraPorts && !hasSoftSerial) {
            const extra = softwareSerialBlocks(device, defaults);
            serial.blocks = blocks.concat(extra.blocks);
            serial.menus = Object.assign({}, serial.menus, extra.menus);
        }
    }
    // Same place as on the Uno R4 WiFi: right before Serial.
    if (!hasCategory(info, 'display')) insertBefore(info, 'serial', displayCategory(device, defaults));
    if (!hasCategory(info, 'wireless')) info.push(wirelessCategory(device, defaults));
    if (!hasCategory(info, 'console')) info.push(consoleCategory());
};

/** Add the missing categories to a micro:bit (it already has Display, Wireless and Console). */
const addMicrobitCategories = (info, device, defaults) => {
    // Order: Pins, Sensors, Display, Serial, Data, Wireless, Console.
    if (!hasCategory(info, 'serial')) insertBefore(info, 'wireless', microbitSerialCategory(device, defaults));
    if (!hasCategory(info, 'data')) insertBefore(info, 'wireless', dataCategory());
    const sensor = info.findIndex(c => c.id === 'sensor');
    const display = info.findIndex(c => c.id === 'display');
    if (sensor > display && display !== -1) {
        const [sensorCategory] = info.splice(sensor, 1);
        info.splice(display, 0, sensorCategory);
    }
};

/**
 * Attach the extra categories to a device instance.
 * @param {object} device - device extension instance.
 * @param {string} deviceId - e.g. 'arduinoUno'.
 * @param {string} type - device framework type: 'arduino' or 'microbit'.
 * @param {boolean} [realtime] - whether the board supports realtime mode (default: from REALTIME_BOARDS).
 * @return {object} the same device.
 */
const attachBoardExtraBlocks = (device, deviceId, type, realtime = supportsRealtime(deviceId)) => {
    if (!device || typeof device.getInfo !== 'function' || device._venagoBoardExtrasAttached) {
        return device;
    }
    if (type !== 'arduino' && type !== 'microbit') return device;
    device._venagoBoardExtrasAttached = true;

    const family = familyOf(deviceId);
    const defaults = DEFAULT_PINS[family] || DEFAULT_PINS.uno;
    const originalGetInfo = device.getInfo.bind(device);

    if (!realtime && device._peripheral) {
        // Read by ArduinoPeripheral: don't start the Firmata handshake in Stage mode.
        device._peripheral.venagoNoRealtime = true;
    }

    device.getInfo = () => {
        const info = originalGetInfo() || [];
        // A board with no blocks of its own (e.g. the Arduino Uno SE base board) stays empty.
        if (info.length === 0) return info;

        if (type === 'microbit') {
            addMicrobitCategories(info, device, defaults);
        } else {
            addArduinoCategories(info, device, defaults);
        }
        if (!realtime) markUploadOnly(info);
        applyStageModeFixes(info);
        return info;
    };

    DATA_OPCODES.forEach(name => {
        if (typeof device[name] !== 'function') {
            device[name] = args => dataImplementations[name](args || {});
        }
    });

    return device;
};

module.exports = {
    attachBoardExtraBlocks,
    applyStageModeFixes,
    dataImplementations,
    familyOf,
    supportsRealtime,
    DEFAULT_PINS
};
