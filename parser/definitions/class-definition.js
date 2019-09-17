class ClassDefinition {
    constructor(name, properties, constructors, methods, enums = [], dependencies = []) {
        this.name = name;
        this.properties = properties;
        this.constructors = constructors;
        this.methods = methods;
        this.enums = enums;
        this.dependencies = dependencies;
    }

    print(languageDefinition) {
        const imports = languageDefinition.importDeclarations(this.dependencies);

        let constructors = '';

        if (!languageDefinition.constructorAlsoDeclareFields) {
            constructors = this.constructors.map((construct) => {
                return `\t${construct.print(languageDefinition)}`;
            }).join('\n\n');
        }

        const methods = this.methods.map((method) => {
            return `\t${method.print(languageDefinition)}`;
        }).join('\n\n');

        const enums = this.enums.map((enumDeclaration) => {
            return `${enumDeclaration.print(languageDefinition)}`;
        }).join('\n\n');

        let properties = '';        
        if (!languageDefinition.useDataclassForModels) {
            if (languageDefinition.needDeclareFields) {
                properties = this.properties.map((property) => {
                    return `\t${property.print(languageDefinition)}`;
                }).join('\n\n');
            }
            this.methods.splice(0, 0, constructors);
        }

        const classBody = [properties, constructors, methods, enums].filter((string) => {
            return string.length > 0;
        }).join('\n\n');

        let modelClassString;
        if (!languageDefinition.useDataclassForModels) {
            modelClassString = languageDefinition.classDeclaration(this.name, null, classBody);
        } else {
            modelClassString = languageDefinition.classDeclaration(this.name, null, classBody, true, this.properties);
        }
        return [imports, modelClassString].join('\n\n');
    }
}

module.exports = ClassDefinition;
