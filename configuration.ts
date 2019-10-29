import path from 'path';
import Languages from './languages/languages';

class Configuration {
    swaggerFile: string;
    languages: Map<string, LanguageSettings> = new Map();

    insertLanguage(language: string, settings: LanguageSettings) {
        this.languages[language] = settings;
    }

    getLanguageSettings(language: string): LanguageSettings {
        return Object.assign(new LanguageSettings(language), this.languages[language]);
    }

    getClassSettings(language: string, typeOfClass: TypeOfClass): ClassSettings {
        const languageSettings = this.getLanguageSettings(language);
        return languageSettings.getClassSettings(typeOfClass);
    }
}

class LanguageSettings {
    language: string;
    srcDirectory: Map<string, String>;

    mainPackage: string;
    rootProjectDirectory: string;

    classesSettings: Map<TypeOfClass, ClassSettings> = new Map();

    constructor(language: string) {
        this.language = language;
        this.srcDirectory = new Map();
        this.srcDirectory[Languages.KOTLIN] = ['src', 'main', 'java'].join(path.sep);
        this.srcDirectory[Languages.JAVASCRIPT] = '';
        this.srcDirectory[Languages.SWIFT] = '';
        this.srcDirectory[Languages.TYPESCRIPT] = '';
    }

    insertClassSetting(kindOfClass: TypeOfClass, classSettings: ClassSettings) {
        this.classesSettings[kindOfClass] = classSettings;
    }

    getClassSettings(typeOfClass: TypeOfClass): ClassSettings {
        return Object.assign(new ClassSettings(
            this.language,
            this.rootProjectDirectory,
            this.srcDirectory[this.language])
            , this.classesSettings[typeOfClass]);
    }
}

enum TypeOfClass {
    MODEL_CLASSES = 'MODEL_CLASSES',
    DATABASE_CLASSES = 'DATABASE_CLASSES',
    API_CLASSES = 'API_CLASSES'
}

class ClassSettings {
    module: string;
    package: string;
    inheritsFrom: string;
    implementsInterfaces: Array<string> = [];

    language: String;
    rootProjectDirectory: String;
    srcDirectory: String

    constructor(language: string, rootProjectDirectory: string, srcDirectory: string) {
        this.language = language;
        this.rootProjectDirectory = rootProjectDirectory;
        this.srcDirectory = srcDirectory;
    }

    directory(): string {
        return [
            this.rootProjectDirectory,
            this.module,
            this.srcDirectory,
        ].concat(this.package.split('.')).join(path.sep);
    }
}

export {
    Configuration,
    LanguageSettings,
    ClassSettings,
    TypeOfClass,
}
