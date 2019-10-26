import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class TypeDefinition implements PrintableLanguageElements {
    package: string;
    name: string;
    subtype: TypeDefinition;
    isNative: boolean;
    isEnum: boolean;

    constructor(name: string, isNative: boolean = false, subtype: TypeDefinition = null, isEnum: boolean = false) {
        this.name = name;
        this.subtype = subtype;
        this.isNative = isNative;
        this.isEnum = isEnum;
    }

    print(languageDefinition: LanguageDefinition) {
        if (this.subtype) {
            return `${this.name}<${this.subtype.print(languageDefinition)}>`;
        } else {
            return this.name;
        }
    }

    static typeBySplittingPackageAndName(packageString: string): TypeDefinition {
        const names = packageString.split('.');
        const name = names[names.length - 1];
        const type = new TypeDefinition(name, false, null, false);
        type.package = packageString;
        return type;
    }
}

export default TypeDefinition;