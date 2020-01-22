const config = require('config');
const EventEmitter = require('events');
const mqtt = require('mqtt');

let conf;

class Config extends EventEmitter {
    constructor() {
        super();
        this.overrides = {};
        mqtt.connectAsync(config.get('configServer.mqtt')).then((client) => {
            client.on('message', (topic, payload) => {
                console.log('Received new message', payload.toString());
                try{
                    const newConf = JSON.parse(payload.toString());
                    Object.keys(newConf).forEach(key => this.set(key, newConf[key]));
                } catch(e) {
                    console.error(e);
                }
            });
            client.subscribe(['config']);
        }).catch(e => {
            console.error('Error connecting to mqtt', e);
        });
    }
    static getConfig() {
        if (!conf) conf = new Config();
        return conf;
    }
    get(key) {
        const value = this.overrides[key] || config.get(key);
        console.log(`Config.get key "${key}" value "${value}`);
        return value;
    }
    set(key, value) {
        this.overrides[key] = value;
        this.emit(key, value);                
    }
}

module.exports = { Config }