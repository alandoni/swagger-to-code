const PropertyDefinition = require("./definitions/property-definition");

module.exports = class ModelClassParser {
    parse(languageDefinition, classDefinition) {
        let modelClassString = `${languageDefinition.importDeclarations(classDefinition.dependencies)}\n\n`;

        let classBody = '';

        const constructor = this.parseConstructor(languageDefinition, classDefinition.name, classDefinition.properties);
        let methods = [this.getCopyMethod(languageDefinition, classDefinition.name, classDefinition.properties),
            this.getIsEqualMethod(languageDefinition, classDefinition.name, classDefinition.properties)];

        let enumsString = '';
        if (classDefinition.enums && classDefinition.enums.length > 0) {
            enumsString = this.parseEnums(languageDefinition, classDefinition.enums);
        }

        let propertiesString = '';
        if (!languageDefinition.useDataclassForModels) {
            propertiesString = this.parseProperties(languageDefinition, classDefinition.properties);
            classBody += `${propertiesString}\n\n${methods.join('\n\n')}`;
        } else {
            classBody = `\n${methods.join('\n\n')}`;
        }

        if (enumsString.length > 0) {
            classBody += `\n\n${enumsString}`;
        }

        if (!languageDefinition.useDataclassForModels) {
            methods.splice(0, 0, constructor)
            modelClassString += languageDefinition.classDeclaration(classDefinition.name, null, classBody);
        } else {
            modelClassString += languageDefinition.classDeclaration(classDefinition.name, null, classBody, true, classDefinition.properties);
        }

        console.log(modelClassString);
        return modelClassString;
    }

    parseConstructor(languageDefinition, className, properties) {
        return `\t${languageDefinition.constructorDeclaration(className, properties, className, '', languageDefinition.useDataclassForModels)}`;
    }

    parseProperties(languageDefinition, properties) {
        return properties.map((property) => {
            return `\t${ModelClassParser.getProperty(languageDefinition, property.name, property.type, null)}`;
        }).join('\n');
    }

    getCopyMethod(languageDefinition, className, properties) {
        let body = `\t\t${languageDefinition.variableDeclaration(languageDefinition.constKeyword, className, 'newObject', `${languageDefinition.constructObject(className)}`)}\n`;
        
        body += properties.map((property) => {
            return `\t\t${languageDefinition.assignment(`newObject.${property.name}`, `${languageDefinition.thisKeyword}.${property.name}`)}`;
        }).join('\n');
        body += `\n\t\t${languageDefinition.returnDeclaration('newObject')}`;

        return `\t${languageDefinition.methodDeclaration('copy', null, null, body)}`;
    }

    getIsEqualMethod(languageDefinition, className, properties) {
        const returnFalse = `\t\t\t${languageDefinition.returnDeclaration(languageDefinition.falseKeyword)}`;
        let functionString = `\t\t${languageDefinition.ifNullStatement('obj', returnFalse)}\n`;

        if (languageDefinition.isTypesafeLanguage) {
            functionString += `\t\t${languageDefinition.ifStatement(
                languageDefinition.compareTypeOfObjectsMethod(languageDefinition.thisKeyword, 'obj', true), returnFalse)}\n`;
        }

        functionString += properties.map((property) => {
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

        functionString += `\n\t\t${languageDefinition.returnDeclaration(languageDefinition.trueKeyword)}`;
        return `\t${languageDefinition.methodDeclaration('isEqual', [new PropertyDefinition('obj', languageDefinition.anyTypeKeyword)], 
            languageDefinition.booleanKeyword, functionString)}`;
    }

    static getProperty(languageDefinition, name, type, value = null, isPrivate = false) {
        let visibility = languageDefinition.publicKeyword;
        if (isPrivate) {
            visibility = languageDefinition.privateKeyword;
        }
        return `${languageDefinition.fieldDeclaration(visibility, name, type, value)}`;
    }

    parseEnums(languageDefinition, enums) {
        return enums.map((enumDefinition) => {
            return languageDefinition.enumDeclaration(enumDefinition.name, enumDefinition.values);
        }).join('\n\n');
    }
}