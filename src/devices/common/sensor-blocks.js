/**
 * Venago shared "Sensors" block category.
 *
 * Attached to every board when it is loaded (see ExtensionManager.loadDeviceURL),
 * so all boards — and any board added later — get the same PictoBlox-style
 * sensor palette, using that board's own pin menus.
 *
 * Layout in the palette:
 *   ultrasonic distance          (its own block)
 *   DHT temperature / humidity   (its own block, Arduino boards only)
 *   ── Digital Sensors ──  read [sensor ▼] at digital pin [ ]   (true / false)
 *   ── Analog Sensors ──   read [sensor ▼] at analog pin [ ]    (value)
 *
 * - Arduino-framework boards get the category id `sensor`, which the extension
 *   manager prefixes to `arduino_sensor`, so opcodes become
 *   `arduino_sensor_<opcode>`. The C++ generators live in
 *   venago-gui/src/lib/sensor-generators.js.
 * - micro:bit already has a `sensor` category; the blocks are merged into it
 *   (opcodes `microbit_sensor_<opcode>`, MicroPython generators in the same file).
 *
 * Realtime (Stage) mode: digital/analog sensors run live over Firmata.
 * Timing-critical sensors (ultrasonic, DHT) are upload-mode only, because the
 * standard Firmata firmware cannot measure pulses.
 *
 * Keep DIGITAL_SENSORS / ANALOG_SENSORS in sync with sensor-generators.js.
 */
const formatMessage = require('format-message');
const Buffer = require('buffer').Buffer;

const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const ProgramModeType = require('../../extension-support/program-mode-type');

const CATEGORY_ID = 'sensor';

/**
 * Digital sensors: `activeLevel` is the pin level that means "detected / true".
 */
const DIGITAL_SENSORS = [
    {value: 'ir', text: 'IR obstacle sensor', activeLevel: 0},
    {value: 'pir', text: 'PIR motion sensor', activeLevel: 1},
    {value: 'touch', text: 'touch sensor', activeLevel: 1},
    {value: 'flame', text: 'flame sensor', activeLevel: 0},
    {value: 'sound', text: 'sound sensor', activeLevel: 1},
    {value: 'rain', text: 'rain sensor', activeLevel: 0},
    {value: 'tilt', text: 'tilt sensor', activeLevel: 1},
    {value: 'button', text: 'push button', activeLevel: 1},
    {value: 'line', text: 'IR line sensor (black line)', activeLevel: 1},
    {value: 'digital', text: 'digital sensor', activeLevel: 1}
];

/**
 * Analog sensors: raw ADC value, except LM35 which is converted to °C.
 */
const ANALOG_SENSORS = [
    {value: 'ldr', text: 'light sensor (LDR)'},
    {value: 'potentiometer', text: 'potentiometer'},
    {value: 'soil', text: 'soil moisture sensor'},
    {value: 'gas', text: 'gas sensor (MQ)'},
    {value: 'sound', text: 'sound sensor'},
    {value: 'rain', text: 'rain sensor'},
    {value: 'water', text: 'water level sensor'},
    {value: 'flame', text: 'flame sensor'},
    {value: 'lm35', text: 'LM35 temperature (°C)'},
    {value: 'analog', text: 'analog sensor'}
];

const DhtReading = {
    Temperature: 'temperature',
    Humidity: 'humidity'
};

const DhtModel = {
    DHT11: '11',
    DHT22: '22'
};

// Small sensor icon shown on the category bubble and on each block (PictoBlox style).
const SENSOR_ICON = `data:image/svg+xml;base64,${Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
    '<rect x="3" y="10" width="34" height="20" rx="4" fill="#ffffff" stroke="#0B7F8A" stroke-width="2"/>' +
    '<circle cx="13" cy="20" r="6.5" fill="#0FA3B1" stroke="#0B7F8A" stroke-width="2"/>' +
    '<circle cx="27" cy="20" r="6.5" fill="#0FA3B1" stroke="#0B7F8A" stroke-width="2"/>' +
    '<circle cx="13" cy="20" r="2.5" fill="#ffffff"/>' +
    '<circle cx="27" cy="20" r="2.5" fill="#ffffff"/>' +
    '</svg>'
).toString('base64')}`;

const msg = (id, defaultText) => formatMessage({
    id: `venago.sensor.${id}`,
    default: defaultText,
    description: `Venago sensor block: ${id}`
});

const firstValue = (menu, fallback) => (menu && menu.length > 0 ? menu[0].value : fallback);

const hasValue = (menu, value) => !!(menu && menu.some(item => item.value === value));

const pickDefault = (menu, preferred, fallback) => (hasValue(menu, preferred) ? preferred : firstValue(menu, fallback));

/**
 * Build the sensor block metadata for a board.
 * @param {object} device - the board's block object (provides PINS_MENU / ANALOG_PINS_MENU).
 * @param {string} type - device framework type, e.g. 'arduino' or 'microbit'.
 * @return {{blocks: Array, menus: object}} block list and menus.
 */
const makeSensorBlocks = (device, type) => {
    const digitalPins = device.PINS_MENU || [];
    const analogPins = device.ANALOG_PINS_MENU || digitalPins;
    const isArduino = type === 'arduino';

    const defaultDigital = pickDefault(digitalPins, '2', '0');
    const defaultAnalog = firstValue(analogPins, '0');

    const uploadOnly = [ProgramModeType.UPLOAD];

    const blocks = [
        {
            opcode: 'ultrasonicDistance',
            text: msg('ultrasonicDistance', 'get ultrasonic sensor distance (cm) trig [TRIG] echo [ECHO]'),
            blockType: BlockType.REPORTER,
            arguments: {
                TRIG: {
                    type: ArgumentType.STRING,
                    menu: 'sensorDigitalPins',
                    defaultValue: pickDefault(digitalPins, '9', defaultDigital)
                },
                ECHO: {
                    type: ArgumentType.STRING,
                    menu: 'sensorDigitalPins',
                    defaultValue: pickDefault(digitalPins, '8', defaultDigital)
                }
            },
            programMode: uploadOnly
        }
    ];

    // DHT needs microsecond bit-banging; MicroPython on micro:bit cannot do it reliably.
    if (isArduino) {
        blocks.push({
            opcode: 'dhtReading',
            text: msg('dhtReading', 'get [READING] from [MODEL] sensor at pin [PIN]'),
            blockType: BlockType.REPORTER,
            arguments: {
                READING: {
                    type: ArgumentType.STRING,
                    menu: 'dhtReading',
                    defaultValue: DhtReading.Temperature
                },
                MODEL: {
                    type: ArgumentType.STRING,
                    menu: 'dhtModel',
                    defaultValue: DhtModel.DHT11
                },
                PIN: {
                    type: ArgumentType.STRING,
                    menu: 'sensorDigitalPins',
                    defaultValue: defaultDigital
                }
            },
            programMode: uploadOnly
        });
    }

    blocks.push(
        '---',
        {
            blockType: BlockType.LABEL,
            text: msg('label.digital', 'Digital Sensors')
        },
        {
            opcode: 'digitalSensor',
            text: msg('digitalSensor', 'read [SENSOR] at digital pin [PIN]'),
            blockType: BlockType.BOOLEAN,
            arguments: {
                SENSOR: {
                    type: ArgumentType.STRING,
                    menu: 'digitalSensorType',
                    defaultValue: DIGITAL_SENSORS[0].value
                },
                PIN: {
                    type: ArgumentType.STRING,
                    menu: 'sensorDigitalPins',
                    defaultValue: defaultDigital
                }
            }
        },
        '---',
        {
            blockType: BlockType.LABEL,
            text: msg('label.analog', 'Analog Sensors')
        },
        {
            opcode: 'analogSensor',
            text: msg('analogSensor', 'read [SENSOR] at analog pin [PIN]'),
            blockType: BlockType.REPORTER,
            arguments: {
                SENSOR: {
                    type: ArgumentType.STRING,
                    menu: 'analogSensorType',
                    defaultValue: ANALOG_SENSORS[0].value
                },
                PIN: {
                    type: ArgumentType.STRING,
                    menu: 'sensorAnalogPins',
                    defaultValue: defaultAnalog
                }
            }
        }
    );

    const menus = {
        sensorDigitalPins: {items: digitalPins},
        sensorAnalogPins: {items: analogPins},
        digitalSensorType: {
            items: DIGITAL_SENSORS.map(s => ({text: msg(`digital.${s.value}`, s.text), value: s.value}))
        },
        analogSensorType: {
            items: ANALOG_SENSORS.map(s => ({text: msg(`analog.${s.value}`, s.text), value: s.value}))
        }
    };
    if (isArduino) {
        menus.dhtReading = {
            items: [
                {text: msg('dhtReading.temperature', 'temperature (°C)'), value: DhtReading.Temperature},
                {text: msg('dhtReading.humidity', 'humidity (%)'), value: DhtReading.Humidity}
            ]
        };
        menus.dhtModel = {
            items: [
                {text: 'DHT11', value: DhtModel.DHT11},
                {text: 'DHT22', value: DhtModel.DHT22}
            ]
        };
    }

    return {blocks, menus};
};

/**
 * Realtime (Stage mode) implementations. They read pins over Firmata through the
 * board's peripheral. Boards without realtime support never call these.
 */
const readDigital = (device, pin) => {
    const peripheral = device._peripheral;
    if (!peripheral || typeof peripheral.readDigitalPin !== 'function') return Promise.resolve(null);
    // null = not connected / read timed out, so the boolean block reports false.
    return Promise.resolve(peripheral.readDigitalPin(pin)).then(value => {
        if (value === null || typeof value === 'undefined') return null;
        return value ? 1 : 0;
    });
};

const readAnalog = (device, pin) => {
    const peripheral = device._peripheral;
    if (!peripheral || typeof peripheral.readAnalogPin !== 'function') return Promise.resolve(0);
    return Promise.resolve(peripheral.readAnalogPin(pin)).then(value => (Number(value) || 0));
};

const realtimeImplementations = {
    // Upload-only blocks: return a neutral value if ever evaluated live.
    ultrasonicDistance: () => -1,
    dhtReading: () => 0,
    digitalSensor: (device, args) => {
        const sensor = DIGITAL_SENSORS.find(s => s.value === args.SENSOR) ||
            DIGITAL_SENSORS[DIGITAL_SENSORS.length - 1];
        return readDigital(device, args.PIN).then(value => value === sensor.activeLevel);
    },
    analogSensor: (device, args) => readAnalog(device, args.PIN).then(value => {
        if (args.SENSOR === 'lm35') {
            // Firmata reports 10-bit analog on the realtime-capable 5 V boards (Uno/Nano/Mega).
            return Math.round(value * 500 / 1023 * 10) / 10;
        }
        return value;
    })
};

/**
 * Add the shared Sensors category to a freshly created board instance.
 * @param {object} device - the board's block object.
 * @param {string} type - device framework type ('arduino', 'microbit', ...).
 * @return {object} the same device instance.
 */
const attachSensorBlocks = (device, type) => {
    if (!device || typeof device.getInfo !== 'function' || device._venagoSensorsAttached) {
        return device;
    }
    // Only frameworks that have generators for these blocks.
    if (type !== 'arduino' && type !== 'microbit') {
        return device;
    }
    device._venagoSensorsAttached = true;

    const originalGetInfo = device.getInfo.bind(device);
    device.getInfo = () => {
        const info = originalGetInfo() || [];
        // A board with no blocks of its own (e.g. Arduino Uno SE) stays empty.
        if (info.length === 0) return info;

        const {blocks, menus} = makeSensorBlocks(device, type);
        const existing = info.find(category => category.id === CATEGORY_ID);
        if (existing) {
            existing.blocks = (existing.blocks || []).concat(['---'], blocks);
            existing.menus = Object.assign({}, existing.menus, menus);
            return info;
        }

        const category = {
            id: CATEGORY_ID,
            name: msg('category', 'Sensors'),
            color1: '#0FA3B1',
            color2: '#0B7F8A',
            color3: '#0B7F8A',
            blockIconURI: SENSOR_ICON,
            menuIconURI: SENSOR_ICON,
            blocks,
            menus
        };
        // PictoBlox places Sensors right after the board's own pin category.
        info.splice(1, 0, category);
        return info;
    };

    Object.keys(realtimeImplementations).forEach(name => {
        if (typeof device[name] !== 'function') {
            device[name] = args => realtimeImplementations[name](device, args || {});
        }
    });

    return device;
};

module.exports = {
    attachSensorBlocks,
    makeSensorBlocks,
    DIGITAL_SENSORS,
    ANALOG_SENSORS,
    CATEGORY_ID
};
