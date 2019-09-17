const PropertyDefinition = require('./definitions/property-definition');
const ConstrutorDefinition = require('./definitions/constructor-definitions');
const MethodDefinition = require('./definitions/method-definition');
const EnumDefinition = require('./definitions/enum-definition');
const ClassDefinition = require('./definitions/class-definition');
const TypeDefinition = require('./definitions/type-definition');

module.exports = class ModelClassParser {
    parse(languageDefinition, definition) {
        const className = definition[0];
        const properties = this.parseProperties(languageDefinition, definition[1].properties, definition[1].required);
        
        const dependencies = [];
        
        properties.map((property) => {
            if (property.type.subtype) {
                if (property.type.subtype.isNative) {
                    dependencies.push(subtype);
                }
            } else {
                if (property.type.isNative) {
                    dependencies.push(property.type);
                }
            }
        });

        const enums = this.parseEnums(definition[1].properties);

        const methods = [this.getCopyMethod(languageDefinition, className, properties),
            this.getIsEqualMethod(languageDefinition, className, properties)];

        const constructors = [this.parseConstructors(className, properties)];

        return new ClassDefinition(className, properties, constructors, methods, enums, dependencies);
    }

    parseConstructors(className, properties) {
        return new ConstrutorDefinition(className, properties);
    }

    parseProperties(properties) {
        return properties.map((property) => {
            return new PropertyDefinition(property.name, property.type, null, false, false);
        });
    }

    parseEnums(properties) {
        return Object.entries(properties).map((property) => {
            if (!property[1].enum) {
                return null;
            }

            const enumName = property[0].substr(0, 1).toUpperCase() + property[0].substr(1);
            return new EnumDefinition(enumName, property[1].enum);
        }).filter((elements) => {
            return elements != null;
        });
    }

    getCopyMethod(languageDefinition, className, properties) {
        const values = properties.map((property) => {
            return `${languageDefinition.thisKeyword}.${property.name}`;
        });
        const constructObject = languageDefinition.constructObject(className, values);
        
        const body = `\t\t${languageDefinition.returnDeclaration(constructObject)}`;

        return new MethodDefinition('copy', className, null, body);
    }

    getIsEqualMethod(languageDefinition, className, properties) {
        const returnFalse = `\t\t\t${languageDefinition.returnDeclaration(languageDefinition.falseKeyword)}`;
        let body = `\t\t${languageDefinition.ifNullStatement('obj', returnFalse)}\n`;

        if (languageDefinition.isTypesafeLanguage) {
            body += `\t\t${languageDefinition.ifStatement(
                languageDefinition.compareTypeOfObjectsMethod(languageDefinition.thisKeyword, 'obj', true), returnFalse)}\n`;
        }

        body += properties.map((property) => {
            switch (property.type) {
                case languageDefinition.intKeyword:
                case languageDefinition.numberKeyword:
                case languageDefinition.booleanKeyword:
                    return `\t\t${languageDefinition.ifStatement(
                        languageDefinition.simpleComparison(`${languageDefinition.thisKeyword}.${property.name}`, `obj.${property.name}`, true), returnFalse)}`;
                default:
                    return `\t\t${languageDefinition.ifStatement(
                        languageDefinition.equalMethod(`${languageDefinition.thisKeyword}.${property.name}`, `obj.${property.name}`, true), returnFalse)}`;
            }
        }).join('\n');

        body += `\n\t\t${languageDefinition.returnDeclaration(languageDefinition.trueKeyword)}`;
        return new MethodDefinition(
            'isEqual',
            languageDefinition.booleanKeyword,
            [new PropertyDefinition('obj', new TypeDefinition(languageDefinition.anyTypeKeyword))],
            body);
    }

    parseProperties(languageDefinition, properties, requiredProperties) {
        return Object.entries(properties).map((property) => {
            const propertyName = property[0];
            const propertyType = this.getPropertyType(languageDefinition, property[1]);

            let required = false;
            if (requiredProperties && requiredProperties.indexOf(propertyName) > -1) {
                required = true;
            }

            return new PropertyDefinition(propertyName, propertyType, null, required);
        });
    }

    getPropertyType(languageDefinition, property) {
        if (property.type === "string") {
            return new TypeDefinition(languageDefinition.stringKeyword, true);
        }
        if (property.type === "number") {
            return new TypeDefinition(languageDefinition.numberKeyword, true);
        }
        if (property.type === "integer") {
            return new TypeDefinition(languageDefinition.intKeyword, true);
        }
        if (property.type === "boolean") {
            return new TypeDefinition(languageDefinition.booleanKeyword, true);
        }
        if (property.type === "array") {
            return new TypeDefinition(languageDefinition.arrayKeyword, true, this.getPropertyType(languageDefinition, property.items));
        }
        if (property.type === "object") {
            return new TypeDefinition(languageDefinition.mapKeyword, true);
        }

        return new TypeDefinition(this.getTypeReferingToAnotherClass(property), false);
    }

    getTypeReferingToAnotherClass(property) {
        const definitionsString = "#/definitions/";
        const definitionIndex = property.$ref.indexOf(definitionsString);
        if (definitionIndex > -1) {
            return property.$ref.substr(definitionIndex + definitionsString.length);
        }
    }
}