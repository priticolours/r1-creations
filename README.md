# r1 creations

my rabbit r1 creations.

- hungry-fed-tracker — hungry/fed status tracker, built for the r1's screen

## workflow

1. scaffold: `sh new-creation.sh <name> [description]`
2. build it with Hermes Agent
3. commit + push
4. make sure it's deployed to your public host
5. open the hosted `install.html` on your mac, scan the QR with the r1 camera

## reference

- creations sdk: https://github.com/rabbit-hmi-oss/creations-sdk
- examples: https://github.com/andr3w-hilton/rabbit-r1-creations-public

apps are 240x282 static pages, loaded from a public URL every launch. data stays in localStorage on the device.
