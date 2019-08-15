const YAML = require('yaml');
const fs = require('fs');

const acceptedLanguages = require('./languages/languages');
const Parser = require('./parser/language-parser');

function validateLanguage(language) {
    return acceptedLanguages.indexOf(language) > -1;
}

function readFileAndParseYaml(file) {
    const yamlFile = fs.readFileSync(file, 'utf8');
    return YAML.parse(yamlFile);
}

function validateYamlSwaggerFile(yamlObject) {
    return yamlObject.swagger && 
        yamlObject.swagger === '2.0' &&
        yamlObject.info &&
        yamlObject.basePath && 
        yamlObject.tags && 
        yamlObject.tags.length > 0 &&
        yamlObject.paths && 
        Object.entries(yamlObject.paths).length > 0 &&
        yamlObject.definitions && 
        Object.entries(yamlObject.definitions).length > 0;
}

function processFileWithLanguage(yamlObject, language) {
    new Parser().parse(yamlObject, language);
}

function execute(language, file1, file2) {
    let error = null;
    if (!validateLanguage(language)) {
        error = 'Invalid language, choose one of KOTLIN, SWIFT, JAVASCRIPT, TYPESCRIPT';
    }

    const yamlObject1 = readFileAndParseYaml(file1);

    if (!validateYamlSwaggerFile(yamlObject1)) {
        error = `Invalid YAML swagger file: ${file1}`;
    }

    if (file2) {
        const yamlObject2 = readFileAndParseYaml(file2);
        if (!validateYamlSwaggerFile(yamlObject2)) {
            error = `Invalid YAML swagger file: ${file2}`;
        }
    }
    if (error) {
        console.log(error)
    } else {
        processFileWithLanguage(yamlObject1, language);
    }
}

function main(args) {
    let language = '';
    let file1 = '';
    let file2 = '';
    let error = null;

    if (args.length < 4) {
        error = 'Invalid arguments... aborting';
    } else if (args.length >= 4) {
        language = args[2];
        file1 = args[3];
        if (args.length == 5) {
            file2 = args[4];
            error = 'This function is not ready yet, in the future, we will compare 2 files and update the generated code';
        } else if (args.length > 5) {
            error = 'Invalid arguments... aborting';
        }
    }
    if (error) {
        console.log(error);
    } else {
        execute(language, file1, file2);
    }
}

main(process.argv);