const Gpio = require('pigpio').Gpio;
const { RemoteChannel, RemoteSwitchChannel } = require('@nitescuc/rccar-remote-reader');
const { Actuator } = require('@nitescuc/rccar-actuator');
const { RpmReader } = require('@nitescuc/brushless-rpm');
const { SonarReader } = require('@nitescuc/rccar-sonar');
const { Config } = require('./src/config');
const { LedDisplay } = require('./src/led');

const { ThrottleRewrite, ThrottleObstacle, ThrottlePIDSpeed, ThrottleReverseProtect, ThrottlePipeline } = require('./src/throttlePipeline');

const dgram = require('dgram');
const mqtt = require('mqtt');

const config = Config.getConfig();

const REMOTE_STEERING_PIN = config.get('hardware.REMOTE_STEERING_PIN');
const REMOTE_THROTTLE_PIN = config.get('hardware.REMOTE_THROTTLE_PIN');
const REMOTE_MODE_PIN = config.get('hardware.REMOTE_MODE_PIN');

const SONAR_TRIGGER = config.get('hardware.SONAR_TRIGGER');
const SONAR_ECHO = config.get('hardware.SONAR_ECHO');

const ACTUATOR_STEERING = 24;
const ACTUATOR_THROTTLE = 23;

const RPM_POWER_PIN = 26;
const RPM_DATA_PIN = 19;

let mode = 'user';
let rpm = 10000;
let distance = null;

const remoteSocket = dgram.createSocket('udp4');
const remote_server_port = config.get('remote.server_port');
const remote_server_addr = config.get('remote.server_address');

const ledDisplay = new LedDisplay({
    redPin: config.get('hardware.LED_RED'),
    greenPin: config.get('hardware.LED_GREEN'),
    bluePin: config.get('hardware.LED_BLUE')
});

const actuatorSteering = new Actuator({
    pin: ACTUATOR_STEERING,
    remapValues: [1000, 2000],
    trim: config.get('actuator.trim')
});
const actuatorThrottle = new Actuator({
    pin: ACTUATOR_THROTTLE,
    remapValues: [config.get('actuator.min_pulse'), config.get('actuator.max_pulse')],
//    sensorTargets: Object.assign({}, config.get('actuator.sensor_targets') || {}),
//    throttleRewrite: Object.assign({}, config.get('actuator.throttle_rewrite') || {}),
//    breakIntensity: config.get('actuator.break_intensity'),
//    sensorMode: config.get('actuator.sensor_mode')
});

const throttleRewrite = new ThrottleRewrite({
    sensorTargets: Object.assign({}, config.get('throttle.sensor_targets') || {})
});
const throttleObstacle = new ThrottleObstacle({
    sensorTargets: Object.assign({}, config.get('throttle.sensor_targets') || {}),
    slowdownLimit: config.get('sonar.slowdown_limit'),
    breakLimit: config.get('sonar.break_limit')
});
const throttlePID = new ThrottlePIDSpeed({
    sensorMode: config.get('throttle.sensor_mode'),
    pid: config.get('throttle.pid'),
    maxThrottle: config.get('throttle.max_throttle'),
    minThrottle: config.get('throttle.min_throttle')
});
const throttleReverseProtect = new ThrottleReverseProtect();
const throttlePipeline = new ThrottlePipeline();
throttlePipeline.addStage(throttleRewrite);
throttlePipeline.addStage(throttleObstacle);
throttlePipeline.addStage(throttlePID);
throttlePipeline.addStage(throttleReverseProtect);

if (SONAR_TRIGGER) {
    const sonar = new SonarReader({
        triggerPin: SONAR_TRIGGER,
        echoPin: SONAR_ECHO
    });
    sonar.on('distance', dist => {
        distance = dist;
        throttleObstacle.setDistance(distance);
    })
    setInterval(() => sonar.update(), 50);
}

const setSteeringFromRemote = (value) => {
    if (mode === 'user') {
        actuatorSteering.setValue(value);
        remoteSocket.send(`st;${parseFloat(value).toFixed(4)}`, remote_server_port, remote_server_addr, err => {
            if(err) console.error(err);
        });
    }
    if (!REMOTE_MODE_PIN && (Math.abs(value) > 0.5)) {
        changeMode(value > 0);
    }
}
const setSteeringFromMessage = (value) => {
    if (mode !== 'user') {
        actuatorSteering.setValue(value);
    }
}
const setThrottleFromRemote = (value) => {
    if (mode !== 'local') {
        actuatorThrottle.setValue(value);
        remoteSocket.send(`th;${parseFloat(value).toFixed(4)}`, remote_server_port, remote_server_addr, err => {
            if (err) console.error(err);
        });
    }
}
const changeMode = value => {
    if (mode !== 'user') {
        if (value) {
            mode = 'local';
        } else {
            mode = 'local_angle';
            actuatorThrottle.stop(() => { setThrottleFromRemote(0); })
            setThrottleFromRemote(0);
        }
    }
    remoteSocket.send(`md;${mode}`, remote_server_port, remote_server_addr, err => {
        if (err) console.error(err);
    });
}
const setThrottleFromMessage = (value) => {
    if (mode === 'local') {
        //actuatorThrottle.setValue(value);
        actuatorThrottle.setValue(throttlePipeline.compute(value));
    }
}
const setMode = (value) => {
    if ((value === 'local_angle' || value === 'local') && mode === 'user') {
        mode = 'local_angle';
    }
    if (mode !== 'user' && value === 'user') {
        mode = 'user';
    }
}

const remoteSteering = new RemoteChannel({
    pin: REMOTE_STEERING_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.015,
    callback: (channel, value) => {
        setSteeringFromRemote(value);
    }
});
const remoteThrottle = new RemoteChannel({
    pin: REMOTE_THROTTLE_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.015,
    callback: (channel, value) => {
        setThrottleFromRemote(value);
    }
});
if (REMOTE_MODE_PIN) {
    const remoteMode = new RemoteSwitchChannel({
        pin: REMOTE_MODE_PIN,
        remapValues: [false, true],
        callback: (channel, value) => {
            changeMode(value);
        }
    });
}


const actuatorServer = dgram.createSocket('udp4');
actuatorServer.on('listening', () => {
    const address = actuatorServer.address();
    console.log(`actuatorServer listening ${address.address}:${address.port}`);
});
actuatorServer.on('error', (err) => {
    console.log(`actuatorServer error:\n${err.stack}`);
    actuatorServer.close();
});
actuatorServer.on('message', (msg, rinfo) => {
    const parts = msg.toString().split(';');
    parts[0] && setSteeringFromMessage(parseFloat(parts[0]));
    parts[1] && setThrottleFromMessage(parseFloat(parts[1]));
    parts[2] && setMode(parts[2]);
});
actuatorServer.bind(config.get('actuator.server_port'));

const rpmReader = new RpmReader({
    pin: RPM_DATA_PIN,
    powerPin: RPM_POWER_PIN,
    callback: (channel, value) => {
        rpm = value;
        //actuatorThrottle.setSensorValue(rpm);
        throttlePID.setSensorValue(rpm);
    }
});

config.on('min_pulse', value => actuatorThrottle.setRemapMinValue(value));
config.on('max_pulse', value => actuatorThrottle.setRemapMaxValue(value));
config.on('actuator_trim', value => actuatorSteering.setTrimValue(value));
config.on('actuator_sensor_targets', value => {
    throttleRewrite.setSensorTargets(value);
    throttleObstacle.setSensorTargets(value);
});
config.on('throttle_pid', value => throttlePID.setPid(value));
config.on('throttle_max_throttle', value => throttlePID.setMaxThrottle(value));
config.on('throttle_min_throttle', value => throttlePID.setMinThrottle(value));

// debug messages
const mqttClient = mqtt.connect(config.get('configServer.mqtt'));
mqttClient.on('error', e => {
    console.error('MQTT error', e);
});

const updateLed = () => {
    ledDisplay.update(mode, actuatorThrottle.getValue());
    mqttClient.publish('status/devices', JSON.stringify({
        distance,
        mode,
        rpm
    }))
}
setInterval(updateLed, 1000);