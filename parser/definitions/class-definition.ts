import PropertyDefinition from "./property-definition";
import ConstructorDefinition from "./constructor-definition";
import MethodDefinition from "./method-definition";
import EnumDefinition from "./enum-definition";
import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";
import TypeDefinition from "./type-definition";

class ClassDefinition implements PrintableLanguageElements {
    package: string;
    name: string;
    properties: Array<PropertyDefinition>;
    constructors: Array<ConstructorDefinition>;
    methods: Array<MethodDefinition>;
    enums: Array<EnumDefinition>;
    dependencies: Array<string>;
    isDataClass: boolean;
    inheritsFrom: TypeDefinition;
    implements: Array<TypeDefinition>;

    constructor(packageString: string, name: string, properties: Array<PropertyDefinition>, constructors: Array<ConstructorDefinition>, 
            methods: Array<MethodDefinition>, enums: Array<EnumDefinition> = [], 
            dependencies: Array<string> = [], isDataClass: boolean = false) {
        this.package = packageString;
        this.name = name;
        this.properties = properties;
        this.constructors = constructors;
        this.methods = methods;
        this.enums = enums;
        this.dependencies = dependencies;
        this.isDataClass = isDataClass;
    }

    print(languageDefinition: LanguageDefinition) {
        const packageString = languageDefinition.printPackage(this.package);

        const imports = languageDefinition.importDeclarations(this.dependencies);

        let constructors = '';

        if (!languageDefinition.constructorAlsoDeclareFields && this.constructors) {
            constructors = this.constructors.map((construct) => {
                return `\t${construct.print(languageDefinition)}`;
            }).join('\n\n');
        }

        let enums = '';
        if (this.enums) {
            enums = this.enums.map((enumDeclaration) => {
                return `${enumDeclaration.print(languageDefinition)}`;
            }).join('\n\n');
        }

        let properties = '';
        let methods = this.methods;
        if (!languageDefinition.useDataclassForModels || !this.isDataClass) {
            if (languageDefinition.needDeclareFields || !this.isDataClass) {
                properties = this.properties.map((property) => {
                    return `\t${property.print(languageDefinition)}`;
                }).join('\n\n');
            }

            if (this.constructors) {
                methods = [...this.constructors, ...this.methods];
            }
        }

        const methodsString = methods.map((method) => {
            return `\t${method.print(languageDefinition)}`;
        }).join('\n\n');

        const classBody = [properties, constructors, methodsString, enums].filter((string) => {
            return string.length > 0;
        }).join('\n\n');

        let modelClassString;
        if (!languageDefinition.useDataclassForModels || !this.isDataClass) {
            modelClassString = languageDefinition.classDeclaration(this.name, this.inheritsFrom, this.implements, classBody, false, null);
        } else{
            modelClassString = languageDefinition.classDeclaration(this.name, this.inheritsFrom, this.implements, classBody, true, this.constructors);
        }
        return [packageString, imports, modelClassString].join('\n\n');
    }
}

export default ClassDefinition;
