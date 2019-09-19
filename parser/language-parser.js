const languages = require('../languages/languages');
const [ KOTLIN, SWIFT, JAVASCRIPT, TYPESCRIPT ] = languages;

const ClassDefinition = require('./definitions/class-definition');
const PropertyDefinition = require('./definitions/property-definition');
const EnumDefinition = require('./definitions/enum-definition');

const LanguageDefinition = require('../languages/language-definition');
const KotlinLanguageDefinition = require('../languages/kotlin-language-definition');

const ModelClassParser = require('./model-class-parser');
const DatabaseTableSchemaClassParser = require('./database-table-schema-class-parser');

const SqliteLanguageDefinition = require('../languages/sqlite-language-definition');

class LanguageDefinitionFactory {
    static makeLanguageDefinition(language) {
        if (language === KOTLIN) {
            return new KotlinLanguageDefinition();
        } else if (language === SWIFT) {
            return new SwiftLanguageDefinition();
        } else if (language === TYPESCRIPT) {
            return new TypescriptLanguageDefinition();
        } else {
            return new LanguageDefinition();
        }
    }
}

class LanguageParser {
    parse(object, language) {
        const languageDefinition = LanguageDefinitionFactory.makeLanguageDefinition(language);
        const modelParser = new ModelClassParser();
        const tableSchemaParser = new DatabaseTableSchemaClassParser();
        const sqliteLanguageDefinition = new SqliteLanguageDefinition();

        const preparedDefinitions = this.preparedDefinitions(Object.entries(object.definitions));

        this.createDefinitionsFromProperties(Object.entries(preparedDefinitions));

        const classes = Object.entries(preparedDefinitions).map((definition) => {
            const clasz = {
                model: modelParser.parse(languageDefinition, definition[1]),
            };
            if (definition[1].needsTable) {
                clasz.tableClasses = tableSchemaParser.parse(languageDefinition, sqliteLanguageDefinition, definition[1]);
            }
            return clasz;
        });

        classes.map((clasz) => {
            console.log(clasz.model.print(languageDefinition));
            if (clasz.tableClasses) {
                console.log(clasz.tableClasses.print(languageDefinition));
            }
        });

        return classes;
    }

    static doesDefinitionNeedTable(definition) {
        return Object.entries(definition[1].properties).filter((property) => {
            return property[0] === 'id';
        }).length > 0;
    }

    preparedDefinitions(definitions) {
        const preparedDefinitions = {};
        definitions.map((definition) => {
            const name = definition[0];
            const needsTable = LanguageParser.doesDefinitionNeedTable(definition);
            const properties = definition[1].properties;
            const requiredProperties = definition[1].required;
            preparedDefinitions[name] = new DefinitionHelper(name, needsTable, properties, requiredProperties);
        });

        Object.entries(preparedDefinitions).filter((definition) => {
            return definition[1].properties.filter((property) => {
                const refersTo = property.items && ModelClassParser.getTypeReferingToAnotherClass(property.items);
                return property.type === 'array' && refersTo &&
                    preparedDefinitions[refersTo].needsTable;
            }).length > 0;
        }).map((definition) => { // All definitions that depends on array of other definition on database
            const arrayProperty = definition[1].properties.find((property) => {
                return property.items && ModelClassParser.getTypeReferingToAnotherClass(property.items);
            });
            definition[1].addReference(preparedDefinitions[ModelClassParser.getTypeReferingToAnotherClass(arrayProperty.items)]);
        });

        return preparedDefinitions;
    }

    createDefinitionsFromProperties(preparedDefinitions) {
        preparedDefinitions.filter((definition) => {
            return definition[1].properties.filter((property) => {
                return property.type === 'object' || !LanguageParser.doesDefinitionNeedTable(definition);
            }).length > 0;
        }).map((definition) => { 
            // all definitions that has an object that will be stored in the same database
            definition[1].useFieldsAsPartOfTheSameTable = true;
        });

        const newDefinitions = {};
        preparedDefinitions.filter((definition) => {
            return definition[1].properties.filter((property) => {
                return property.type === 'object';
            }).length > 0;
        }).map((definition) => { // all definitions that has a untyped property
            definition[1].properties.filter((property) => {
                return property.type === 'object';
            }).map((property) => { // all untyped properties, we will create types for it
                let name = property.name;
                name = `${name.substr(0, 1).toUpperCase()}${name.substr(1)}`;

                property.$ref = `#/definitions/${name}`;

                let properties = property.subProperties;

                preparedDefinitions[name] = new DefinitionHelper(name, false, properties);
                newDefinitions[name] = preparedDefinitions[name];
            });
        });

        if (JSON.stringify(newDefinitions) !== '{}') {
            this.createDefinitionsFromProperties(Object.entries(newDefinitions));
        }
    }
}

class DefinitionHelper {
    constructor(name, needsTable, properties, requiredProperties) {
        this.name = name;
        this.needsTable = needsTable;
        this.properties = Object.entries(properties).map((property) => {
            return new DefinitionPropertiesHelper(
                property[0],
                property[1].type || property[1].$ref,
                requiredProperties ? requiredProperties.indexOf(property[0]) > -1 : false,
                property[1].properties || {},
                property[1].default,
                property[1].enum,
                property[1].items);
        });
        this.requiredProperties = requiredProperties;
        this.references = [];
    }

    addReference(otherDefinition) {
        this.references.push(otherDefinition);
    }
}

class DefinitionPropertiesHelper {
    constructor(name, type, required, subProperties, defaultValue, enumValues, arrayItems) {
        this.name = name;
        this.type = type;
        this.required = required;
        this.enum = enumValues;
        this.default = defaultValue;
        this.items = arrayItems;

        if (this.items && this.items.$ref) {
            this.items.type = this.items.$ref;
            delete this.items.$ref;
        }

        this.subProperties = Object.entries(subProperties).map((property) => {
            return new DefinitionPropertiesHelper(
                property[0],
                property[1].type || property[1].$ref,
                property[1].requiredProperties ? property[1].requiredProperties.indexOf(property[0]) > -1 : false,
                property[1].properties || []);
        });
    }
}

module.exports = LanguageParser;