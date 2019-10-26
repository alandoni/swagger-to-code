import path from 'path';
import Languages from './languages/languages';

class Configuration {
    swaggerFile: string;
    languages: Map<string, LanguageSettings> = new Map();

    insertLanguage(language: string, settings: LanguageSettings) {
        this.languages[language] = settings;
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
        this.srcDirectory[Languages.KOTLIN] = ['src', 'androidMain', 'kotlin'].join(path.sep);
        this.srcDirectory[Languages.JAVASCRIPT] = '';
        this.srcDirectory[Languages.SWIFT] = '';
        this.srcDirectory[Languages.TYPESCRIPT] = '';
    }

    insertClassSetting(kindOfClass: TypeOfClass, classSettings: ClassSettings) {
        this.classesSettings[kindOfClass] = classSettings;
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

    modelClassesDirectory() {
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
