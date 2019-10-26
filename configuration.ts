import path from 'path';
import Languages from './languages/languages';

class Configuration {
    swaggerFile: string;
    languages: Map<string, LanguageSettings> = new Map();
}

class LanguageSettings {
    language: string;
    srcDirectory: Map<string, Array<string>>;

    mainPackage: string;
    rootProjectDirectory: string;

    modelClassesModule: string;
    modelClassesPackage: string;
    modelClassesInheritsFrom: string;
    modelClassesImplementsInterfaces: Array<string> = [];

    databaseClassesModule: string;
    databaseClassesPackage: string;
    databaseClassesInheritsFrom: string;
    databaseClassesImplementsInterfaces: Array<string> = [];

    constructor(language) {
        this.language = language;
        this.srcDirectory = new Map();
        this.srcDirectory[Languages.KOTLIN] = ['src', 'androidMain', 'kotlin'];
        this.srcDirectory[Languages.JAVASCRIPT] = [];
        this.srcDirectory[Languages.SWIFT] = [];
        this.srcDirectory[Languages.TYPESCRIPT] = [];
    }

    modelClassesDirectory() {
        return [
            this.rootProjectDirectory,
            this.modelClassesModule,
            ...this.srcDirectory[this.language]
        ].concat(this.modelClassesPackage.split('.')).join(path.sep);
    }

    databaseClassesDirectory() {
        return [
            this.rootProjectDirectory,
            this.modelClassesModule,
            ...this.srcDirectory[this.language]
        ].concat(this.databaseClassesPackage.split('.')).join(path.sep);
    }
}

export {
    Configuration,
    LanguageSettings,
}
