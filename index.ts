import YAML from 'yaml';
import fs from 'fs';

import Languages from './languages/languages';
import LanguageParser from './parser/language-parser';
import StringUtils from './string-utils';
import { LanguageSettings, Configuration } from './configuration';

class Program {

    validateLanguage(language: string): boolean {
        return Languages.ACCEPTED_LANGUAGES.indexOf(language) > -1;
    }
    
    readFileAndParseYaml(file: string): any {
        const yamlFile = fs.readFileSync(file, 'utf8');
        return YAML.parse(yamlFile);
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

    runWithConfiguration(configuration: Configuration) {
        let error: string = null;

        const yamlObject1 = this.readFileAndParseYaml(configuration.swaggerFile);
    
        if (!this.validateYamlSwaggerFile(yamlObject1)) {
            error = `Invalid YAML swagger file: ${configuration.swaggerFile}`;
        }

        if (error) {
            console.log(error)
        } else {
            this.processFileWithLanguage(yamlObject1, configuration);
        }
    }

    async makeQuestionsForLanguage(language: String): Promise<LanguageSettings> {
        const languageSettings = new LanguageSettings(language);

        if (language === Languages.KOTLIN) {
            languageSettings.mainPackage = await StringUtils.readln('Specify the main package of the project');
        }

        languageSettings.rootProjectDirectory = await StringUtils.readln('Specify the root folder of the project');
        languageSettings.modelClassesModule = await StringUtils.readln('If your models will be in a separated module, specify it');

        const defaultModelPackage = `${languageSettings.mainPackage}.${languageSettings.modelClassesModule}.models`;

        if (language === Languages.KOTLIN) {
            languageSettings.modelClassesPackage = await StringUtils.readln(`Specify the package for your models (default is "${defaultModelPackage}")`);
            if (languageSettings.modelClassesPackage.length === 0) {
                languageSettings.modelClassesPackage = defaultModelPackage;
            }
        }

        languageSettings.modelClassesInheritsFrom = await StringUtils.readln(`Specify the class your models inherits from if needed`);

        let specifiedInterface = null;
        console.log('Now, if needed, you can specify the interfaces your models implement');
        while (specifiedInterface === null || specifiedInterface.length > 0) {
            specifiedInterface = await StringUtils.readln(`Add an interface`);

            if (specifiedInterface.length > 0) {
                languageSettings.modelClassesImplementsInterfaces.push(specifiedInterface);
            }
        }

        languageSettings.databaseClassesModule = await StringUtils.readln('If your database classes will be in a separated module, specify it');

        const defaultDatabaseClassPackage = `${languageSettings.mainPackage}.${languageSettings.databaseClassesModule}.database`;

        if (language === Languages.KOTLIN) {
            languageSettings.databaseClassesPackage = await StringUtils.readln(`Specify the package for your database classes (default is "${defaultDatabaseClassPackage}")`);
            if (languageSettings.databaseClassesPackage.length === 0) {
                languageSettings.databaseClassesPackage = defaultDatabaseClassPackage;
            }
        }
        languageSettings.databaseClassesInheritsFrom = await StringUtils.readln(`Specify the class your database classes inherits from if needed`);
        specifiedInterface = null;
        console.log('Now, if needed, you can specify the interfaces your database classes implement');
        while (specifiedInterface === null || specifiedInterface.length > 0) {
            specifiedInterface = await StringUtils.readln(`Add an interface`);

            if (specifiedInterface.length > 0) {
                languageSettings.databaseClassesImplementsInterfaces.push(specifiedInterface);
            }
        }
        return languageSettings;
    }

    async createSettingsFile(): Promise<Configuration> {
        const swaggerPath = 'C:\\Users\\Alan\\Documents\\swagger.yaml';//await StringUtils.readln('Specify the path for swagger file');
        const obj = this.readFileAndParseYaml(swaggerPath);

        if (!obj) {
            console.log('File not found');
            return null;
        }
        if (!this.validateYamlSwaggerFile(obj)) {
            console.log('Invalid YAML');
            return null;
        }

        const configuration = new Configuration();
        configuration.swaggerFile = swaggerPath;

        const possibleLanguages = [...Languages.ACCEPTED_LANGUAGES];
        let selection = -1;
        do {
            console.log('Select a language from the list to start setting up:');
            for (let i = 0; i < possibleLanguages.length; i++) {
                console.log(`${i} - ${possibleLanguages[i]}`);
            }
            const canLeave = possibleLanguages.length < Languages.ACCEPTED_LANGUAGES.length;
            if (canLeave) {
                console.log(`OR type ${possibleLanguages.length} to FINISH`);
            }
            selection = Number.parseInt(await StringUtils.readln(`Select a number from 0 to ${possibleLanguages.length - 1 + (canLeave ? 1 : 0)}`));

            if (selection < possibleLanguages.length - 1) {
                const selectedLanguage = possibleLanguages[selection];
                possibleLanguages.splice(selection, 1);
                const settings = await this.makeQuestionsForLanguage(selectedLanguage);
                configuration.languages.se  t(selectedLanguage, settings);
                console.log(JSON.stringify(configuration.languages));
            }
        } while (possibleLanguages.length > 0 && selection < possibleLanguages.length - 1);

        const configurationString = JSON.stringify(configuration);

        fs.writeFileSync(`stcconfig.json`, configurationString);

        return configuration;
    }

    async main() {
        let configuration: Configuration = null;
        try {
            const configurationString = fs.readFileSync(`stcconfig.json`, 'utf8');
            configuration = JSON.parse(configurationString);
        } catch (e) {
            configuration = await this.createSettingsFile();
        }
        
        if (configuration) {
            this.runWithConfiguration(configuration);
        }
    }
}

new Program().main();