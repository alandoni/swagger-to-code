const PropertyDefinition = require('./definitions/property-definition');
const ConstrutorDefinition = require('./definitions/constructor-definition');
const MethodDefinition = require('./definitions/method-definition');
const EnumDefinition = require('./definitions/enum-definition');
const ClassDefinition = require('./definitions/class-definition');
const TypeDefinition = require('./definitions/type-definition');

module.exports = class ModelClassParser {
    parse(languageDefinition, definition) {
        const className = definition.name;
        const properties = ModelClassParser.parseProperties(languageDefinition, definition.properties, definition.requiredProperties);
        
        const dependencies = ModelClassParser.parseDependencies(properties);

        const enums = this.parseEnums(definition.properties);

        const methods = [this.getCopyMethod(languageDefinition, className, properties),
            this.getIsEqualMethod(languageDefinition, className, properties)];

        const constructors = [this.parseConstructors(className, properties)];

        return new ClassDefinition(className, properties, constructors, methods, enums, dependencies, true);
    }

    static parseDependencies(properties) {
        return properties.map((property) => {
            if (property.type.subtype) {
                if (!property.type.subtype.isNative) {
                    return property.type.subtype;
                }
                return null;
            } else {
                if (!property.type.isNative) {
                    return property.type;
                }
                return null;
            }
        }).filter((property) => {
            return property != null;
        });
    }

    parseConstructors(className, properties) {
        return new ConstrutorDefinition(className, properties);
    }

    parseEnums(properties) {
        return properties.map((property) => {
            if (!property.enum) {
                return null;
            }

            const enumName = property.name.substr(0, 1).toUpperCase() + property.name.substr(1);
            return new EnumDefinition(enumName, property.enum);
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

    static parseProperties(languageDefinition, properties, requiredProperties) {
        return properties.map((property) => {
            const propertyType = this.getPropertyType(languageDefinition, property);

            let required = false;
            if (requiredProperties && requiredProperties.indexOf(property.name) > -1) {
                required = true;
            }

            return new PropertyDefinition(property.name, propertyType, property.default, required);
        });
    }

    static getPropertyType(languageDefinition, property) {
        let isEnum = false;
        if (property.enum) {
            isEnum = true;
        }

        if (property.type === 'string') {
            return new TypeDefinition(languageDefinition.stringKeyword, true, null, isEnum);
        }
        if (property.type === 'number') {
            return new TypeDefinition(languageDefinition.numberKeyword, true, null, isEnum);
        }
        if (property.type === 'integer') {
            return new TypeDefinition(languageDefinition.intKeyword, true, null, isEnum);
        }
        if (property.type === 'boolean') {
            return new TypeDefinition(languageDefinition.booleanKeyword, true, null, isEnum);
        }
        if (property.type === 'array') {
            return new TypeDefinition(languageDefinition.arrayKeyword, true, this.getPropertyType(languageDefinition, property.items), isEnum);
        }
        if (property.type === 'object') {
            return new TypeDefinition(languageDefinition.mapKeyword, true, null, isEnum);
        }

        return new TypeDefinition(this.getTypeReferingToAnotherClass(property), false, null, isEnum);
    }

    static getTypeReferingToAnotherClass(property) {
        const definitionsString = '#/definitions/';
        const definitionIndex = property.type.indexOf(definitionsString);
        if (definitionIndex > -1) {
            return property.type.substr(definitionIndex + definitionsString.length);
        }
    }
}