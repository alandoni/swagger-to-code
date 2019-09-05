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
        const classDefinitions = this.transformDefitionsInClassDefinition(languageDefinition, object.definitions);
        const modelParser = new ModelClassParser();
        const tableSchemaParser = new DatabaseTableSchemaClassParser();
        const sqliteLanguageDefinition = new SqliteLanguageDefinition();
        const classes = classDefinitions.map((classDefinition) => {
            const clasz = {
                models: modelParser.parse(languageDefinition, classDefinition),
            };
            if (classDefinition.needsTable) {
                clasz.tableClasses = tableSchemaParser.parse(languageDefinition, sqliteLanguageDefinition, classDefinition);
            }
            return clasz;
        });
        return classes;
    }

    transformDefitionsInClassDefinition(languageDefinition, definitions) {
        return Object.entries(definitions).map((definition) => {
            const className = definition[0];
            const properties = this.getProperties(languageDefinition, definition[1].properties, definition[1].required);
            
            const dependencies = [];

            let needsTable = false;

            const enums = properties.filter((property) => {
                if (property.type.indexOf(languageDefinition.arrayKeyword) > -1) {
                    const indexOfSubtype = property.type.indexOf('<') + 1;
                    const subtype = property.type.substr(indexOfSubtype, property.type.length - 1 - indexOfSubtype);
                    if (languageDefinition.nativeTypes.indexOf(subtype) < 0 && !property.enumDefinition) {
                        dependencies.push(subtype);
                    }
                } else {
                    if (languageDefinition.nativeTypes.indexOf(property.type) < 0 && !property.enumDefinition) {
                        dependencies.push(property.type);
                    }
                }
                if (!needsTable && property.name === 'id') {
                    needsTable = true;
                }
                return property.enumDefinition != null;
            }).map((property) => {
               return property.enumDefinition;
            });

            return new ClassDefinition(className, properties, enums, dependencies, needsTable);
        });
    }

    getProperties(languageDefinition, properties, requiredProperties) {
        return Object.entries(properties).map((property) => {
            let [propertyName, propertyType] = this.getProperty(languageDefinition, property);

            const indexOfSubtype = propertyType.indexOf('<') + 1;
            let subtype = null;
            if (indexOfSubtype > 0) {
                subtype = propertyType.substr(indexOfSubtype, propertyType.length - 1 - indexOfSubtype);
            }

            let enumDefinition = null;
            if (property[1].enum) {
                const enumName = propertyName.substr(0, 1).toUpperCase() + propertyName.substr(1);
                propertyType = enumName;
                enumDefinition = new EnumDefinition(enumName, property[1].enum);
            }

            let required = false;
            if (requiredProperties && requiredProperties.indexOf(propertyName) > -1) {
                required = true;
            }

            return new PropertyDefinition(propertyName, propertyType, enumDefinition, required, subtype);
        });
    }

    getProperty(languageDefinition, property) {
        return [property[0], this.getPropertyType(languageDefinition, property[1])];
    }

    getPropertyType(languageDefinition, property) {
        if (property.type === "string") {
            return languageDefinition.stringKeyword;
        }
        if (property.type === "number") {
            return languageDefinition.numberKeyword;
        }
        if (property.type === "integer") {
            return languageDefinition.intKeyword;
        }
        if (property.type === "boolean") {
            return languageDefinition.booleanKeyword;
        }
        if (property.type === "array") {
            return `${languageDefinition.arrayKeyword}<${this.getPropertyType(languageDefinition, property.items)}>`;
        }
        if (property.type === "object") {
            return languageDefinition.mapKeyword;
        }

        return this.getTypeReferingToAnotherClass(property);
    }

    getTypeReferingToAnotherClass(property) {
        const definitionsString = "#/definitions/";
        const definitionIndex = property.$ref.indexOf(definitionsString);
        if (definitionIndex > -1) {
            return property.$ref.substr(definitionIndex + definitionsString.length);
        }
    }
}

module.exports = LanguageParser;