const zmq = require('zmq')
const publisher = zmq.socket('pub')

const { SonarGroup } = require('./parts/hc-sr04');

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

publisher.bind('tcp://*:5555', function(err) {
  if(err)
    console.log(err)
  else
    console.log('Listening on 5563…')
});

setInterval(() => {
	const distances = sonarGroup.read();
//	publisher.send('distance', zmq.ZMQ_SNDMORE);
//	publisher.send(distances);
	publisher.send(['distance', ...distances, new Date().getTime()]);
	console.log(distances);
}, 1000);
