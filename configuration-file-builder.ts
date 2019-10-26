import fs from 'fs';

import { LanguageSettings, Configuration, ClassSettings, TypeOfClass } from "./configuration";
import Languages from "./languages/languages";
import StringUtils from "./string-utils";

export default class ConfigurationFileBuilder {
    static CONFIGURATION_FILE_PATH = `stcconfig.json`;

    async makeQuestionsForKindOfClass(languageSettings: LanguageSettings, typeOfClass: TypeOfClass) {
        const classSettings = new ClassSettings(languageSettings.language, 
            languageSettings.rootProjectDirectory, languageSettings.srcDirectory[languageSettings.language]);

        let typeOfClassString = null;
        switch(typeOfClass) {
            case TypeOfClass.MODEL_CLASSES:
                typeOfClassString = 'models';
                break;
            case TypeOfClass.DATABASE_CLASSES:
                typeOfClassString = 'database';
                break;
            default:
                typeOfClassString = 'api';
                break;
        }

        classSettings.module = await StringUtils.readln(`If your ${typeOfClassString} classes will be in a separated module, specify it`);

        const defaultPackage = `${languageSettings.mainPackage}.${classSettings.module}.${typeOfClassString}`;

        if (languageSettings.language === Languages.KOTLIN) {
            classSettings.package = await StringUtils.readln(`Specify the package for your ${typeOfClassString} classes (default is "${defaultPackage}")`);
            if (classSettings.package.length === 0) {
                classSettings.package = defaultPackage;
            }
        }

        classSettings.inheritsFrom = await StringUtils.readln(`Specify the class your ${typeOfClassString} classes inherits from if needed`);

        let specifiedInterface = null;
        console.log(`Now, if needed, you can specify the interfaces your ${typeOfClassString} classes implement`);
        while (specifiedInterface === null || specifiedInterface.length > 0) {
            specifiedInterface = await StringUtils.readln(`Add an interface`);

            if (specifiedInterface.length > 0) {
                classSettings.implementsInterfaces.push(specifiedInterface);
            }
        }

        languageSettings.insertClassSetting(typeOfClass, classSettings);
    }

    async makeQuestionsForLanguage(language: string): Promise<LanguageSettings> {
        const languageSettings = new LanguageSettings(language);

        if (language === Languages.KOTLIN) {
            languageSettings.mainPackage = await StringUtils.readln('Specify the main package of the project');
        }

        languageSettings.rootProjectDirectory = await StringUtils.readln('Specify the root folder of the project');
        
        await this.makeQuestionsForKindOfClass(languageSettings, TypeOfClass.MODEL_CLASSES);
        await this.makeQuestionsForKindOfClass(languageSettings, TypeOfClass.DATABASE_CLASSES);

        delete(languageSettings.srcDirectory);
        return languageSettings;
    }

    async createSettingsFile(): Promise<Configuration> {
        const swaggerPath = await StringUtils.readln('Specify the path for swagger file');

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
                console.log(`OR select ${possibleLanguages.length} to FINISH the creation of config file`);
            }
            selection = Number.parseInt(await StringUtils.readln(`Select a number from 0 to ${possibleLanguages.length - 1 + (canLeave ? 1 : 0)}`));

            if (selection < possibleLanguages.length - 1) {
                const selectedLanguage = possibleLanguages[selection];
                possibleLanguages.splice(selection, 1);
                const settings = await this.makeQuestionsForLanguage(selectedLanguage);
                configuration.insertLanguage(selectedLanguage, settings);
            }
        } while (possibleLanguages.length > 0 && selection < possibleLanguages.length - 1);

        const configurationString = JSON.stringify(configuration, null, 2);

        fs.writeFileSync(ConfigurationFileBuilder.CONFIGURATION_FILE_PATH, configurationString);

        return configuration;
    }
}