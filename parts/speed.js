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
    this.speed = 0;
    this.calibrationValue = 0;
    this.config.reduceFactor = 100;
    this.config.filterValue = 5;
    this.config.speedFilter = 2000;
    this.sampleCount = 10;
    this.sampleWeights = [];
    this.sampleTotalWeights = 0;
    for (let i = 0; i < this.sampleCount; i++) {
      this.sampleWeights[i] = (i + 1)/this.sampleCount;
      this.sampleTotalWeights += this.sampleWeights[i];
    }
    this.samples = [];
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
//      console.log(data);
      if (this.samples--) {
        this.stream.write(`${new Date().getTime()};${data[0]},${data[1]},${data[2]}\n`);
        console.log('sample ' + this.samples); 
     } else {
        console.log('ending');
        this.stream.end();
      }
    });
  }
  __readAcceleration() {
    const tt = new Date().getTime();
//    console.log('time', tt - this.time);
    this.time = tt;
    this.mpu6050.getAcceleration((err, data) => {
      if (err) return console.error('error', err);
//      console.log('data', data[this.config.speedAxis]/this.reduceFactor);
      const x = Math.round(this._addSampleGetAvg(Math.round(data[this.config.speedAxis]/this.config.reduceFactor)));
//      console.log('samples', this.samples);
      if (this.calibrationValue == null)
        if (this.samples.length < this.sampleCount) return;
        else {
          this.calibrationValue = x;
          console.log('calibration', this.calibrationValue);
        }
//      this.speed += (Math.round(data[this.config.speedAxis]/1000) - this.calibrationValue);
      let value = x - this.calibrationValue;
      if (Math.abs(value) < this.config.filterValue) value = 0;
      if (value) {
        this.speed += value;
        console.log(this.speed);
      } else {
//        if (Math.abs(this.speed) < this.config.speedFilter) this.speed = 0;
      }
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
    this.stream = fs.createWriteStream(__dirname + '/' + new Date().toISOString());
    this.samples = 10000;
    // calibrate
    this.mpu6050.getAcceleration((err, data) => {
      this.calibrationValue = null; // Math.round(data[this.config.speedAxis]/this.config.reduceFactor);
      console.log('calibration', this.calibrationValue);
      this._startAcquisition();
    });
  }
  getSpeed() {
    return this.speed;
  }
}

module.exports = { SpeedController };
