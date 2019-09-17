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
        const classes = Object.entries(object.definitions).map((definition) => {
            const clasz = {
                model: modelParser.parse(languageDefinition, definition),
            };
            if (this.doesDefinitionNeedTable(definition)) {
                //clasz.tableClasses = tableSchemaParser.parse(languageDefinition, sqliteLanguageDefinition, definition);
            }
            return clasz;
        });

        classes.map((clasz) => {
            console.log(clasz.model.print(languageDefinition));
        });

        return classes;
    }

    doesDefinitionNeedTable(definition) {
        return Object.entries(definition[1].properties).filter((property) => {
            return property[0] === 'id';
        }).length > 0;
    }
}

module.exports = LanguageParser;