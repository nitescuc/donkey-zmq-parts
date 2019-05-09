const mpu6050 = require('mpu6050');

const pSetTimeout = async (timeout) => {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, timeout);
    });
}

const MPU6050_RA_XA_OFFS_H = 0x06;

mpu6050.prototype.setXAccelOffset = function(offset, cb) {
    const buf = Buffer.allocUnsafe(2);
    buf.writeUInt16BE(offset);
    this.i2cdev.writeBytes(MPU6050_RA_XA_OFFS_H, [...buf], cb);    
}
class Calibrate {
    constructor() {
        this.mpu6050 = new mpu6050();
        this.mpu6050.initialize();
        this.bufferSize = 1000;
        this.accelDeathZone = 8;
    }
    async readAcceleration() {
        return new Promise((resolve, reject) => {
            this.mpu6050.getAcceleration((err, data) => {
                if (err) return reject(err);
                //
                resolve(data);
            });
        });
    }
    async setXAccelOffset(offset) {
        return new Promise((resolve, reject) => {
            this.mpu6050.setXAccelOffset(offset, (err, data) => {
                if (err) return reject(err);
                //
                resolve(data);
            });
        });
    }
    async meanSensors(samples) {
        let total = 0;
        for (let i = 0; i < samples; i++) {
            total += (await this.readAcceleration())[0];
            await pSetTimeout(1);
        }
        return total / samples;
    }
    async calibrate() {
        await this.setXAccelOffset(0);
        // let go 100 samples
        await this.meanSensors(100);
        // read 1000 samples
        let mean_ax = await this.meanSensors(this.bufferSize);
        // 
        let loops = 100;
        let ax_offset = -Math.round(mean_ax/this.accelDeathZone);
        while (loops--) {
            console.log('Setting offset', ax_offset);
            //
            await this.setXAccelOffset(ax_offset);
            mean_ax = await this.meanSensors(this.bufferSize);
            //
            if (Math.abs(mean_ax) <= this.accelDeathZone) break;
            else ax_offset = Math.round(ax_offset - mean_ax / this.accelDeathZone);
        }
        return ax_offset;
    }
}

new Calibrate().calibrate().then().catch((e) => console.error);