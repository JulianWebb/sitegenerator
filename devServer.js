const path = require('path');
const express = require('express');
const app = new express();
const reload = require('reload');

const GeneratorConfig = require('./generator.config.json');
const StaticFolder = path.join(__dirname, process.argv[2] || GeneratorConfig.outputDirectory || './build');
const ListenPort = process.argv[3] || GeneratorConfig.development.port || 3000;
const AutoReload = GeneratorConfig.development.autoreload || true;

app.use(express.static(StaticFolder));

if (AutoReload) {
  reload(app).then(() => {
    app.listen(ListenPort);
    console.log(`Development Server Running at: http://localhost:${ListenPort}`);
    console.log(`AutoReload is enabled`)
  })
} else {
  app.listen(ListenPort);
  console.log(`Development Server Running at: http://localhost:${ListenPort}`);
}