import { KOTLIN, SWIFT, TYPESCRIPT } from '../languages/languages';

import LanguageDefinition from '../languages/language-definition';
import KotlinLanguageDefinition from '../languages/kotlin-language-definition';

import ModelClassParser from './model-class-parser';
import DatabaseTableSchemaClassParser from './database-table-schema-class-parser';

import SqliteLanguageDefinition from '../languages/sqlite-language-definition';
import { YamlDefinition, YamlType, YamlProperty } from './swagger-objects-representation/definition';
import JavascriptLanguageDefinition from '../languages/javascript-language-definition';

class LanguageDefinitionFactory {
    static makeLanguageDefinition(language: string): LanguageDefinition {
        if (language === KOTLIN) {
            return new KotlinLanguageDefinition();
        } else if (language === SWIFT) {
            return null; //new SwiftLanguageDefinition();
        } else if (language === TYPESCRIPT) {
            return null; //new TypescriptLanguageDefinition();
        } else {
            return new JavascriptLanguageDefinition();
        }
    }
}

class LanguageParser {
    preparedDefinitions: Map<string, DefinitionHelper>;
    definitions: Array<DefinitionHelper>;
    languageDefinition: LanguageDefinition;

    parse(object: any, language: string) {
        const languageDefinition = LanguageDefinitionFactory.makeLanguageDefinition(language);
        const sqliteLanguageDefinition = new SqliteLanguageDefinition();

        const yamlDefinitions = this.convertYamlDefinitions(Object.entries(object.definitions));
        this.preparedDefinitions = this.prepareDefinitions(yamlDefinitions);
        this.definitions = Object.entries(this.preparedDefinitions).map((entry) => {
            return entry[1];
        })
        this.createDefinitionsFromProperties(this.definitions);

        this.prepareReferences();

        const classes = [];
        this.definitions.forEach((definition) => {
            const modelParser = new ModelClassParser(languageDefinition, definition);
            let classDefinition = modelParser.parse();
            classes.push({fileName: `${classDefinition.name}.${languageDefinition.fileExtension}`,
                definition: classDefinition, 
                content: classDefinition.print(languageDefinition)});
            if (definition.needsTable) {
                const tableSchemaParser = new DatabaseTableSchemaClassParser(languageDefinition, sqliteLanguageDefinition, definition);
                classDefinition = tableSchemaParser.parse();
                classes.push({fileName: `${classDefinition.name}.${languageDefinition.fileExtension}`,
                    definition: classDefinition, 
                    content: classDefinition.print(languageDefinition)});
            }
        });

        return classes;
    }

    static doesDefinitionNeedTable(definition: DefinitionHelper) {
        return definition.properties.filter((property: DefinitionPropertiesHelper) => {
            return property.name === 'id';
        }).length > 0;
    }

    convertYamlDefinitions(definitions: Array<any>): Array<YamlDefinition> {
        return definitions.map((definition: Array<any>) => {
            const name = definition[0];
            const properties = definition[1].properties.map((property: Array<any>) => {
                const name = property[0];
                const type = new YamlType(property[1].type, new YamlType(property[1].items.type || property[1].items.$ref, null));
                const defaultValue = property[1].default;
                const enumValues = property[1].enum;
                return new YamlProperty(name, type, defaultValue, enumValues);
            });
            const type = new YamlType(definition[1].type, null);
            const requiredProperties = definition[1].required;
            return new YamlDefinition(name, type, properties, requiredProperties);
        });
    }

    prepareDefinitions(definitions: Array<YamlDefinition>): Map<string, DefinitionHelper> {
        const preparedDefinitions: Map<string, DefinitionHelper> = new Map();
        definitions.forEach((definition) => {
            preparedDefinitions[definition.name] = new DefinitionHelper(definition.name, definition.properties, definition.required);
            preparedDefinitions[definition.name].needsTable = LanguageParser.doesDefinitionNeedTable(preparedDefinitions[definition.name]);
        });
        return preparedDefinitions;
    }

    prepareReferences() {
        this.definitions.filter((definition) => {
            definition.properties.filter((property: DefinitionPropertiesHelper) => {
                const refersTo = property.items && this.preparedDefinitions[property.items.type];
                return property.type === 'array' && refersTo && this.preparedDefinitions[refersTo].needsTable;
            }).map((property: DefinitionPropertiesHelper) => { // All properties that depends on array of other definition on database
                const refersTo = this.preparedDefinitions[property.items.type];
                property.items.type = refersTo;
                property.setReference(refersTo);

                const propertyReferringToDefinition = refersTo.properties.find((property: DefinitionPropertiesHelper) => {
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

            definition.properties.filter((property: DefinitionPropertiesHelper) => {
                const refersTo = this.preparedDefinitions[property.type];
                return refersTo;
            }).map((property: DefinitionPropertiesHelper) => {  // All properties that depends on other definition on database
                const refersTo = this.preparedDefinitions[property.type];
                property.type = refersTo;
                property.setReference(refersTo);
                definition.addReference(new DefinitionReferenceHelper(refersTo, property, RelationshipType.ONE_TO_ONE));
            });
        });
    }

    createDefinitionsFromProperties(definitions: Array<DefinitionHelper>) {
        definitions.filter((definition: DefinitionHelper) => {
            return definition.properties.filter((property) => {
                return !ModelClassParser.getPropertyType(this.languageDefinition, property).isNative 
                    || !LanguageParser.doesDefinitionNeedTable(definition);
            }).length > 0;
        }).map((definition) => { 
            // all definitions that has an object that will be stored in the same database
            definition.useFieldsAsPartOfTheSameTable = true;
        });

        const newDefinitions: Map<string, DefinitionHelper> = new Map();
        definitions.filter((definition) => {
            return definition.properties.filter((property) => {
                !ModelClassParser.getPropertyType(this.languageDefinition, property).isNative
                    && (!this.preparedDefinitions[property.type] || !this.preparedDefinitions[property.type].needsTable);
            }).length > 0;
        }).map((definition) => { // all definitions that has a untyped property
            definition.properties.filter((property) => {
                return !ModelClassParser.getPropertyType(this.languageDefinition, property).isNative
                    && (!this.preparedDefinitions[property.type] || !this.preparedDefinitions[property.type].needsTable);
            }).map((property) => { // all untyped properties, we will create types for it
                let name = property.name;
                name = `${name.substr(0, 1).toUpperCase()}${name.substr(1)}`;

                let properties = property.subProperties || this.preparedDefinitions[name].properties;
                if (property.subProperties) {
                    property.type = name;
                    property.subProperties = null;
                    this.preparedDefinitions[name] = new DefinitionHelper(name, properties, null);
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

class DefinitionHelper {
    name: string;
    needsTable: boolean;
    properties: Array<DefinitionPropertiesHelper>;
    requiredProperties: Array<string>;
    references: Array<DefinitionReferenceHelper>;
    useFieldsAsPartOfTheSameTable: boolean;

    constructor(name: string, properties: Array<YamlProperty>, requiredProperties: Array<string>) {
        this.name = name;

        if (properties) {
            this.properties = properties.map((property: YamlProperty) => {
                return new DefinitionPropertiesHelper(
                    property.name,
                    property.type.name,
                    requiredProperties ? requiredProperties.indexOf(property.name) > -1 : false,
                    property.properties,
                    property.defaultValue,
                    property.enum,
                    property.type.items);
            });
        }
        this.requiredProperties = requiredProperties;
        this.references = [];
    }

    addReference(otherDefinition: DefinitionReferenceHelper) {
        this.references.push(otherDefinition);
    }
}

class DefinitionPropertiesHelper {
    name: string;
    type: string;
    required: boolean;
    enum: Array<string>;
    default: string;
    items: any;
    subProperties: Array<DefinitionPropertiesHelper>;
    refersTo;
    
    constructor(name: string, type: string, required: boolean, subProperties: Array<YamlProperty>, defaultValue: string, enumValues: Array<string>, arrayItems: any) {
        this.name = name;
        this.type = this.getTypeReferingToAnotherClass(type);
        this.required = required;
        this.enum = enumValues;
        this.default = defaultValue;
        this.items = arrayItems;

        if (this.items && this.items.$ref) {
            this.items.type = this.items.$ref;
            delete this.items.$ref;
        }

        if (subProperties) {
            this.subProperties = subProperties.map((property) => {
                return new DefinitionPropertiesHelper(
                    property.name,
                    property.type.name,
                    null,
                    property.properties,
                    null,
                    property.enum,
                    property.type.items);
            });
        }
    }

    setReference(reference) {
        this.refersTo = reference;
    }

    getTypeReferingToAnotherClass(type: string): string {
        const definitionsString = '#/definitions/';
        const definitionIndex = type.indexOf(definitionsString);
        if (definitionIndex > -1) {
            return type.substr(definitionIndex + definitionsString.length);
        }
        return type;
    }
}

enum RelationshipType {
    ONE_TO_ONE,
    ONE_TO_N,
    N_TO_ONE,
}

class DefinitionReferenceHelper {
    definition: DefinitionHelper;
    property: DefinitionPropertiesHelper;
    relationship: RelationshipType;

    constructor(definition: DefinitionHelper, property: DefinitionPropertiesHelper, relationship: RelationshipType) {
        this.definition = definition;
        this.property = property;
        this.relationship = relationship;
    }
}

export default LanguageParser;

export {
    DefinitionHelper,
    DefinitionPropertiesHelper,
    DefinitionReferenceHelper,
    RelationshipType
}