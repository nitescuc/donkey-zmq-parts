const zmq = require('zmq')
const publisher = zmq.socket('pub')
const Gpio = require('pigpio').Gpio;

const { SonarGroup } = require('./parts/hc-sr04');
const { SpeedController } = require('./parts/speed');

const PWM_SONAR = 21;
const PWM_ACCEL = 22;
const PWM_PUBLISH = 23;
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
sonarGroup.start();

const speedController = new SpeedController({
    pwmTimerPin: PWM_ACCEL,
    frequency: 1000,
    speedAxis: 0,
    logfile: __dirname + '/../' + new Date().toISOString()
});
speedController.start();

publisher.bind('tcp://*:5555', function(err) {
    if(err)
        console.log(err)
    else
        console.log('Listening on 5555')
});

const pwmTimer = new Gpio(PWM_PUBLISH, {mode: Gpio.OUTPUT, edge: Gpio.RISING_EDGE});
pwmTimer.on('interrupt', (level, tick) => {
	const distances = sonarGroup.read();
    publisher.send(['distance', ...distances]);
    publisher.send(['speed', speedController.getSpeed()]);
});
pwmTimer.pwmFrequency(40);
pwmTimer.pwmWrite(128);
