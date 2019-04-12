const zmq = require('zmq')
const publisher = zmq.socket('pub')

const { SonarGroup } = require('./parts/hc-sr04');
const { SpeedController } = require('./parts/speed');

const sonarGroup = new SonarGroup({
    triggerPin: 18,
    pwmTimerPin: 21,
    sonars: [{
        echoPin: 14
    }, {
        echoPin: 15
    }]
});
sonarGroup.start();

const speedController = new SpeedController({
    pwmTimerPin: 22,
    speedAxis: 0
})
publisher.bind('tcp://*:5555', function(err) {
    if(err)
        console.log(err)
    else
        console.log('Listening on 5555')
});

setInterval(() => {
	const distances = sonarGroup.read();
	publisher.send(['distance', ...distances, speedController.getSpeed(), new Date().getTime()]);
}, 1000);
