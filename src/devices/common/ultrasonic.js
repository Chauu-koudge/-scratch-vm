
/**
 * Common ultrasonic sensor configuration.
 * Used to share sensor settings across board classes.
 */

const Ultrasonic = {

    DEFAULT_TRIG_PIN: '9',

    DEFAULT_ECHO_PIN: '8',

    TIMEOUT: 30000,

    SPEED_DIVISOR: 58,

    /**
     * Convert pulse duration to centimetres.
     */
    durationToCentimeters: function (duration) {

        if (!duration || duration <= 0) {
            return -1;
        }

        return duration / this.SPEED_DIVISOR;
    }

};

module.exports = Ultrasonic;
