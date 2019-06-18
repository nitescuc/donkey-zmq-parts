const zmq = require('zmq')
const publisher = zmq.socket('pub')
const Gpio = require('pigpio').Gpio;
const { RemoteChannel, RemoteSwitchChannel } = require('@nitescuc/rccar-remote-reader');
const { Actuator } = require('@nitescuc/rccar-actuator');

const REMOTE_STEERING_PIN = 17;
const REMOTE_THROTTLE_PIN = 27;
const REMOTE_MODE_PIN = 22;

const ACTUATOR_STEERING = 24;
const ACTUATOR_THROTTLE = 23;

const LED_RED = 16;
const LED_GREEN = 20;
const LED_BLUE = 21;

let mode = 'user';

publisher.bind('tcp://*:5555', function(err) {
    if(err)
        console.log(err)
    else
        console.log('Listening on 5555')
});

const actuatorSteering = new Actuator({
    pin: ACTUATOR_STEERING,
    remapValues: [1000, 1500]
});
const actuatorThrottle = new Actuator({
    pin: ACTUATOR_THROTTLE,
    remapValues: [1200, 1850]
});

const remoteSteering = new RemoteChannel({
    pin: REMOTE_STEERING_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.05,
    callback: (channel, value) => {
        if (mode === 'user') actuatorSteering.setValue(value);
        publisher.send(['remote_steering', value]);
    }
});
const remoteThrottle = new RemoteChannel({
    pin: REMOTE_THROTTLE_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.05,
    callback: (channel, value) => {
        if (mode !== 'user') actuatorThrottle.setValue(value);
        publisher.send(['remote_throttle', value]);
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
