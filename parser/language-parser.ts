
import LanguageDefinition from '../languages/language-definition';

import ModelClassParser from './model-class-parser';
import DatabaseTableSchemaClassParser from './database-table-schema-class-parser';

import SqliteLanguageDefinition from '../languages/sqlite-language-definition';
import { TypeOfClass, Configuration, LanguageSettings } from '../configuration';
import { LanguageDefinitionFactory } from './language-definition-factory';
import ClassDefinition from './definitions/class-definition';
import Parser from './parser-interface';
import YamlDefinitionToDefinitionHelperConverter from './yaml-definition-to-definition-helper-converter';

import YamlPathsToApiHelperConverter from './yaml-paths-to-api-helper-converter';

export default class LanguageParser {
    
    languageDefinition: LanguageDefinition;
    configuration: LanguageSettings;

    parse(object: any, language: string, configuration: Configuration): Array<ClassFile> {
        this.configuration = configuration.getLanguageSettings(language);
        this.languageDefinition = LanguageDefinitionFactory.makeLanguageDefinition(language);
        const sqliteLanguageDefinition = new SqliteLanguageDefinition();

        const classes = [];

        const definitionConverter = new YamlDefinitionToDefinitionHelperConverter();
        definitionConverter.convert(object, this.languageDefinition, this.configuration);
        const yamlPathsConverter = new YamlPathsToApiHelperConverter()
        const paths = yamlPathsConverter.convert(object, definitionConverter.preparedDefinitions, this.languageDefinition, this.configuration);
        console.log(paths);
        yamlPathsConverter.convertTags(object.tags);

        definitionConverter.definitions.forEach((definition) => {
            const modelParser = new ModelClassParser(
                this.languageDefinition, 
                definition, 
                this.configuration.getClassSettings(TypeOfClass.MODEL_CLASSES)
            );
            classes.push(this.createClassFile(modelParser, TypeOfClass.MODEL_CLASSES));

            if (definition.needsTable) {
                const tableSchemaParser = new DatabaseTableSchemaClassParser(
                    this.languageDefinition, 
                    sqliteLanguageDefinition, 
                    definition, this.configuration);
                classes.push(this.createClassFile(tableSchemaParser, TypeOfClass.DATABASE_CLASSES));
            }
        });

        return classes;
    }

    createClassFile(parser: Parser, typeOfClass: TypeOfClass): ClassFile {
        const classDefinition = parser.parse();
        const fileName = `${classDefinition.name}.${this.languageDefinition.fileExtension}`;
        const content = classDefinition.print(this.languageDefinition);
        const classesSettings = this.configuration.getClassSettings(typeOfClass);
        const directory = classesSettings.directory();
        return new ClassFile(directory, fileName, classDefinition, content, typeOfClass);
    }
}

class ClassFile {
    directory: string;
    file: string;
    content: string;
    type: TypeOfClass;
    classDefinition: ClassDefinition;
    className: string;

    constructor(directory: string, file: string, classDefinition: ClassDefinition, content: string, type: TypeOfClass) {
        this.directory = directory;
        this.file = file;
        this.classDefinition = classDefinition;
        this.className = classDefinition.name;
        this.content = content;
        this.type = type;
    }
}

export {
    ClassFile
}