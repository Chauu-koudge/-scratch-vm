const createUltrasonicCategory = pinMenu => ({
    id: 'sensor',

    name: 'Sensors',

    color1: '#48B0B0',
    color2: '#2D8A8A',
    color3: '#2D8A8A',

    blocks: [
        {
            opcode: 'ultrasonicDistance',

            text: 'get ultrasonic distance trig [TRIG] echo [ECHO]',

            blockType: BlockType.REPORTER,

            arguments: {
                TRIG: {
                    type: ArgumentType.STRING,
                    menu: 'pins',
                    defaultValue: '9'
                },

                ECHO: {
                    type: ArgumentType.STRING,
                    menu: 'pins',
                    defaultValue: '8'
                }
            }
        }
    ],

    menus: {
        pins: {
            items: pinMenu
        }
    }
});