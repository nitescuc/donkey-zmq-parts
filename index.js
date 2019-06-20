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

const setSteering = (value, withSend) => {
    if (mode === 'user') {
        actuatorSteering.setValue(value);
        if (withSend) publisher.send(['remote_steering', value]);
    }
}
const setThrottle = (value, withSend) => {
    if (mode !== 'local') {
        actuatorThrottle.setValue(value);
        if (withSend) publisher.send(['remote_throttle', value]);
    }
    ledDisplay.update(mode, value);
}
const setMode = (value) => {
    if ((value === 'local_angle' || value === 'local') && mode === 'user') {
        mode = 'local_angle';
        ledDisplay.update(mode, actuatorThrottle.getValue());
    }
    if (mode !== 'user' && value === 'user') {
        mode = 'user';
        ledDisplay.update(mode, actuatorThrottle.getValue());
    }
}

const remoteSteering = new RemoteChannel({
    pin: REMOTE_STEERING_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.02,
    callback: (channel, value) => {
        setSteering(value, true);
    }
});
const remoteThrottle = new RemoteChannel({
    pin: REMOTE_THROTTLE_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.02,
    callback: (channel, value) => {
        setThrottle(value, true);
    }
});
const remoteMode = new RemoteSwitchChannel({
    pin: REMOTE_MODE_PIN,
    remapValues: [false, true],
    callback: (channel, value) => {
        if (mode !== 'user') mode = value ? 'local' : 'local_angle';
        ledDisplay.update(mode, actuatorThrottle.getValue());
        publisher.send(['remote_mode', value]);
    }
});

// receiver
receiver.connect(config.get('actuator.emitter'));
receiver.subscribe('actuator');
receiver.on('message', (topic, steering, throttle, mode) => {
    setSteering(parseFloat(steering.toString()));
    setThrottle(parseFloat(throttle.toString()));
    setMode(mode.toString());
});


/*
const { SonarGroup } = require('./parts/hc-sr04');
const { SpeedController } = require('./parts/speed');

const PWM_SONAR = 21;
const PWM_ACCEL = 22;
const PWM_UPDATE = 23;
const SONAR_TRIGGER = 18;
const SONAR_ECHO1 = 14;
const SONAR_ECHO2 = 15;

const sonarGroup = new SonarGroup({
    triggerPin: SONAR_TRIGGER,
    pwmTimerPin: PWM_SONAR,
    frequency: 100,
    sonars: [{
        echoPin: SONAR_ECHO1
    }, {
        echoPin: SONAR_ECHO2
    }]
});
//sonarGroup.start();

const speedController = new SpeedController({
    speedAxis: 0,
    offsetX: 147,
    noiseThreshold: 150,
    logfile: __dirname + '/../' + new Date().toISOString()
});
speedController.start();

const pwmTimer = new Gpio(PWM_UPDATE, {mode: Gpio.OUTPUT, edge: Gpio.RISING_EDGE});
pwmTimer.on('interrupt', (level, tick) => {
//    speedController.update();
    sonarGroup.update();
});
pwmTimer.pwmFrequency(50);
pwmTimer.pwmWrite(128);


setInterval(() => {
    publisher.send(['distance', ...(sonarGroup.read())]);
    publisher.send(['speed', speedController.getSpeed()]);
}, 30);

*/
