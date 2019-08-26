# gardenbot


for phone client:

cordova plugin add cordova-plugin-ble-central

for bot, installing on Onion Omega2+

ssh into the Omega2+. default password is "onioneer". hostname after signing into the AP is "omega-xxxx.local" - replace the xxxx with the last for hex chars of the serial number.

you will need to upgrade to at least firmware 0.3, following whatever instructions you find on onion.io. don't forget to remove the downloaded firmware file after upgrading, or the next step will fail because it runs out of space.

install Git and Node

opkg update
opkg install node git git-http ca-bundle node-npm

Clone and install this repository

git clone https://github.com/kaeverens/gardenbot.git
cd gardenbot/bot/
npm update

edit /etc/rc.local and add a command to run the bot at boot. put it before the "exit" line:

cd /root/gardenbot/bot && node node.js &

then make that executable:

chmod +x /etc/rc.local

