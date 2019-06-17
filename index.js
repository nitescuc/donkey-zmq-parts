const zmq = require('zmq')
const publisher = zmq.socket('pub')
const Gpio = require('pigpio').Gpio;
const { RemoteChannel, RemoteSwitchChannel } = require('rccar-remote-reader');

const STEERING_PIN = 17;
const THROTTLE_PIN = 27;
const MODE_PIN = 22;

publisher.bind('tcp://*:5555', function(err) {
    if(err)
        console.log(err)
    else
        console.log('Listening on 5555')
});

const steering = new RemoteChannel({
    pin: STEERING_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.05,
    callback: (channel, value) => publisher.send(['remote_steering', value])
});
const throttle = new RemoteChannel({
    pin: THROTTLE_PIN,
    remapValues: [-1, 1],
    sensitivity: 0.05,
    callback: (channel, value) => publisher.send(['remote_throttle', value])
});
const mode = new RemoteSwitchChannel({
    pin: MODE_PIN,
    remapValues: [false, true],
    callback: (channel, value) => publisher.send(['remote_mode', value])
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
