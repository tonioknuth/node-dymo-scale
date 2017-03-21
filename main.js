var usb = require('usb');
module.exports = class DymoScale {
    constructor(stream,sensitivity) {
        this.weight = 0;
        this.stream = stream;
        this.weight_cache = [];
        this.sensitvity = sensitivity || 5
        this.is_connected = false
    }
    launch(){
      this.connect()
      this.startInputStream()
      this.attachListeners();
    }
    tryReconnecting(){
      this.is_connected = false;
      setTimeout(()=>{
        if(this.connect()){
          this.startInputStream();
          this.attachListeners();
        }else{
          this.tryReconnecting();
        }
      },1000);
    }
    connect() {

        var usbdevices = usb.getDeviceList();

        var dymo_devices = usbdevices.filter(function(x){
          return x.deviceDescriptor.idVendor === 2338;
        })

        if (dymo_devices.length > 0) {
          try{
            this.device = dymo_devices[0]
            this.device.open()
            this.interface = this.device.interfaces[0];
            //detach from kernel if neccessary
            if(this.interface.isKernelDriverActive()){
              this.interface.detachKernelDriver()
            }
            this.interface.claim()
            //find first input endpoint
            var input_endpoints = this.interface.endpoints.filter(function(x){
              return x.direction === 'in';
            });
            if(input_endpoints.length > 0){
                this.endpoint = input_endpoints[0]
                this.is_connected = true;
                console.log("Dymo Scale connected!");
                return true;
            }else{
              console.log("No accessible input endpoints found");
              return false;
            }
          }catch(e){
            return false;
          }

        } else {
            console.log("No Dymo Scale found!");
            return false;
        }
    }
    startInputStream() {
        if (this.is_connected) {
            this.endpoint.startPoll(8,64);
        } else {
            console.log("No device connected!")
        }
    }
    attachListeners(){
      if(this.is_connected){
      this.endpoint.on("data", function(data) {
          let weight = this.convertData(data)
          if(weight == 0){
            this.stream.emit('weight_null',weight);
          }else{
            if(this.weight_cache.length <= this.sensitvity){
              this.weight_cache.push(weight)
            }else{
              let first_element = this.weight_cache.shift();
              this.weight_cache.push(weight)
              let weight_stabilized = true;
              for (var element of this.weight_cache){
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
      //error handler
      this.endpoint.on("error",(err)=>{
        console.log(err);
        this.tryReconnecting();
      });
      }
    }
    stopInputStream() {
        if (this.is_connected) {
            this.endpoint.stopPoll(function(){
              console.log("Stopped input stream");
            });
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
