const config = require('config');

let conf;

class Config {
    constructor() {
        this.overrides = {};
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
    }
}

module.exports = { Config }