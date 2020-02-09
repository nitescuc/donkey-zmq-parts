const Gpio = require('pigpio').Gpio;

// The number of microseconds it takes sound to travel 1cm at 20 degrees celcius
const MICROSECDONDS_PER_CM = 1e6/34321;

class SonarReader {
    constructor(config) {
        this.config = config;
        this.config.frequency = this.config.frequency || 100;
        if (this.config.triggerPin) {
            this.trigger = new Gpio(this.config.triggerPin, {mode: Gpio.OUTPUT});
            this.trigger.digitalWrite(0); // Make sure trigger is low    
        }
        this.echo = new Gpio(this.config.echoPin, {mode: Gpio.INPUT, alert: true});
        this.echo.pullUpDown(Gpio.PUD_UP);
        this.echo.on('alert', (level, tick) => {
            if (level == 1) {
              this.startTick = tick;
            } else {
              const endTick = tick;
              const diff = (endTick >> 0) - (this.startTick >> 0); // Unsigned 32 bit arithmetic
              this.distance = diff / 2 / MICROSECDONDS_PER_CM;
              if (this.config.cb) {
                  this.config.cb(this.getDistance());
              }
            }
        });
    }
    getDistance() {
        return Math.round(this.distance);
    }
    trigger() {
        if (this.config.triggerPin) {
            this.trigger.trigger(10, 1);                    
        }
    }
}

class SonarGroup {
    constructor(config) {
        this.config = config;
        this.sonars = this.config.sonars.map(sonarConf => {
            return new SonarReader(sonarConf);
        });
        this.trigger = new Gpio(this.config.triggerPin, {mode: Gpio.OUTPUT});
        this.trigger.digitalWrite(0); // Make sure trigger is low
    }
    start() {
        this.pwmTimer = new Gpio(this.config.pwmTimerPin, {mode: Gpio.OUTPUT, edge: Gpio.RISING_EDGE});
        this.pwmTimer.on('interrupt', (level, tick) => {
            this.trigger.trigger(10, 1);
        });
        this.pwmTimer.pwmFrequency(this.config.frequency);
        this.pwmTimer.pwmWrite(128);
    }
    update() {
        this.trigger.trigger(10, 1);
    }
    read() {
        return this.sonars.map(sonar => sonar.getDistance());
    }
}

module.exports = { SonarGroup, SonarReader };
