const mpu6050 = require('mpu6050');

class SpeedController {
  constructor(config) {
    this.config = config;
    this.mpu6050 = new mpu6050();
    this.mpu6050.initialize();
    //
    this.speed = 0;
    this.calibrationValue = 0;
  }
  _readAcceleration() {
    this.mpu6050.getAcceleration((err, data) => {
      this.speed += (data[this.config.speedAxis] - this.calibrationValue);
    });
  }
  _startAcquisition() {
    this.pwmTimer = new Gpio(this.config.pwmTimerPin, {mode: Gpio.OUTPUT, edge: Gpio.RISING_EDGE});
    this.pwmTimer.on('interrupt', (level, tick) => {
        this._readAcceleration();
    });
    this.pwmTimer.pwmFrequency(100);
    this.pwmTimer.pwmWrite(128);
  }
  start() {
    // calibrate
    this.mpu6050.getAcceleration((err, data) => {
      this.calibrationValue = data[this.config.speedAxis];
    });
  }
  getSpeed() {
    return this.speed;
  }
}

module.exports = { SpeedController };
