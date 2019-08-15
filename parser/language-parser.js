const languages = require('../languages/languages');
const [ KOTLIN, SWIFT, JAVASCRIPT, TYPESCRIPT ] = languages;

const LanguageDefinition = require('../languages/language-definition');
const KotlinLanguageDefinition = require('../languages/kotlin-language-definition');

const ModelClassParser = require('./model-class-parser');

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
        new ModelClassParser().parse(languageDefinition, object);        
    }
}

module.exports = LanguageParser;