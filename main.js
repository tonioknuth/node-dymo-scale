var HID = require("node-hid");

module.exports = class DymoScale {
    constructor(stream,sensitivity) {
        this.connect();
        this.weight = 0;
        this.stream = stream;
        this.weight_cache = [];
        this.sensitvity = sensitivity || 5
        console.log(this.sensitvity);
    }
    connect() {
        var devices = HID.devices().filter(function(x) {
            return x.manufacturer === "DYMO";
        });

        if (devices.length > 0) {
            this.device = new HID.HID(devices[0].path);
            console.log("Dymo Scale connected!")
        } else {
            console.log("No Dymo Scale found!");
        }
    }
    startInputStream() {
        if (this.device) {
            this.device.on("data", function(data) {
                let weight = this.convertData(data)
                if(weight == 0){
                  this.stream.emit('weight_null',weight);
                }else{
                  if(this.weight_cache.length <= this.sensitvity){
                    this.weight_cache.push(weight)
                  }else{
                    let first_element = this.weight_cache.shift();
                    // console.log(first_element);
                    this.weight_cache.push(weight)
                    let weight_stabilized = true;
                    for (element of this.weight_cache){
                      if(element != first_element) weight_stabilized = false;
                    }
                    if(weight_stabilized){
                      this.stream.emit('weight_stabilized',weight);
                    }
                  }
                }
                this.stream.emit('weight_change',weight);
                this.weight = weight
            }.bind(this))
        } else {
            console.log("No device connected!")
        }
    }
    pause() {
        if (this.device) {
            this.device.pause();
        } else {
            console.log("No device connected!")
        }
    }
    resume() {
        if (this.device) {
            this.device.resume();
        } else {
            console.log("No device connected!")
        }
    }
    convertData(data) {
        var weight = 0;
        var raw = ((256 * data[5]) + data[4]);

        if (data[1] === 4) {
            if (data[2] === 11) {
                weight = parseFloat(raw / 10.0);
                //conversion to gram
                weight = weight * 28.3495
            } else if (data[2] === 2) {
                weight = raw;
            }
        }
        return weight;
    }
}
