class ClassDefinition {
    constructor(name, properties, constructors, methods, enums = [], dependencies = [], isDataClass = false) {
        this.name = name;
        this.properties = properties;
        this.constructors = constructors;
        this.methods = methods;
        this.enums = enums;
        this.dependencies = dependencies;
        this.isDataClass = isDataClass;
    }

    print(languageDefinition) {
        const imports = languageDefinition.importDeclarations(this.dependencies.map((dependency) => {
            return dependency.print();
        }));

        let constructors = '';

        if (!languageDefinition.constructorAlsoDeclareFields) {
            constructors = this.constructors.map((construct) => {
                return `\t${construct.print(languageDefinition)}`;
            }).join('\n\n');
        }

        const methods = this.methods.map((method) => {
            return `\t${method.print(languageDefinition)}`;
        }).join('\n\n');

        let enums = '';
        if (this.enums) {
            enums = this.enums.map((enumDeclaration) => {
                return `${enumDeclaration.print(languageDefinition)}`;
            }).join('\n\n');
        }

        let properties = '';        
        if (!languageDefinition.useDataclassForModels || !this.isDataClass) {
            if (languageDefinition.needDeclareFields || !this.isDataClass) {
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
        if (!languageDefinition.useDataclassForModels || !this.isDataClass) {
            modelClassString = languageDefinition.classDeclaration(this.name, null, classBody);
        } else{
            modelClassString = languageDefinition.classDeclaration(this.name, null, classBody, true, this.properties);
        }
        return [imports, modelClassString].join('\n\n');
    }
}

module.exports = ClassDefinition;
