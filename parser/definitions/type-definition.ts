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

    static typeBySplittingPackageAndName(packageString: string, subtypeIfNeeded: string): TypeDefinition {
        const names = packageString.split('.');
        let name = names[names.length - 1];
        let subtype = null;
        let newPackageString = packageString;
        if (name.indexOf('<$this>') > -1) {
            subtype = new TypeDefinition(subtypeIfNeeded, false, null, false);
            name = name.substr(0, name.indexOf('<$this>'));
            newPackageString = packageString.substr(0, packageString.indexOf('<$this>'));
        }
        const type = new TypeDefinition(name, false, subtype, false);
        type.package = newPackageString;
        return type;
    }
}

export default TypeDefinition;