const crypto = require('crypto')
const fs=require('fs');
const { exec } = require('child_process');

var https = require('https');
var querystring=require('querystring');

const GPIO_TIMEOUT=3000;
const BOTHUB_HOST='bot.verens.com';
const BOTHUB_PORT=443;
const gpio={
	motor:{
		left:{
			a:11,
			b:17
		},
		right:{
			a:16,
			b:15
		}
	},
	led:12
};
var bot={
};

exec("ifconfig | grep 'eth0 ' | cut -d ' ' -f 11", (err, stdout, stderr)=>{
	var mac=stdout.trim();
	if (mac.length!=17) {
		console.log('failed to retrieve MAC');
		console.log(mac);
		return;
	}
	ajax('/register.php', {
		mac:mac
	}, ret=>{
		bot.id=ret.id;
		bot.mac=mac;
		setTimeout(grabPhoto, 1000);
		bot.last_cmd=0;
		setInterval(cmdPoll, 1000);
	});
});
var cmdPollLock=0;
function cmdPoll() {
	if (cmdPollLock) {
		return;
	}
	var t= +(new Date);
	cmdPollLock=t;
	ajax('/bot-getCommands.php', {
		bot_id:bot.id,
		bot_mac:bot.mac,
		last_cmd:bot.last_cmd
	}, ret=>{
		console.log(ret);
		cmdPollLock=0;
		ret.cmds.forEach(cmd=>{
			if (cmd.id<bot.last_cmd) {
				return;
			}
			bot.last_cmd=cmd.id;
			handleCommand(cmd.cmd);
		});
	});
}
function ajax(url, params, callback) {
	var data=querystring.stringify(params);
	var options={
		hostname:BOTHUB_HOST,
		port:BOTHUB_PORT,
		path:url,
		method:'POST',
		headers:{
			'Content-Type':'application/x-www-form-urlencoded',
			'Content-Length':data.length
		}
	};
	var req=https.request(options,  res=>{
		res.on('data', d=>{
			try {
				var ret=JSON.parse(''+d);
				callback(ret);
			}
			catch(e) {
				return;
			}			
		});
	});
	req.on('error', e=>{
		console.error(e);
	});
	req.write(data);
	req.end();
}
// { functions
var gpiocalls=[]; // used to timeout long-running calls
function gpioset(num, val) {
	val=val?'high':'low';
	if (val=='high') { // timeout active gpio calls, in case the robot gets stuck doing something
		var timeoutNum=(gpiocalls[num]||0)+1;
		gpiocalls[num]=timeoutNum;
		setTimeout(()=>{
			if (gpiocalls[num]==timeoutNum) { // time this gpio call out
				exec('gpioctl dirout-low '+num);
			}
		}, GPIO_TIMEOUT);
	}
	exec('gpioctl dirout-'+val+' '+num, (err, stdout, stderr)=>{
		if (err) {
			return console.log(err);
		}
	});
}
// }
// { motor control
function motorRight() {
	gpioset(gpio.motor.left.a, false);
	gpioset(gpio.motor.left.b, true);
	gpioset(gpio.motor.right.a, true);
	gpioset(gpio.motor.right.b, false);
}
function motorLeft() {
	gpioset(gpio.motor.left.a, true);
	gpioset(gpio.motor.left.b, false);
	gpioset(gpio.motor.right.a, false);
	gpioset(gpio.motor.right.b, true);
}
function motorForward() {
	console.log('motor forward');
	gpioset(gpio.motor.left.a, true);
	gpioset(gpio.motor.left.b, false);
	gpioset(gpio.motor.right.a, true);
	gpioset(gpio.motor.right.b, false);
}
function motorBackward() {
	gpioset(gpio.motor.left.a, false);
	gpioset(gpio.motor.left.b, true);
	gpioset(gpio.motor.right.a, false);
	gpioset(gpio.motor.right.b, true);
}
function motorOff() {
	gpioset(gpio.motor.left.a, false);
	gpioset(gpio.motor.left.b, false);
	gpioset(gpio.motor.right.a, false);
	gpioset(gpio.motor.right.b, false);
}
// }
function handleCommand(command) {
	console.log('command: '+command);
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
			motorRight();
		break;
		case 'stop':
			motorOff();
		break;
	}
}

var bootup_moves=[
	['forward', 2000],
	['left', 2000],
	['forward', 2000],
	['back', 2000],
	['right', 2000],
	['back', 1000],
	['stop', 1]
];

function boot_sequence() {
	var cmd=bootup_moves.shift();
	if (!cmd) {
		return;
	}
	handleCommand(cmd[0]);
	setTimeout(boot_sequence, cmd[1]);
}
boot_sequence();

let photoLock=0;
let grabPhotoTimeout=0;
let lastUploadedGrab=0;
function grabPhoto() {
	clearTimeout(grabPhotoTimeout);
	grabPhotoTimeout=setTimeout(grabPhoto, 11000);
console.log(1);
	if (photoLock && photoLock>(+(new Date))-10000) {
		return;
	}
console.log(2);
	photoLock=+(new Date);
	exec("fswebcam --no-banner -r 800x600 grab.jpg", (err, stdout, stderr)=>{
console.log(3);
		fs.readFile('grab.jpg', (err, data)=>{
console.log(4);
			if (err) {
				photoLock=0;
				return;
			}
console.log(5);
			var base64=data.toString('base64');
			var hash=crypto
				.createHash('md5')
				.update(base64)
				.digest('hex');
			if (hash===lastUploadedGrab) {
console.log('image has not changed');
				photoLock=0;
				clearTimeout(grabPhotoTimeout);
				grabPhotoTimeout=setTimeout(grabPhoto, 1000);
				return;
			}
			lastUploadedGrab=hash;
			delete data;
			ajax('/upload-image.php', {
				mac:bot.mac,
				base64:base64
			}, ret=>{
console.log(6);
				photoLock=0;
				grabPhoto();
			});
		});
	});
}
