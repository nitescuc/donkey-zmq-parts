const Gpio = require('pigpio').Gpio;
const { RemoteChannel, RemoteSwitchChannel } = require('@nitescuc/rccar-remote-reader');
const { Actuator } = require('@nitescuc/rccar-actuator');
const { RpmReader } = require('@nitescuc/brushless-rpm');
const { Config } = require('./src/config');
const { LedDisplay } = require('./src/led');
const dgram = require('dgram');

const REMOTE_STEERING_PIN = 17;
const REMOTE_THROTTLE_PIN = 27;
const REMOTE_MODE_PIN = 22;

const ACTUATOR_STEERING = 24;
const ACTUATOR_THROTTLE = 23;

const RPM_POWER_PIN = 26;
const RPM_DATA_PIN = 19;

const LED_RED = 16;
const LED_GREEN = 21;
const LED_BLUE = 20;

const config = Config.getConfig();

let mode = 'user';

const remoteSocket = dgram.createSocket('udp4');
const remote_server_port = config.get('remote.server_port');
const remote_server_addr = config.get('remote.server_address');

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
    remapValues: [config.get('actuator.min_pulse'), config.get('actuator.max_pulse')],
    sensorMode: 'invert',
    remapPIDMax: 1500
});

const setSteeringFromRemote = (value) => {
    if (mode === 'user') {
        actuatorSteering.setValue(value);
        remoteSocket.send(`st;${parseFloat(value).toFixed(8)}`, remote_server_port, remote_server_addr, err => {
            if(err) console.error(err);
        });
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
        remoteSocket.send(`th;${parseFloat(value).toFixed(8)}`, remote_server_port, remote_server_addr, err => {
            if (err) console.error(err);
        });
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
        setThrottleFromRemote(value);
    }
});
const remoteMode = new RemoteSwitchChannel({
    pin: REMOTE_MODE_PIN,
    remapValues: [false, true],
    callback: (channel, value) => {
        if (mode !== 'user') {
            if (value) {
                mode = 'local';
            } else {
                mode = 'local_angle';
                setThrottleFromRemote(0);
            }
        }
        remoteSocket.send(`md;${mode}`, remote_server_port, remote_server_addr, err => {
            if (err) console.error(err);
        });        
    }
});


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
    parts[0] && setSteeringFromZmq(parseFloat(parts[0]));
    parts[1] && setThrottleFromZmq(parseFloat(parts[1]));
    parts[2] && setMode(parts[2]);
});
actuatorServer.bind(config.get('actuator.server_port'));

const rpmReader = new RpmReader({
    pin: RPM_DATA_PIN,
    powerPin: RPM_POWER_PIN,
    callback: (channel, value) => {
        actuatorThrottle.setSensorValue(value);
    }
});

config.on('max_pulse', value => actuatorThrottle.setMaxRemapValue(value));

const updateLed = () => {
    ledDisplay.update(mode, actuatorThrottle.getValue());
}
let cnt = 0;
setInterval(() => {
    actuatorThrottle.updatePID();
    if (cnt++ > 10) {
        updateLed();
        cnt = 0;
    }
}, 100);
