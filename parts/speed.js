const Gpio = require('pigpio').Gpio;
const mpu6050 = require('mpu6050');
const fs = require('fs');

class SpeedController {
  constructor(config) {
    this.config = config;
    this.mpu6050 = new mpu6050();
    this.mpu6050.initialize();
    this.mpu6050.setFullScaleAccelRange(0x00);
    //
    this.config.frequency = this.config.frequency || 400;
    this.config.calibrationSamplesCount = this.config.calibrationSamplesCount || (this.config.frequency / 5);
    this.config.noiseThreshold = this.config.noiseThreshold || 300;
    //
    this.speed = 0;
    this.calibrationValue = this.config.calibrationValue;
    this.calibrationSamples = [];
    //
    if (this.config.logfile) this.stream = fs.createWriteStream(this.config.logfile);
  }
  _isNoise(s) {
    return s > this.calibrationValue - this.config.noiseThreshold && s < this.calibrationValue + this.config.noiseThreshold;
  }
  _addSampleGetAvg(s) {
    if (this.calibrationValue == null) this.calibrationValue = s;
    if (!this._isNoise(s)) {
      this.calibrationSamples = [];
      return this.calibrationValue;
    }
    this.calibrationSamples.push(s);
    if (this.calibrationSamples.length > this.config.calibrationSamplesCount) this.calibrationSamples.shift();
    //
    this.calibrationValue = this.calibrationSamples.length >= this.config.calibrationSamplesCount ? 
      this.calibrationSamples.reduce((prev, sample, idx) => { return prev + sample }, 0)/this.calibrationSamples.length : 
      this.calibrationValue;
    return this.calibrationValue;
  }
  _readAcceleration() {
    const tt = new Date().getTime();
    this.mpu6050.getAcceleration((err, data) => {
      if (err) return console.error('error', err);
      //
      const s = data[this.config.speedAxis];
      //this._addSampleGetAvg(s);
      this.speed = this.speed + (!this._isNoise(s) ? s - this.calibrationValue : 0);
      //
      if (this.stream) this.stream.write(`${tt}\t${data[0]}\t${data[1]}\t${data[2]}\t${this.speed}\n`.replace(/\./,','));
    });
  }
  _startAcquisition() {
    this.pwmTimer = new Gpio(this.config.pwmTimerPin, {mode: Gpio.OUTPUT, edge: Gpio.RISING_EDGE});
    this.pwmTimer.on('interrupt', (level, tick) => {
        this._readAcceleration();
    });
    this.pwmTimer.pwmFrequency(this.config.frequency);
    this.pwmTimer.pwmWrite(128);
  }
  start() {
    this.time = new Date().getTime();
    // calibrate
    this.mpu6050.getAcceleration((err, data) => {
      this.calibrationValue = null;
      this._startAcquisition();
    });
  }
  update() {
    this._readAcceleration();
  }
  getSpeed() {
    return this.speed;
  }
}

module.exports = { SpeedController };
