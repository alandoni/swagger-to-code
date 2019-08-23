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
            return {
                models: modelParser.parse(languageDefinition, classDefinition), 
                tableClasses: tableSchemaParser.parse(languageDefinition, sqliteLanguageDefinition, classDefinition)
            };
        });
    }

    transformDefitionsInClassDefinition(languageDefinition, definitions) {
        return Object.entries(definitions).map((definition) => {
            const className = definition[0];
            const properties = this.getProperties(languageDefinition, definition[1].properties, definition[1].required);

            const enums = [];

            properties.filter((property) => {
                return property.enumDefinition != null;
            }).map((property) => {
                enums.push(property.enumDefinition);
            });

            return new ClassDefinition(className, properties, enums);
        });
    }

    getProperties(languageDefinition, properties, requiredProperties) {
        return Object.entries(properties).map((property) => {
            let [propertyName, propertyType] = this.getProperty(languageDefinition, property);

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

            return new PropertyDefinition(propertyName, propertyType, enumDefinition, required);
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