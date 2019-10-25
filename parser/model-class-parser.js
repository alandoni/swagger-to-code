const PropertyDefinition = require('./definitions/property-definition');
const ConstrutorDefinition = require('./definitions/constructor-definition');
const MethodDefinition = require('./definitions/method-definition');
const EnumDefinition = require('./definitions/enum-definition');
const ClassDefinition = require('./definitions/class-definition');
const TypeDefinition = require('./definitions/type-definition');
const ParameterDefinition = require('./definitions/parameter-definition');

module.exports = class ModelClassParser {
    parse(languageDefinition, definition) {
        const className = definition.name;
        const properties = ModelClassParser.parseProperties(languageDefinition, definition.properties, definition.requiredProperties);
        
        const dependencies = ModelClassParser.parseDependencies(definition);

        const enums = this.parseEnums(definition.properties);

        const methods = [this.getCopyMethod(languageDefinition, className, properties),
            this.getIsEqualMethod(languageDefinition, className, properties)];

        const constructors = [this.parseConstructors(languageDefinition, className, properties)];

        return new ClassDefinition(className, properties, constructors, methods, enums, dependencies, true);
    }

    static parseDependencies(definition) {
        return definition.references.map((reference) => {
            return reference.definition;
        });
    }

    parseConstructors(languageDefinition, className, properties) {
        return new ConstrutorDefinition(className, properties.map((property) => {
            return ParameterDefinition.fromProperty(property, [languageDefinition.constKeyword]);
        }));
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

        return new MethodDefinition('copy', new TypeDefinition(className), null, body);
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
            languageDefinition.equalMethodName,
            new TypeDefinition(languageDefinition.booleanKeyword),
            [new ParameterDefinition('obj', new TypeDefinition(languageDefinition.anyTypeKeyword))],
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
            return new TypeDefinition(languageDefinition.mapKeyword, false, null, isEnum);
        }

        return new TypeDefinition(property.type.name || property.type, false, null, isEnum);
    }
}