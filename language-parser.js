const languages = require('./languages.js');
const [ KOTLIN, SWIFT, TYPESCRIPT ] = languages;

const LanguageDefinition = require('./language-definition');
const KotlinLanguageDefinition = require('./kotlin-language-definition');

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
        console.log(language);
        console.log(KOTLIN);
        const languageDefinition = LanguageDefinitionFactory.makeLanguageDefinition(language);

        const modelClasses = [];
        for (const definition of Object.entries(object.definitions)) {
            let properties = this.getProperties(languageDefinition, definition[1].properties);
            const clasName = definition[0];
            let modelClassString = "";
            if (languageDefinition.useDataclassForModels) {
                modelClassString = `${languageDefinition.dataClassKeyword} ${clasName}`;
            } else {
                modelClassString = `${languageDefinition.classKeyword} ${clasName}`;
            }
            let methods = `\tfunction () { }`;

            let constructor = 
`(
${properties}
)`;

            if (languageDefinition.shouldConstructorDefineProperties) {
                properties = "";
            }

            if (languageDefinition.isConstructorInClassDefinition) {
                modelClassString = 
`${modelClassString}${constructor} {
${methods}
}`;
            } else {
                const classContentString =
`${properties}
${methods}`;
                modelClassString = 
`${modelClassString} {
${classContentString}
}`;
            }

            console.log(modelClassString);
            modelClasses.push(modelClassString);
        }
    }

    getProperties(languageDefinition, properties) {
        let propertiesString = "";
        for (const property of Object.entries(properties)) {
            let propertyString = `\t${languageDefinition.propertyKeyword} `;
            const [ propertyName, propertyType ] = this.getProperty(languageDefinition, property);

            if (languageDefinition.isTypesafeLanguage) {
                if (languageDefinition.isPropertyTypeAfterName) {
                    propertyString += `${propertyName} ${languageDefinition.propertyTypeSeparator} ${propertyType}`;
                } else {
                    propertyString += `${propertyType} ${languageDefinition.propertyTypeSeparator} ${propertyName}`;
                }
            } else {
                propertyString += `${propertyName}`;
            }
            propertyString += ";"
            propertiesString += 
`${propertyString}
`;
        }
        return propertiesString;
    }

    getProperty(languageDefinition, property) {
        return [ property[0], this.getPropertyType(languageDefinition, property[1]) ];
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