const Gpio = require('pigpio').Gpio;
const mpu6050 = require('mpu6050');
const fs = require('fs');

class SpeedController {
  constructor(config) {
    this.config = config;
    this.mpu6050 = new mpu6050();
    this.mpu6050.initialize();
    this.mpu6050.setFullScaleAccelRange(1);
    //
    this.config.calibrationSamplesCount = 50;
    this.config.speedThreshold = 5000;
    //
    this.speed = 0;
    this.speedThresholdCount = 0;
    this.calibrationValue = null;
    this.calibrationSamples = [];
  }
  _addSampleGetAvg(s) {
//    console.log('add', s);
    this.samples.push(s);
    if (this.samples.length > this.sampleCount) this.samples.shift();
    //
    return this.samples.reduce((prev, sample, idx) => { return prev + sample * this.sampleWeights[idx] }, 0)/this.sampleTotalWeights;
  }
  _readAcceleration() {
    this.mpu6050.getAcceleration((err, data) => {
      if (err) return console.error('error', err);
      //
      if (this.config.calibrationSamplesCount > this.samples.length) {
        this.samples.push(data[this.config.speedAxis]);
      } else {
        if (this.calibrationValue == null) {
          this.calibrationValue = this.samples.reduce((prev, sample) => { return prev + sample }, 0)/this.samples.length;
        }
        console.log('calibration', this.calibrationValue);
        this.speed = this.speed + data[this.config.speedAxis] - this.calibrationValue;
        if (this.speed < this.config.speedThreshold) {
          this.speedThresholdCount++;
          if (this.speedThresholdCount > this.config.calibrationSamplesCount) {
            this.speed = 0;
            this.speedThresholdCount = 0;
          }
        } else this.speedThresholdCount = 0;
      }
      //
      if (this.stream) this.stream.write(`${new Date().getTime()};${data[0]};${data[1]};${data[2]};${this.speed}\n`);
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
    this.time = new Date().getTime();
    this.stream = fs.createWriteStream(__dirname + '/../' + new Date().toISOString());
    // calibrate
    this.mpu6050.getAcceleration((err, data) => {
      this.calibrationValue = null;
      this._startAcquisition();
    });
  }
  getSpeed() {
    return this.speed;
  }
}

module.exports = { SpeedController };
