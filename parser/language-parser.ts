
import LanguageDefinition from '../languages/language-definition';

import ModelClassParser from './model-class-parser';
import DatabaseTableSchemaClassParser from './database-table-schema-class-parser';

import SqliteLanguageDefinition from '../languages/sqlite-language-definition';
import { YamlDefinition, YamlProperty, YamlType } from './swagger-objects-representation/definition';
import { TypeOfClass, Configuration, LanguageSettings } from '../configuration';
import { LanguageDefinitionFactory } from './language-definition-factory';
import ClassDefinition from './definitions/class-definition';
import Parser from './parser-interface';

class LanguageParser {
    preparedDefinitions: Map<string, DefinitionHelper>;
    languageDefinition: LanguageDefinition;
    configuration: LanguageSettings;

    parse(object: any, language: string, configuration: Configuration): Array<ClassFile> {
        this.configuration = configuration.getLanguageSettings(language);
        this.languageDefinition = LanguageDefinitionFactory.makeLanguageDefinition(language);
        const sqliteLanguageDefinition = new SqliteLanguageDefinition();

        const yamlDefinitions = this.convertYamlDefinitions(Object.entries(object.definitions));
        this.preparedDefinitions = this.prepareDefinitions(yamlDefinitions);

        this.createDefinitionsFromProperties(this.definitions);
        this.prepareReferences();

        const classes = [];
        this.definitions.forEach((definition) => {
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

    get definitions() {
        return Object.entries(this.preparedDefinitions).map((entry) => {
            return entry[1];
        });
    }

    createClassFile(parser: Parser, typeOfClass: TypeOfClass): ClassFile {
        const classDefinition = parser.parse();
        const fileName = `${classDefinition.name}.${this.languageDefinition.fileExtension}`;
        const content = classDefinition.print(this.languageDefinition);
        const classesSettings = this.configuration.getClassSettings(typeOfClass);
        const directory = classesSettings.directory();
        return new ClassFile(directory, fileName, classDefinition, content, typeOfClass);
    }

    static doesDefinitionNeedTable(definition: DefinitionHelper) {
        return definition.properties.filter((property: DefinitionPropertyHelper) => {
            return property.name === 'id';
        }).length > 0;
    }

    convertYamlDefinitions(definitions: Array<any>): Array<YamlDefinition> {
        return definitions.map((definition: Array<any>) => {
            return YamlDefinition.fromObject(definition);
        });
    }

    prepareDefinitions(yamlDefinitions: Array<YamlDefinition>): Map<string, DefinitionHelper> {
        const preparedDefinitions: Map<string, DefinitionHelper> = new Map();
        yamlDefinitions.forEach((yamlDefinition) => {
            preparedDefinitions[yamlDefinition.name] = new DefinitionHelper(yamlDefinition.name, yamlDefinition.properties, yamlDefinition.required);
            preparedDefinitions[yamlDefinition.name].needsTable = LanguageParser.doesDefinitionNeedTable(preparedDefinitions[yamlDefinition.name]);
        });
        return preparedDefinitions;
    }

    prepareReferences() {
        this.definitions.filter((definition) => {
            definition.properties.filter((property: DefinitionPropertyHelper) => {
                const refersTo = property.type.subType && this.preparedDefinitions.get(property.type.subType.name);
                return property.type.name === 'array' && refersTo && refersTo.needsTable;
            }).map((property: DefinitionPropertyHelper) => { // All properties that depends on array of other definition on database
                const refersTo = this.preparedDefinitions.get(property.type.subType.name);
                property.setReference(refersTo);

                const propertyReferringToDefinition = refersTo.properties.find((property: DefinitionPropertyHelper) => {
                    const propertyName = definition.name;
                    const varName = propertyName.substr(0, 1).toLowerCase() + propertyName.substr(1);
                    return property.name === `${varName}Id`;
                });

                if (propertyReferringToDefinition) {
                    refersTo.addReference(new DefinitionReferenceHelper(definition, property, RelationshipType.N_TO_ONE));
                } else {
                    refersTo.addReference(new DefinitionReferenceHelper(definition, property, RelationshipType.ONE_TO_N));
                } 
            });

            definition.properties.filter((property: DefinitionPropertyHelper) => {
                const refersTo = this.preparedDefinitions.get(property.type.name);
                return refersTo;
            }).map((property: DefinitionPropertyHelper) => {  // All properties that depends on other definition on database
                const refersTo = this.preparedDefinitions.get(property.type.name);
                property.setReference(refersTo);
                definition.addReference(new DefinitionReferenceHelper(refersTo, property, RelationshipType.ONE_TO_ONE));
            });
        });
    }

    doesDefinitionUseFieldsAsPartOfTheTable(definition: DefinitionHelper): boolean {
        return definition.properties.filter((property) => {
            return !ModelClassParser.getPropertyType(this.languageDefinition, property.type).isNative 
                || !LanguageParser.doesDefinitionNeedTable(definition);
        }).length > 0;
    }

    filterNonPropertiesFromDefinitionsReferringToNonExistingObjects(definition: DefinitionHelper): Array<DefinitionPropertyHelper> {
        return definition.properties.filter((property) => {
            return !ModelClassParser.getPropertyType(this.languageDefinition, property.type).isNative &&
                !(this.preparedDefinitions.get(property.type.name) && this.preparedDefinitions.get(property.type.name).needsTable)
        });
    }

    createDefinitionsFromProperties(definitions: Array<DefinitionHelper>) {
        definitions.filter((definition: DefinitionHelper) => {
            return this.doesDefinitionUseFieldsAsPartOfTheTable(definition);
        }).map((definition) => { 
            // all definitions that has an object that will be stored in the same database
            definition.useFieldsAsPartOfTheSameTable = true;
        });

        const newDefinitions: Map<string, DefinitionHelper> = new Map();
        definitions.filter((definition) => {
            return this.filterNonPropertiesFromDefinitionsReferringToNonExistingObjects(definition).length > 0;
        }).map((definition) => { // all definitions that has a untyped property
            this.filterNonPropertiesFromDefinitionsReferringToNonExistingObjects(definition).map((property) => { // all untyped properties, we will create types for it
                let name = property.name;
                name = `${name.substr(0, 1).toUpperCase()}${name.substr(1)}`;

                const properties = property.subProperties || this.preparedDefinitions[property.type.name].properties;
                const yamlProperties = properties.map((property) => {
                    return YamlProperty.fromDefinitionPropertyHelper(property);
                });
                if (property.subProperties) {
                    this.preparedDefinitions[name] = new DefinitionHelper(name, yamlProperties, null);
                    property.type = new DefinitionTypeHelper(name);
                    property.subProperties = null;
                    newDefinitions[name] = this.preparedDefinitions[name];
                } else {
                    property.subProperties = properties;
                }
            });
        });

        if (JSON.stringify(newDefinitions) !== '{}') {
            this.createDefinitionsFromProperties(Object.entries(newDefinitions).map((definition) => {
                return definition[1];
            }));
        }
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

class DefinitionHelper {
    name: string;
    needsTable: boolean;
    properties: Array<DefinitionPropertyHelper>;
    requiredProperties: Array<string>;
    references: Array<DefinitionReferenceHelper>;
    useFieldsAsPartOfTheSameTable: boolean;

    constructor(name: string, properties: Array<YamlProperty>, requiredProperties: Array<string>) {
        this.name = name;

        if (properties) {
            this.properties = properties.map((property: YamlProperty) => {
                return new DefinitionPropertyHelper(
                    property.name,
                    property.type,
                    requiredProperties ? requiredProperties.indexOf(property.name) > -1 : false,
                    property.properties,
                    property.defaultValue,
                    property.enum);
            });
        }
        this.requiredProperties = requiredProperties;
        this.references = [];
    }

    addReference(otherDefinition: DefinitionReferenceHelper) {
        this.references.push(otherDefinition);
    }
}

class DefinitionPropertyHelper {
    name: string;
    type: DefinitionTypeHelper;
    required: boolean;
    enum: Array<string>;
    default: string;
    subProperties: Array<DefinitionPropertyHelper>;
    refersTo: DefinitionHelper;
    
    constructor(name: string, type: YamlType, required: boolean, subProperties: Array<YamlProperty>, defaultValue: string, enumValues: Array<string>) {
        this.name = name;
        this.type = DefinitionTypeHelper.fromYamlType(type);
        this.required = required;
        this.enum = enumValues;
        this.default = defaultValue;

        if (subProperties) {
            this.subProperties = subProperties.map((property) => {
                return new DefinitionPropertyHelper(
                    property.name,
                    property.type,
                    null,
                    property.properties,
                    null,
                    property.enum,
                );
            });
        }
    }

    setReference(reference: DefinitionHelper) {
        this.refersTo = reference;
    }
}

class DefinitionTypeHelper {
    name: string;
    isEnum: boolean;
    subType: DefinitionTypeHelper;

    constructor(name: string, subType: DefinitionTypeHelper = null, isEnum: boolean = false) {
        this.name = this.getTypeReferingToAnotherClass(name);
        this.subType = subType;
        this.isEnum = isEnum;
    }

    getTypeReferingToAnotherClass(type: string): string {
        const definitionsString = '#/definitions/';
        const definitionIndex = type.indexOf(definitionsString);
        if (definitionIndex > -1) {
            return type.substr(definitionIndex + definitionsString.length);
        }
        return type;
    }

    static fromYamlType(type: YamlType): DefinitionTypeHelper {
        return new DefinitionTypeHelper(type.name, type.items ? DefinitionTypeHelper.fromYamlType(type.items) : null, type.isEnum);
    }
}

enum RelationshipType {
    ONE_TO_ONE,
    ONE_TO_N,
    N_TO_ONE,
}

class DefinitionReferenceHelper {
    definition: DefinitionHelper;
    property: DefinitionPropertyHelper;
    relationship: RelationshipType;

    constructor(definition: DefinitionHelper, property: DefinitionPropertyHelper, relationship: RelationshipType) {
        this.definition = definition;
        this.property = property;
        this.relationship = relationship;
    }
}

export default LanguageParser;

export {
    DefinitionHelper,
    DefinitionPropertyHelper,
    DefinitionTypeHelper,
    DefinitionReferenceHelper,
    RelationshipType,
    ClassFile
}