module.exports = class ModelClassParser {
    parse(languageDefinition, object) {
        const modelClasses = Object.entries(object.definitions).map((definition) => {
            const className = definition[0];
            const properties = this.getProperties(languageDefinition, definition[1].properties);

            let modelClassString = "";
            if (languageDefinition.useDataclassForModels) {
                modelClassString = `${languageDefinition.dataClassKeyword} ${className}`;
            } else {
                modelClassString = `${languageDefinition.classKeyword} ${className}`;
            }

            let methods = this.getCopyMethod(languageDefinition, className, properties);

            let propertiesString = this.parseProperties(languageDefinition, properties);
            let constructor = `(\n${propertiesString}\n)`;

            if (languageDefinition.shouldConstructorDefineProperties) {
                propertiesString = "";
            }

            if (languageDefinition.isConstructorInClassDefinition) {
                modelClassString = `${modelClassString}${constructor} {\n${methods}\n}`;
            } else {
                const classContentString = `${propertiesString}\n${methods}`;
                modelClassString = `${modelClassString} {\n${classContentString}\n}`;
            }
            console.log(modelClassString);
            return modelClassString;
        });
    }

    getProperties(languageDefinition, properties) {
        return Object.entries(properties).map((property) => {
            const [propertyName, propertyType] = this.getProperty(languageDefinition, property);
            return { name: propertyName, type: propertyType };
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
        let functionString = `\t${languageDefinition.functionKeyword} copy()`;
        if (languageDefinition.isTypesafeLanguage) {
            functionString += ` ${languageDefinition.functionReturnTypeSeparator} ${className}`;
        }
        functionString += ' {\n';
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
}