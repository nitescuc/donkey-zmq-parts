const zmq = require('zmq');
const publisher = zmq.socket('pub');
const receiver = zmq.socket('sub');
const Gpio = require('pigpio').Gpio;
const { RemoteChannel, RemoteSwitchChannel } = require('@nitescuc/rccar-remote-reader');
const { Actuator } = require('@nitescuc/rccar-actuator');
const { Config } = require('./src/config');
const { LedDisplay } = require('./src/led');

const REMOTE_STEERING_PIN = 17;
const REMOTE_THROTTLE_PIN = 27;
const REMOTE_MODE_PIN = 22;

const ACTUATOR_STEERING = 24;
const ACTUATOR_THROTTLE = 23;

const LED_RED = 16;
const LED_GREEN = 21;
const LED_BLUE = 20;

const config = Config.getConfig();

let mode = 'user';

publisher.bind('tcp://*:5555', function(err) {
    if(err)
        console.log(err)
    else
        console.log('Listening on 5555')
});

const ledDisplay = new LedDisplay({
    redPin: LED_RED,
    greenPin: LED_GREEN,
    bluePin: LED_BLUE
});

const actuatorSteering = new Actuator({
    pin: ACTUATOR_STEERING,
    remapValues: [1000, 2000]
});
const actuatorThrottle = new Actuator({
    pin: ACTUATOR_THROTTLE,
    remapValues: [1200, 1850]
});

const setSteeringFromRemote = (value) => {
    if (mode === 'user') {
        actuatorSteering.setValue(value);
        publisher.send(['remote_steering', value]);
    }
}
const setSteeringFromZmq = (value) => {
    if (mode !== 'user') {
        actuatorSteering.setValue(value);
    }
}
const setThrottleFromRemote = (value) => {
    if (mode !== 'local') {
        actuatorThrottle.setValue(value);
        publisher.send(['remote_throttle', value]);
    }
}
const setThrottleFromZmq = (value) => {
    if (mode === 'local') {
        actuatorThrottle.setValue(value);
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
    sensitivity: 0.02,
    callback: (channel, value) => {
        setSteeringFromRemote(value);
    }
});
const remoteThrottle = new RemoteChannel({
    pin: REMOTE_THROTTLE_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.02,
    callback: (channel, value) => {
        setThrottleFromRemote(value, true);
    }
});
const remoteMode = new RemoteSwitchChannel({
    pin: REMOTE_MODE_PIN,
    remapValues: [false, true],
    callback: (channel, value) => {
        if (mode !== 'user') mode = value ? 'local' : 'local_angle';
        publisher.send(['remote_mode', value]);
    }
});

// receiver
receiver.connect(config.get('actuator.emitter'));
receiver.subscribe('actuator');
receiver.on('message', (topic, steering, throttle, mode) => {
    setSteeringFromZmq(parseFloat(steering.toString()));
    setThrottleFromZmq(parseFloat(throttle.toString()));
    setMode(mode.toString());
});

const updateLed = () => {
    ledDisplay.update(mode, actuatorThrottle.getValue());
}
setInterval(updateLed, 1000);
