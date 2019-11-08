import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class TypeDefinition implements PrintableLanguageElements {
    package: string;
    name: string;
    subType: TypeDefinition;
    isNative: boolean;
    isEnum: boolean;
    nullable: boolean;

    constructor(name: string, isNative: boolean = false, subType: TypeDefinition = null, isEnum: boolean = false, nullable: boolean = false) {
        if (!name) {
            throw new Error('You must define a name');
        }
        this.name = name;
        this.subType = subType;
        this.isNative = isNative;
        this.isEnum = isEnum;
        this.nullable = nullable;
    }

    print(languageDefinition: LanguageDefinition) {
        return languageDefinition.printType(this);
    }

    static typeBySplittingPackageAndName(packageString: string, subTypeIfNeeded: string): TypeDefinition {
        const names = packageString.split('.');
        let name = names[names.length - 1];
        let subtype = null;
        let newPackageString = packageString;
        if (name.indexOf('<$this>') > -1) {
            subtype = new TypeDefinition(subTypeIfNeeded, false, null, false);
            name = name.substr(0, name.indexOf('<$this>'));
            newPackageString = packageString.substr(0, packageString.indexOf('<$this>'));
        }
        const type = new TypeDefinition(name, false, subtype, false);
        type.package = newPackageString;
        return type;
    }
}

export default TypeDefinition;