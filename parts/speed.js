const Gpio = require('pigpio').Gpio;
const mpu6050 = require('./mpu6050');
const fs = require('fs');

const MPU6050_RA_XA_OFFS_H = 0x06;

mpu6050.prototype.setXAccelOffset = function(offset, cb) {
    const buf = Buffer.allocUnsafe(2);
    buf.writeUInt16BE(offset);
    this.i2cdev.writeBytes(MPU6050_RA_XA_OFFS_H, [...buf], cb);    
}

class SpeedController {
  constructor(config) {
    this.config = config;
    this.mpu6050 = new mpu6050();
    this.mpu6050.initialize();
    this.mpu6050.setFullScaleAccelRange(0x00);
    //
    this.config.noiseThreshold = this.config.noiseThreshold || 300;
    //
    this.speed = 0;
    //
    if (this.config.logfile) this.stream = fs.createWriteStream(this.config.logfile);
  }
  _isNoise(s) {
    return Math.abs(s) < this.config.noiseThreshold;
  }
  async setXAccelOffset(offset) {
    return new Promise((resolve, reject) => {
      this.mpu6050.setXAccelOffset(this.config.offsetX, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
  async getAcceleration() {
    return new Promise((resolve, reject) => {
      this.mpu6050.getAcceleration((err, data) => {
        if (err) return reject(err);
        resolve(data);        
      });
    });
  }
  async _readAcceleration() {
    const tt = new Date().getTime();
    const data = await this.getAcceleration();
    //
    const s = data[this.config.speedAxis];
    this.speed = this.speed + (!this._isNoise(s) ? s : 0);
    if (this.stream) this.stream.write(`${tt}\t${data[0]}\t${data[1]}\t${data[2]}\t${this.speed}\n`.replace(/\./,','));
  }
  async start() {
    this.running = true;
    if (this.config.offsetX) await this.setXAccelOffset(this.config.offsetX);
    while (this.running) {
      await this._readAcceleration();
    }
  }
  update() {
    this._readAcceleration();
  }
  getSpeed() {
    return this.speed;
  }
}

module.exports = { SpeedController };
