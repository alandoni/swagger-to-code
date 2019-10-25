const languages = require('../languages/languages');
const [ KOTLIN, SWIFT, JAVASCRIPT, TYPESCRIPT ] = languages;

const LanguageDefinition = require('../languages/language-definition');
const KotlinLanguageDefinition = require('../languages/kotlin-language-definition');

const ModelClassParser = require('./model-class-parser');
const DatabaseTableSchemaClassParser = require('./database-table-schema-class-parser');

const SqliteLanguageDefinition = require('../languages/sqlite-language-definition');

const YamlDefinition = require('./yaml-definition/yaml-definition');
const YamlDefinitionRelationship = require('./yaml-definition/yaml-definition-relationship');

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

        this.preparedDefinitions = this.prepareDefinitions(Object.entries(object.definitions));
        this.createDefinitionsFromProperties(languageDefinition, this.preparedDefinitions);

        this.prepareReferences(this.preparedDefinitions);

        const classes = [];
        Object.entries(this.preparedDefinitions).map((definition) => {
            let classDefinition = modelParser.parse(languageDefinition, definition[1]);
            classes.push({fileName: `${classDefinition.name}.${languageDefinition.fileExtension}`,
                definition: classDefinition, 
                content: classDefinition.print(languageDefinition)});
            if (definition[1].needsTable) {
                classDefinition = tableSchemaParser.parse(languageDefinition, sqliteLanguageDefinition, definition[1]);
                classes.push({fileName: `${classDefinition.name}.${languageDefinition.fileExtension}`,
                    definition: classDefinition, 
                    content: classDefinition.print(languageDefinition)});
            }
        });

        return classes;
    }

    static doesDefinitionNeedTable(definition) {
        return Object.entries(definition[1].properties).filter((property) => {
            return property[0] === 'id';
        }).length > 0;
    }

    prepareDefinitions(definitions) {
        const preparedDefinitions = {};
        definitions.map((definition) => {
            const name = definition[0];
            const needsTable = LanguageParser.doesDefinitionNeedTable(definition);
            const properties = definition[1].properties;
            const requiredProperties = definition[1].required;
            preparedDefinitions[name] = new YamlDefinition(name, needsTable, properties, requiredProperties);
        });

        return preparedDefinitions;
    }

    prepareReferences(preparedDefinitions) {
        Object.entries(preparedDefinitions).filter((definition) => {
            return definition[1].needsTable;
        }).map((definition) => {
            definition[1].properties.filter((property) => {
                const refersTo = property.items && preparedDefinitions[property.items.type];
                return property.type === 'array' && refersTo && refersTo.needsTable;
            }).map((property) => { // All properties that depends on array of other definition on database
                const refersTo = preparedDefinitions[property.items.type];
                property.items.type = refersTo;
                property.setReference(refersTo);

                const propertyReferringToDefinition = refersTo.properties.find((property) => {
                    const propertyName = definition[1].name;
                    const varName = propertyName.substr(0, 1).toLowerCase() + propertyName.substr(1);
                    return property.name === `${varName}Id`;
                });

                if (propertyReferringToDefinition) {
                    refersTo.addReference(new YamlDefinitionRelationship(definition[1], property, YamlDefinitionRelationship.N_TO_ONE));
                } else {
                    refersTo.addReference(new YamlDefinitionRelationship(definition[1], property, YamlDefinitionRelationship.ONE_TO_N));
                } 
            });

            definition[1].properties.filter((property) => {
                const refersTo = preparedDefinitions[property.type];
                return refersTo && refersTo.needsTable;
            }).map((property) => {  // All properties that depends on other definition on database
                const refersTo = preparedDefinitions[property.type];
                property.type = refersTo;
                property.setReference(refersTo);
                definition[1].addReference(new YamlDefinitionRelationship(refersTo, property, YamlDefinitionRelationship.ONE_TO_ONE));
            });
        });
    }

    createDefinitionsFromProperties(languageDefinition, definitions) {
        const definitionsArray = Object.entries(definitions);
        definitionsArray.filter((definition) => {
            return definition[1].properties.filter((property) => {
                return !ModelClassParser.getPropertyType(languageDefinition, property).isNative 
                    || !LanguageParser.doesDefinitionNeedTable(definition);
            }).length > 0;
        }).map((definition) => { 
            // all definitions that has an object that will be stored in the same database
            definition[1].useFieldsAsPartOfTheSameTable = true;
        });

        const newDefinitions = {};
        definitionsArray.filter((definition) => {
            return definition[1].properties.filter((property) => {
                return !ModelClassParser.getPropertyType(languageDefinition, property).isNative
                    && (!this.preparedDefinitions[property.type] || !this.preparedDefinitions[property.type].needsTable);
            }).length > 0;
        }).map((definition) => { // all definitions that has a untyped property
            definition[1].properties.filter((property) => {
                return !ModelClassParser.getPropertyType(languageDefinition, property).isNative
                    && (!this.preparedDefinitions[property.type] || !this.preparedDefinitions[property.type].needsTable);
            }).map((property) => { // all untyped properties, we will create types for it
                let name = property.name;
                name = `${name.substr(0, 1).toUpperCase()}${name.substr(1)}`;

                let properties = property.subProperties || this.preparedDefinitions[name].properties;
                if (property.subProperties) {
                    property.type = name;
                    property.subProperties = null;
                    this.preparedDefinitions[name] = new YamlDefinition(name, false);
                    this.preparedDefinitions[name].properties = properties;
                    newDefinitions[name] = this.preparedDefinitions[name];
                } else {
                    property.subProperties = properties;
                }
            });
        });

        if (JSON.stringify(newDefinitions) !== '{}') {
            this.createDefinitionsFromProperties(languageDefinition, newDefinitions);
        }
    }
}



module.exports = LanguageParser