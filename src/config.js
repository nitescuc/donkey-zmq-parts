const config = require('config');
const EventEmitter = require('events');
const zmq = require('zmq');
const receiver = zmq.socket('sub');

let conf;

class Config extends EventEmitter {
    constructor() {
        this.overrides = {};
        receiver.connect(config.get('configServer.emitter'));
        receiver.subscribe('config');
        receiver.on('message', (topic, message) => {
            try{
                const newConf = JSON.parse(message);
                Object.keys(newConf).forEach(key => this.set(key, newConf[key]));
            } catch(e) {
                console.error(e);
            }
        });
    }
    static getConfig() {
        if (!conf) conf = new Config();
        return conf;
    }
    get(key) {
        return this.overrides[key] || config.get(key);
    }
    set(key, value) {
        this.overrides[key] = value;
        this.emit(key, value);                
    }
}

module.exports = { Config }