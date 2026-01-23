Credit to https://github.com/AkshatOP/Poketwo-Autocatcher

### README

What this repo does is adding something to tailor personal use case

### Feature

- Offline OCR tesseract to detect Poke-Name's pokemon name, no api key needed
- Auto self correction mechanism if OCR go wrong
- Generate random legit word when spaming
- Stop incense when hit captcha

### Usage

1. Invite Poké-Name to your own server https://top.gg/bot/874910942490677270/invite
2. Modify `config.js`, replace `XXXXXXXXX` to your according value
3. `npm clean-install`, install with fix library version avoid version mismatch
4. run with `node index.js` to start the server

### Dependency

1. Node - v22.13.0
2. NPM - 10.9.2

### Limitation

- It is not 100% catcher, it is a progressive learning catcher. When system fail to catch, it self auto learn and note down itself in namefix.json to make next time correct.
