import LanguageDefinition from '../languages/language-definition';

import ModelClassParser from './model-class-parser';
import { YamlDefinition, YamlProperty, YamlType } from './swagger-objects-representation/definition';
import { LanguageSettings } from '../configuration';

import TypeDefinition from './definitions/type-definition';

export default class YamlDefinitionToDefinitionHelperConverter {
    preparedDefinitions: Map<string, DefinitionHelper>;
    languageDefinition: LanguageDefinition;
    configuration: LanguageSettings;

    convert(object: any, language: LanguageDefinition, configuration: LanguageSettings): Array<DefinitionHelper> {
        this.configuration = configuration;
        this.languageDefinition = language;
        
        const yamlDefinitions = this.convertYamlDefinitions(Object.entries(object.definitions));
        this.preparedDefinitions = this.prepareDefinitions(yamlDefinitions);

        this.createDefinitionsFromProperties(this.definitions);
        this.prepareReferences();

        return this.definitions;
    }

    get definitions() {
        return Object.entries(this.preparedDefinitions).map((entry) => {
            return entry[1];
        });
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
            preparedDefinitions[yamlDefinition.name].needsTable = YamlDefinitionToDefinitionHelperConverter.doesDefinitionNeedTable(preparedDefinitions[yamlDefinition.name]);
        });
        return preparedDefinitions;
    }

    prepareReferences() {
        this.definitions.filter((definition) => {
            definition.properties.filter((property: DefinitionPropertyHelper) => {
                const refersTo = property.type.subType && this.preparedDefinitions[property.type.subType.name];
                return property.type.name === 'array' && refersTo && refersTo.needsTable;
            }).map((property: DefinitionPropertyHelper) => { // All properties that depends on array of other definition on database
                const refersTo = this.preparedDefinitions[property.type.subType.name];
                const propertyReferringToDefinition = refersTo.properties.find((property: DefinitionPropertyHelper) => {
                    const propertyName = definition.name;
                    const varName = propertyName.substr(0, 1).toLowerCase() + propertyName.substr(1);
                    return property.name === `${varName}Id`;
                });

                let reference = null
                if (propertyReferringToDefinition) {
                    reference = new DefinitionReferenceHelper(definition, propertyReferringToDefinition, RelationshipType.N_TO_ONE);
                } else {
                    reference = new DefinitionReferenceHelper(definition, property, RelationshipType.ONE_TO_N);
                }
                refersTo.addReference(reference);
                property.setReference(reference);
            });

            definition.properties.filter((property: DefinitionPropertyHelper) => {
                const refersTo = this.preparedDefinitions[property.type.name];
                return refersTo;
            }).map((property: DefinitionPropertyHelper) => {  // All properties that depends on other definition on database
                const refersTo = this.preparedDefinitions[property.type.name];
                const reference = new DefinitionReferenceHelper(refersTo, property, RelationshipType.ONE_TO_ONE);
                property.setReference(reference);
                definition.addReference(reference);
            });
        });
    }

    doesDefinitionUseFieldsAsPartOfTheTable(definition: DefinitionHelper): boolean {
        return definition.properties.filter((property) => {
            return 
                !ModelClassParser.getPropertyType(this.languageDefinition, property.type, property.required).isNative ||
                !YamlDefinitionToDefinitionHelperConverter.doesDefinitionNeedTable(definition);
        }).length > 0;
    }

    filterNonPropertiesFromDefinitionsReferringToNonExistingObjects(definition: DefinitionHelper): Array<DefinitionPropertyHelper> {
        return definition.properties.filter((property) => {
            return !ModelClassParser.getPropertyType(this.languageDefinition, property.type, property.required).isNative &&
                !(this.preparedDefinitions[property.type.name] && this.preparedDefinitions[property.type.name].needsTable)
        });
    }

    createDefinitionsFromProperties(definitions: Array<DefinitionHelper>) {
        definitions.filter((definition: DefinitionHelper) => {
            return this.doesDefinitionUseFieldsAsPartOfTheTable(definition);
        }).forEach((definition) => { 
            // all definitions that has an object that will be stored in the same database
            definition.useFieldsAsPartOfTheSameTable = true;
        });

        const newDefinitions: Map<string, DefinitionHelper> = new Map();
        definitions.filter((definition) => {
            return this.filterNonPropertiesFromDefinitionsReferringToNonExistingObjects(definition).length > 0;
        }).forEach((definition) => { // all definitions that has a untyped property
            this.filterNonPropertiesFromDefinitionsReferringToNonExistingObjects(definition).map((property) => { // all untyped properties, we will create types for it
                let name = property.name;
                name = `${name.substr(0, 1).toUpperCase()}${name.substr(1)}`;

                const properties = property.subProperties || 
                    (this.preparedDefinitions[name] ? this.preparedDefinitions[name].properties : null) || 
                    (this.preparedDefinitions[property.type.name] ? this.preparedDefinitions[property.type.name].properties : null);
                const yamlProperties = properties ? properties.map((property) => {
                    return YamlProperty.fromDefinitionPropertyHelper(property);
                }) : null;
                if (property.subProperties) {
                    this.preparedDefinitions[name] = new DefinitionHelper(name, yamlProperties, null);
                    property.type = new DefinitionTypeHelper(name);
                    property.subProperties = null;
                    this.preparedDefinitions[name].needsTable = YamlDefinitionToDefinitionHelperConverter.doesDefinitionNeedTable(this.preparedDefinitions[name]);
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
    refersTo: DefinitionReferenceHelper;
    
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

    setReference(reference: DefinitionReferenceHelper) {
        this.refersTo = reference;
    }
}

class DefinitionTypeHelper {
    name: string;
    isEnum: boolean;
    subType: DefinitionTypeHelper;
    isNative: boolean;

    constructor(name: string, subType: DefinitionTypeHelper = null, isEnum: boolean = false) {
        this.name = this.getTypeReferingToAnotherClass(name);
        this.subType = subType;
        this.isEnum = isEnum;

        switch(name) {
            case YamlType.TYPE_STRING:
            case YamlType.TYPE_NUMBER:
            case YamlType.TYPE_INTEGER:
            case YamlType.TYPE_BOOLEAN:
                this.isNative = true;
                break;
            default:
                this.isNative = false;
                break;   
        }
    }

    getTypeReferingToAnotherClass(type: string): string {
        const definitionsString = '#/definitions/';
        const definitionIndex = type.indexOf(definitionsString);
        if (definitionIndex > -1) {
            return type.substr(definitionIndex + definitionsString.length);
        }
        return type;
    }

    isArray() {
        return this.name.indexOf(YamlType.TYPE_ARRAY) > -1;
    }

    static fromYamlType(type: YamlType): DefinitionTypeHelper {
        return new DefinitionTypeHelper(type.name, type.items ? DefinitionTypeHelper.fromYamlType(type.items) : null, type.isEnum);
    }

    static toTypeDefinition(type: DefinitionTypeHelper, required: boolean, languageDefinition: LanguageDefinition): TypeDefinition {
        return ModelClassParser.getPropertyType(languageDefinition, type, required);
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


export {
    DefinitionHelper,
    DefinitionPropertyHelper,
    DefinitionTypeHelper,
    DefinitionReferenceHelper,
    RelationshipType,
}