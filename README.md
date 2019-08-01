# gardenbot


for phone client:

cordova plugin add cordova-plugin-ble-central

for bot:

install Node 8

"npm install" in the "bot" directory

run "sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)" before you run "node node.js"
