const PropertyDefinition = require("./definitions/property-definition");

module.exports = class ModelClassParser {
    parse(languageDefinition, classDefinition) {
        let modelClassString = '';
        if (languageDefinition.useDataclassForModels) {
            modelClassString = `${languageDefinition.dataClassKeyword} ${classDefinition.name}`;
        } else {
            modelClassString = `${languageDefinition.classKeyword} ${classDefinition.name}`;
        }

        let methodsString = `${this.getCopyMethod(languageDefinition, classDefinition.name, classDefinition.properties)}\n\n`;
        methodsString += `${this.getIsEqualMethod(languageDefinition, classDefinition.name, classDefinition.properties)}`;

        let enumsString = '';
        if (classDefinition.enums && classDefinition.enums.length > 0) {
            enumsString = `\n\n${this.parseEnums(languageDefinition, classDefinition.enums)}`;
        }

        let propertiesString = this.parseProperties(languageDefinition, classDefinition.properties);
        let constructorString = this.parseConstructor(languageDefinition, classDefinition.name, classDefinition.properties);

        if (languageDefinition.shouldConstructorDefineProperties) {
            propertiesString = '';
        }

        if (languageDefinition.isConstructorInClassDefinition) {
            modelClassString = `${modelClassString}${constructorString} {\n${methodsString}${enumsString}\n}`;
        } else {
            const classContentString = `${propertiesString}\n${constructorString}\n${methodsString}${enumsString}`;
            modelClassString = `${modelClassString} {\n${classContentString}\n}`;
        }
        //console.log(modelClassString);
        return modelClassString;
    }

    parseConstructor(languageDefinition, className, properties) {
        let constructorString = '';
        if (languageDefinition.shouldConstructorDefineProperties) {
            if (languageDefinition.isConstructorHeaderEnoughToDefineProperties) {
                const propertiesString = this.parseProperties(languageDefinition, properties);
                constructorString += `(\n${propertiesString}\n)`;
            } else {
                constructorString += ModelClassParser.createFunctionHeader(languageDefinition, languageDefinition.constructKeyword, 
                    className, ModelClassParser.propertiesAsParameter(languageDefinition, properties));
                properties.map((property, index, array) => {
                    constructorString += `\t\t${languageDefinition.thisKeyword}.${property.name} = ${property.name};\n`;
                });
                constructorString += '\t}\n'
            }
        }
        return constructorString;
    }

    parseProperties(languageDefinition, properties) {
        let propertiesString = '';
        properties.map((property, index, array) => {
            let propertyString = `\t${ModelClassParser.getProperty(languageDefinition, property.name, property.type, null,
                languageDefinition.shouldConstructorDefineProperties, index < array.length - 1)}`;
            propertiesString +=`${propertyString}`;
        });
        return propertiesString;
    }

    getCopyMethod(languageDefinition, className, properties) {
        let functionString = ModelClassParser.createFunctionHeader(languageDefinition, 'copy', className);
        functionString += `\t\t${languageDefinition.constKeyword} newObject`;
        if (languageDefinition.isTypesafeLanguage) {
            functionString += ` ${languageDefinition.propertyTypeSeparator} ${className}`;
        }

        functionString += ' = ';
        
        if (languageDefinition.newKeyword.length > 0) {
            functionString += `${languageDefinition.newKeyword} `;
        }
        functionString += `${className}();\n`;

        properties.map((property) => {
            functionString += `\t\tnewObject.${property.name} = ${languageDefinition.thisKeyword}.${property.name};\n`
        });
        functionString += `\t\t${languageDefinition.returnKeyword} newObject;\n\t}`;
        return functionString;
    }

    getIsEqualMethod(languageDefinition, className, properties) {
        let functionString = ModelClassParser.createFunctionHeader(languageDefinition, 'isEqual', languageDefinition.booleanKeyword, 
            ModelClassParser.propertiesAsParameter(languageDefinition, [new PropertyDefinition('obj', languageDefinition.anyTypeKeyword)]));

        if (languageDefinition.shouldCompareToNull) {
            functionString += `\t\tif (${languageDefinition.simpleComparison('obj', languageDefinition.nullKeyword)}) {\n`;
        } else {
            functionString += `\t\tif (!obj) {\n`;
        }
        functionString += `\t\t\treturn ${languageDefinition.falseKeyword}\n\t\t}\n`;

        if (languageDefinition.isTypesafeLanguage) {
            functionString += `\t\tif (${languageDefinition.compareTypeOfObjectsMethod(languageDefinition.thisKeyword, 'obj', true)}) {\n`;
            functionString += `\t\t\treturn ${languageDefinition.falseKeyword}\n\t\t}\n`;
        }

        properties.map((property) => {
            switch (property.type) {
                case languageDefinition.intKeyword:
                case languageDefinition.numberKeyword:
                case languageDefinition.booleanKeyword:
                    functionString += `\t\tif (${languageDefinition.simpleComparison(`${languageDefinition.thisKeyword}.${property.name}`, `obj.${property.name}`, true)}) {\n`;
                    break;
                default:
                    functionString += `\t\tif (${languageDefinition.equalMethod(`${languageDefinition.thisKeyword}.${property.name}`, `obj.${property.name}`, true)}) {\n`;
                    break;
            }
            functionString += `\t\t\treturn ${languageDefinition.falseKeyword}\n\t\t}\n`;
        });

        functionString += `\t\t${languageDefinition.returnKeyword} ${languageDefinition.trueKeyword};\n\t}`;
        return functionString;
    }

    static getProperty(languageDefinition, name, type, value = null, isPrivate = false, shouldConstructorDefineProperties = false, isLastProperty = false) {
        let propertyString = '';
        if (isPrivate) {
            propertyString += `${languageDefinition.privateKeyword} `;
        }
        propertyString += `${languageDefinition.propertyKeyword} `;
        if (languageDefinition.isTypesafeLanguage) {
            if (languageDefinition.isPropertyTypeAfterName) {
                propertyString += `${name} ${languageDefinition.propertyTypeSeparator} ${type}`;
            } else {
                propertyString += `${type} ${languageDefinition.propertyTypeSeparator} ${name}`;
            }
        } else {
            propertyString += `${name}`;
        }
        if (value) {
            if (type === languageDefinition.stringKeyword) {
                propertyString += ` = ${languageDefinition.stringQuote}${value}${languageDefinition.stringQuote}`;
            } else {
                propertyString += ` = ${value}`;
            }
        }
        if (shouldConstructorDefineProperties) {
            if (!isLastProperty) {
                propertyString += ",\n";
            }
        } else {
            propertyString += ";\n";
        }
        return propertyString;
    }

    static propertiesAsParameter(languageDefinition, arrayOfProperties) {
        let parameters = '';
        arrayOfProperties.map((property, index, array) => {
            parameters += property.name;
            
            if (languageDefinition.isTypesafeLanguage) {
                ` ${languageDefinition.propertyTypeSeparator} ${property.type}`;
            }
            if (index < array.length - 1) {
                parameters += ', ';
            }
        });
        return parameters;
    }

    static createFunctionHeader(languageDefinition, functionName, returnType, args = '') {
        let functionString = `\t`;

        if (languageDefinition.functionKeyword.length > 0) {
            functionString += `${languageDefinition.functionKeyword} `;
        }
        functionString += `${functionName}(${args})`;
        if (languageDefinition.isTypesafeLanguage) {
            functionString += ` ${languageDefinition.functionReturnTypeSeparator} ${returnType}`;
        }
        functionString += ' {\n';
        return functionString;
    }

    parseEnums(languageDefinition, enums) {
        let enumString = '';
        enums.map((enumDefinition, index, array) => {
            enumString += `\t${languageDefinition.enumKeyword} ${enumDefinition.name} {\n`;
            enumDefinition.values.map((value, index, array) => {
                enumString += `\t\t${value}`;
                if (index < array.length - 1) {
                    enumString += ",\n"
                }
            });
            enumString += "\n\t}";
            if (index < array.length - 1) {
                enumString += "\n\n";
            }
        });
        return enumString;
    }
}