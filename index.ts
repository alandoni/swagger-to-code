import fs from 'fs';
import YAML from 'yaml';

import Languages from './languages/languages';
import LanguageParser from './parser/language-parser';
import { Configuration } from './configuration';
import ConfigurationFileBuilder from './configuration-file-builder';

class Program {
    
    validateLanguage(language: string): boolean {
        return Languages.ACCEPTED_LANGUAGES.indexOf(language) > -1;
    }

    validateYamlSwaggerFile(yamlObject: any): boolean {
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
    
    processFileWithLanguage(yamlObject: any, configuration: Configuration) {
        Object.entries(configuration.languages).map((language: any) => {
            new LanguageParser().parse(yamlObject, language.language).map((clasz) => {
                const dir = './result';
                if (!fs.existsSync(dir)){
                    fs.mkdirSync(dir);
                }
                fs.writeFileSync(`${dir}/${clasz.fileName}`, clasz.content);
            });
        });
    }

    readFileAndParseYaml(file: string): any {
        const yamlFile = fs.readFileSync(file, 'utf8');
        return YAML.parse(yamlFile);
    }

    runWithConfiguration(configuration: Configuration) {
        let error: string = null;

        const yamlObject = this.readFileAndParseYaml(configuration.swaggerFile);
    
        if (!this.validateYamlSwaggerFile(yamlObject)) {
            error = `Invalid YAML swagger file: ${configuration.swaggerFile}`;
        }

        if (error) {
            console.log(error)
        } else {
            this.processFileWithLanguage(yamlObject, configuration);
        }
    }

    async main() {
        let configuration: Configuration = null;
        try {
            const configurationString = fs.readFileSync(ConfigurationFileBuilder.CONFIGURATION_FILE_PATH, 'utf8');
            configuration = JSON.parse(configurationString);
        } catch (e) {
            configuration = await new ConfigurationFileBuilder().createSettingsFile();
        }
        
        if (configuration) {
            this.runWithConfiguration(configuration);
        }
    }
}

new Program().main();