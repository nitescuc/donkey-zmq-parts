const SonarGroup = require('./parts/hc-sr04');

const sonarGroup = new SonarGroup({
    triggerPin: 21,
    pwmTimerPin: 22,
    sonars: [{
        echoPin: 23
    }, {
        echoPin: 24
    }]
});

sonarGroup.start();

setInterval(() => console.log(sonarGroup.read()), 1000);