class Property {
    constructor(name, type, enumDefinition = null) {
        this.name = name;
        this.type = type;
        this.enumDefinition = enumDefinition;
    }
}

class EnumDefinition {
    constructor(name, values) {
        this.name = name;
        this.values = values;
    }
}

module.exports = class ModelClassParser {
    parse(languageDefinition, object) {
        const modelClasses = Object.entries(object.definitions).map((definition) => {
            const enums = [];
            const className = definition[0];
            const properties = this.getProperties(languageDefinition, definition[1].properties);

            properties.filter((property) => {
                return property.enumDefinition != null;
            }).map((property) => {
                enums.push(property.enumDefinition);
            });

            let modelClassString = "";
            if (languageDefinition.useDataclassForModels) {
                modelClassString = `${languageDefinition.dataClassKeyword} ${className}`;
            } else {
                modelClassString = `${languageDefinition.classKeyword} ${className}`;
            }

            let methodsString = `${this.getCopyMethod(languageDefinition, className, properties)}\n\n`;
            methodsString += `${this.getIsEqualMethod(languageDefinition, className, properties)}`;

            let enumsString = "";
            if (enums && enums.length > 0) {
                enumsString = `\n\n${this.parseEnums(languageDefinition, enums)}`;
            }

            let propertiesString = this.parseProperties(languageDefinition, properties);
            let constructor = `(\n${propertiesString}\n)`;

            if (languageDefinition.shouldConstructorDefineProperties) {
                propertiesString = "";
            }

            if (languageDefinition.isConstructorInClassDefinition) {
                modelClassString = `${modelClassString}${constructor} {\n${methodsString}${enumsString}\n}`;
            } else {
                const classContentString = `${propertiesString}\n${methodsString}${enumsString}`;
                modelClassString = `${modelClassString} {\n${classContentString}\n}`;
            }
            console.log(modelClassString);
            return modelClassString;
        });
    }

    getProperties(languageDefinition, properties) {
        return Object.entries(properties).map((property) => {
            let [propertyName, propertyType] = this.getProperty(languageDefinition, property);

            let enumDefinition = null;
            if (property[1].enum) {
                const enumName = propertyName.substr(0, 1).toUpperCase() + propertyName.substr(1);
                propertyType = enumName;
                enumDefinition = new EnumDefinition(enumName, property[1].enum);
            }

            return new Property(propertyName, propertyType, enumDefinition);
        });
    }

    parseProperties(languageDefinition, properties) {
        let propertiesString = "";
        properties.map((property, index, array) => {
            let propertyString = `\t${languageDefinition.propertyKeyword} `;
            if (languageDefinition.isTypesafeLanguage) {
                if (languageDefinition.isPropertyTypeAfterName) {
                    propertyString += `${property.name} ${languageDefinition.propertyTypeSeparator} ${property.type}`;
                } else {
                    propertyString += `${property.type} ${languageDefinition.propertyTypeSeparator} ${property.name}`;
                }
            } else {
                propertyString += `${property.name}`;
            }
            if (languageDefinition.shouldConstructorDefineProperties) {
                if (index < array.length - 1) {
                    propertyString += ",\n"
                }
            } else {
                propertyString += ";\n"
            }
            propertiesString +=`${propertyString}`;
        });
        return propertiesString;
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
            `obj ${languageDefinition.propertyTypeSeparator} ${languageDefinition.anyTypeKeyword}`);

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

    static createFunctionHeader(languageDefinition, functionName, returnType, args = "") {
        let functionString = `\t${languageDefinition.functionKeyword} ${functionName}(${args})`;
        if (languageDefinition.isTypesafeLanguage) {
            functionString += ` ${languageDefinition.functionReturnTypeSeparator} ${returnType}`;
        }
        functionString += ' {\n';
        return functionString;
    }

    parseEnums(languageDefinition, enums) {
        let enumString = "";
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