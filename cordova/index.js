window.addEventListener('load', function() {
	var device;
	function stringToBytes(string) {
		var array=new Uint8Array(string.length);
		for (var i=0, l=string.length; i<l; i++) {
			array[i]=string.charCodeAt(i);
		}
		return array.buffer;
	}
	function startScan() {
		if (window.ble===undefined) {
			return setTimeout(startScan, 100);
		}
		ble.startScan(
			[],
			function(founddevice) {
				if (founddevice.name!='gardenbot') {
					return;
				}
				device=founddevice;
				ble.connect(device.id,
					function(e) {
						console.log(e);
						ble.stopScan();
					},
					function(e) {
						console.log(e);
						startScan();
					}
				);
			},
			function(err) {
				console.log(err);
			}
		);
	}
	startScan();
	var btns=document.querySelectorAll('button');
	btns.forEach(function(v,k) {
		v.addEventListener('click', function() {
			var command=this.getAttribute('id');
				ble.write(device.id, 'ec00', 'ec0e', stringToBytes(command),function(e) {
				}, function (e) {
				});
		});
	});
});
