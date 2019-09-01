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
	if (photoLock && photoLock>(+(new Date))-10000) {
		return;
	}
	photoLock=+(new Date);
	
	exec("fswebcam -d /dev/video0 -q --no-banner --save '-' | base64", function(err, stdout, stderr) {
		if (err) {
			photoLock=0;
			return;
		}
		var hash=crypto
			.createHash('md5')
			.update(stdout)
			.digest('hex');
		if (hash===lastUploadedGrab) {
			photoLock=0;
			clearTimeout(grabPhotoTimeout);
			grabPhotoTimeout=setTimeout(grabPhoto, 1000);
			return;
		}
		lastUploadedGrab=hash;
		ajax('/upload-image.php', {
			mac:bot.mac,
			data:stdout
		}, ret=>{
			photoLock=0;
			grabPhoto();
		});
	});
}
