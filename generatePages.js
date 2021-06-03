const fs = require('fs-extra');
const path = require('path');

const ExternalConfig = require('./generator.config.json');
const GeneratorConfig = Object.assign({
  verbose: true
}, ExternalConfig);

function loggerFactory(enable) { return enable? (...args) => console.log.apply(null, args): () => {}; }
const log = loggerFactory(GeneratorConfig.verbose);

function configurationParsing(config) {
  try {
    const RelativeSourceDirectory = process.argv[2] || config.sourceDirectory;
    if (RelativeSourceDirectory == undefined) throw("Missing SourceDirectory Configuration");
    const SourceDirectory = path.join(__dirname, RelativeSourceDirectory);
    if (!fs.existsSync(SourceDirectory)) throw ("SourceDirectory does not exist.")

    const RelativeOutputDirectory = process.argv[3] || config.outputDirectory;
    if (RelativeOutputDirectory == undefined) throw("Missing OutputDirectory Configuration");
    const OutputDirectory = path.join(__dirname, RelativeOutputDirectory);

    return { SourceDirectory, OutputDirectory };
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

function loadTemplates(templateDirectory) {
  try {
    if (!fs.existsSync(templateDirectory)) throw("SourceDirectory/_templates does not exist.")

    let templates = [];
    directoryItems = fs.readdirSync(templateDirectory);
    directoryItems.forEach(directoryItem => {
      if (!directoryItem.endsWith('.js')) return;
      let templateName = directoryItem.slice(0, -3);
      templates[templateName] = require(path.join(templateDirectory, templateName));
      log(`Loading Template: ${templateName}`);
    })

    return templates;
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

function ReintializeTargetDirectory(sourceDirectory, targetDirectory) {
  if (fs.existsSync(targetDirectory)) {
    log('Removing previous build from target directory');
    fs.rmSync(targetDirectory, {
      recursive: true,
      force: true
    });
  }

  log('Creating target directory and populating with Public');
  fs.copySync(path.join(sourceDirectory, "public"), targetDirectory)
}

function fillTemplate(templates, template, keys = {}) {
  for (const [key, value] of Object.entries(keys)) {
    if (Array.isArray(value)) {
      keys[key] = value.reduce((accumulator, valueEntry) => {
        if (valueEntry.hasOwnProperty("template")) {
          return accumulator + fillTemplate(templates, valueEntry.template, valueEntry.keys);
        } else {
          return accumulator + valueEntry;
        }
      }, "");
    } else {
      if (value.hasOwnProperty("template")) {
        keys[key] = fillTemplate(templates, value.template,  value.keys); 
      }
    }
  }
  
  return templates[template](keys);
}

function* traverseDirectory(directory, ignoreDirectories = []) {
  let directoryItems = fs.readdirSync(directory);
  for (directoryItem of directoryItems) {
    let itemFullPath = path.join(directory, directoryItem);
    if (fs.lstatSync(itemFullPath).isDirectory()) {
      if (ignoreDirectories.some(toIgnore => directoryItem == toIgnore)) continue;
      yield* traverseDirectory(itemFullPath, ignoreDirectories);
    } else {
      yield itemFullPath;
    }
  }
}

function generatePages(config) {
  const { SourceDirectory, OutputDirectory } = configurationParsing(config);
  log(`Page Generation Running.\nSource Directory: ${SourceDirectory}\nOutput Directory: ${OutputDirectory}`);

  const Templates = loadTemplates(path.join(SourceDirectory, '_templates'));
  ReintializeTargetDirectory(SourceDirectory, OutputDirectory);
  
  for (item of traverseDirectory(SourceDirectory, ["_templates", "public"])) {
    if (item.endsWith('.page.json')) {
      let pageJSON = require(item);
      let page = fillTemplate(Templates, pageJSON.template, pageJSON.keys);
      if (GeneratorConfig.development.autoreload) {
        page += '<script src="/reload/reload.js"></script>';
      }
      let pageRelativePath = path.relative(SourceDirectory, item);
      let pageName = pageRelativePath.slice(0, -"page.json".length) + "html";
      let outputPath = path.join(OutputDirectory, pageName);
      fs.writeFileSync(outputPath, page);
    }
  }
}

generatePages(GeneratorConfig);