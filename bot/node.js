var state=0, state_led=false;
var gpio={
	motor:{
		left:{
			backward:35,
			forward:37
		},
		right:{
			backward:36,
			forward:38
		}
	},
	led:12
};

// { functions
function bytesToString(buffer) {
	return String.fromCharCode.apply(null, new Uint8Array(buffer));
}
function gpioset(num, val) {
	console.log(num, ' ', val);
	rpio.open(num, rpio.OUTPUT, rpio.PULL_UP);
	rpio.write(num, val?rpio.HIGH:rpio.LOW);
}
// }
// { load libraries
var rpio=require('rpio');
var bleno = require('bleno');
var BlenoPrimaryService = bleno.PrimaryService;
var util = require('util');
// }
// { set up bluetooth
var BlenoCharacteristic = bleno.Characteristic;
var EchoCharacteristic = function() {
  EchoCharacteristic.super_.call(this, {
    uuid: 'ec0e',
    properties: ['read', 'write', 'notify'],
    value: null
  });
  this._value = new Buffer(0);
  this._updateValueCallback = null;
};
util.inherits(EchoCharacteristic, BlenoCharacteristic);
EchoCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
  this._value = data;
	state=1;
  console.log('EchoCharacteristic - onWriteRequest: value = ' + this._value.toString('hex'));
	var command=bytesToString(this._value);
	console.log(command);
	handleCommand(command);
  if (this._updateValueCallback) {
    console.log('EchoCharacteristic - onWriteRequest: notifying');
    this._updateValueCallback(this._value);
  }

  callback(this.RESULT_SUCCESS);
};
bleno
	.on('stateChange', function(state) {
		console.log('on -> stateChange: ' + state);
		if (state === 'poweredOn') {
			bleno.startAdvertising('gardenbot', ['ec00']);
		}
		else {
			bleno.stopAdvertising();
		}
	})
	.on('advertisingStart', function(error) {
		console.log('on -> advertisingStart: '
			+ (error ? 'error ' + error : 'success'));
		if (!error) {
			bleno.setServices([
				new BlenoPrimaryService({
					uuid: 'ec00',
					characteristics: [
						new EchoCharacteristic()
					]
				})
			]);
		}
	});
// }
// { setup status light
function showStatus() {
	switch (state) {
		case 0: // { offline - show blinky LED
			state_led=!state_led;
			gpioset(gpio.led, state_led);
		break; // }
		case 1: // { online - show solid LED
			if (!state_led) {
				state_led=true;
				gpioset(gpio.led, state_led);
			}
		break; // }
	}
	setTimeout(showStatus, 500);
}
showStatus();
// }
// { motor control
function motorRight() {
	gpioset(gpio.motor.left.backward, false);
	gpioset(gpio.motor.left.forward, true);
	gpioset(gpio.motor.right.backward, true);
	gpioset(gpio.motor.right.forward, false);
}
function motorLeft() {
	gpioset(gpio.motor.left.backward, true);
	gpioset(gpio.motor.left.forward, false);
	gpioset(gpio.motor.right.backward, false);
	gpioset(gpio.motor.right.forward, true);
}
function motorForward() {
	gpioset(gpio.motor.left.backward, false);
	gpioset(gpio.motor.left.forward, true);
	gpioset(gpio.motor.right.backward, false);
	gpioset(gpio.motor.right.forward, true);
}
function motorBackward() {
	gpioset(gpio.motor.left.backward, true);
	gpioset(gpio.motor.left.forward, false);
	gpioset(gpio.motor.right.backward, true);
	gpioset(gpio.motor.right.forward, false);
}
function motorOff() {
	gpioset(gpio.motor.left.backward, false);
	gpioset(gpio.motor.left.forward, false);
	gpioset(gpio.motor.right.backward, false);
	gpioset(gpio.motor.right.forward, false);
}
// }
function handleCommand(command) {
	switch(command) {
		case 'back':
			motorBackward();
		break;
		case 'left':
			motorLeft();
		break;
		case 'forward':
			motorForward();
		break;
		case 'right':
			motorLeft();
		break;
		case 'stop':
			motorOff();
		break;
	}
}
