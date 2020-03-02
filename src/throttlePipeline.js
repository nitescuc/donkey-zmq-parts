const Controller = require('node-pid-controller');

class ThrottleRewrite {
    constructor(config) {
        this.config = config;
    }

    setSensorTargets(value) {
        this.config.sensorTargets = Object.assign(this.config.sensorTargets, value);
    }

    compute(value) {
        if (value <= 0.4287) return this.config.sensorTargets.slow || 5000;
        else if (value <= 0.7143) return this.config.sensorTargets.medium || 4000;
        else return this.config.sensorTargets.fast || 1000;
    }
}

class ThrottleObstacle {
    constructor(config) {
        this.config = config || {};
        if (!this.config.slowdownLimit) this.slowdownLimit = 100;
        if (!this.config.breakLimit) this.breakLimit = 50;
    }

    setSensorTargets(value) {
        this.config.sensorTargets = Object.assign(this.config.sensorTargets, value);
    }

    setDistance(value) {
        this.distance = value;
    }

    compute(value) {
        if (this.distance < this.breakLimit) return 10000;
        if (this.distance < this.slowdownLimit) return this.config.sensorTargets.slow;
        else return value;
    }
}
class ThrottlePIDSpeed {
    constructor(config) {
        this.config = config || {};
        this.config.pid = this.config.pid || {
            k_p: 0.25,
            k_i: 0.01,
            k_d: 0.01
        };
        this.config.maxThrottle = this.config.maxThrottle || 1;
        this.config.minThrottle = this.config.minThrottle || -1;
        this.controller = new Controller(this.config.pid);
        this.setSensorValue(10000);
    }

    setPid(value) {
        this.config.pid = Object.assign(this.config.pid, value);
    }
    setMinThrottle(value) {
        this.config.minThrottle = value;
    }
    setMaxThrottle(value) {
        this.config.maxThrottle = value;
    }

    setSensorValue(value) {
        if (this.config.sensorMode === 'invert') value = 10000/value;

        this.sensorValue = value;
    }
    compute(value) {
        this.controller.setTarget(10000/value);
        let actuator = this.controller.update(this.sensorValue);

        if (actuator > this.maxThrottle) actuator = this.maxThrottle;
        if (actuator < this.minThrottle) actuator = this.minThrottle;

        return actuator;
    }
}

class ThrottlePipeline {
    constructor(config) {
        this.config = config;
        this.stages = [];
    }

    addStage(stage) {
        this.stages.push(stage);
    }

    compute(value) {
        let output = value;
        for (let stage of this.stages) {
            output = stage.compute(output);
        }

        return output;
    }
}

module.exports = { ThrottleRewrite, ThrottleObstacle, ThrottlePIDSpeed, ThrottlePipeline }