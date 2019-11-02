import PropertyDefinition from "./property-definition";
import ConstructorDefinition from "./constructor-definition";
import MethodDefinition from "./method-definition";
import EnumDefinition from "./enum-definition";
import LanguageDefinition from "../../languages/language-definition";
import ClassDefinition from "./class-definition";
import KotlinLanguageDefinition from "../../languages/kotlin-language-definition";

class KotlinClassDefinition extends ClassDefinition {

    constructor(packageString: string, name: string, properties: Array<PropertyDefinition>, constructors: Array<ConstructorDefinition>, 
            methods: Array<MethodDefinition>, enums: Array<EnumDefinition> = [], 
            dependencies: Array<string> = [], isDataClass: boolean = false) {
        super(packageString, name, properties, constructors, methods, enums, dependencies, isDataClass);
    }

    print(languageDefinition: KotlinLanguageDefinition) {
        const packageString = languageDefinition.printPackage(this.package);

        const imports = languageDefinition.importDeclarations(this.dependencies);

        let constructors = '';

        if (!languageDefinition.constructorAlsoDeclareFields && this.constructors) {
            constructors = this.constructors.map((construct) => {
                if (this.inheritsFrom && !languageDefinition.constructorAlsoDeclareFields) {
                    construct.body = `\t\t${languageDefinition.emptySuperMethod}\n${construct.body}`;
                }
                return `\t${construct.print(languageDefinition)}`;
            }).join('\n\n');
        }

        let enums = '';
        if (this.enums) {
            enums = this.enums.map((enumDeclaration) => {
                return `${enumDeclaration.print(languageDefinition)}`;
            }).join('\n\n');
        }

        let propertiesString = '';
        let companionObjectBody = '';

        const { properties, staticProperties } = this.separateStaticFromNonStaticProperties(languageDefinition);
        let { methods, staticMethods } = this.separateStaticFromNonStaticMethods(languageDefinition);

        if (!this.isDataClass) {
            if (!this.isDataClass) {
                propertiesString = properties.map((property) => {
                    return `\t${property.print(languageDefinition)}`;
                }).join('\n\n');
            }

            if (this.constructors) {
                methods = [...this.constructors, ...this.methods];
            }
        }

        companionObjectBody = staticProperties.map((property) => {
            return `\t\t${property.print(languageDefinition)}`;
        }).join('\n\n');
        companionObjectBody += '\n';
        companionObjectBody += staticMethods.map((method) => {
            return `\t\t${method.print(languageDefinition)}`;
        }).join('\n\n');

        const methodsString = methods.map((method) => {
            return `\t${method.print(languageDefinition)}`;
        }).join('\n\n');

        let classBody = [propertiesString, constructors, methodsString, enums].filter((string) => {
            return string.length > 0;
        }).join('\n\n');

        classBody += `\n\n${languageDefinition.companionObject(companionObjectBody)}`;

        let modelClassString;
        if (!this.isDataClass) {
            modelClassString = languageDefinition.classDeclaration(this.name, this.inheritsFrom, this.implements, classBody, false, null);
        } else{
            modelClassString = languageDefinition.classDeclaration(this.name, this.inheritsFrom, this.implements, classBody, true, this.constructors);
        }
        return [packageString, imports, modelClassString].join('\n\n');
    }
    
    private separateStaticFromNonStaticProperties(languageDefinition: LanguageDefinition): any {
        const staticProperties = this.properties.filter((property) => {
            return property.modifiers && property.modifiers.includes(languageDefinition.staticKeyword);
        });
        const properties = this.properties.filter((property) => {
            return !property.modifiers || !property.modifiers.includes(languageDefinition.staticKeyword);
        });
        return { properties, staticProperties };
    }

    private separateStaticFromNonStaticMethods(languageDefinition: LanguageDefinition): any {
        const staticMethods = this.methods.filter((method) => {
            return method.modifiers && method.modifiers.includes(languageDefinition.staticKeyword);
        });
        const methods = this.methods.filter((method) => {
            return !method.modifiers || !method.modifiers.includes(languageDefinition.staticKeyword);
        });
        return { methods, staticMethods };
    }
}

export default KotlinClassDefinition;
