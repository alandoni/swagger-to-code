import TypeDefinition from "./type-definition";
import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class PropertyDefinition implements PrintableLanguageElements {
    name: string;
    type: TypeDefinition;
    value: string;
    required: boolean;
    isPrivate: boolean;

    constructor(name: string, type: TypeDefinition, value: string, required: boolean = false, isPrivate: boolean = false) {
        this.name = name;
        this.type = type;
        this.value = value;
        this.required = required;
        this.isPrivate = isPrivate;
    }

    print(languageDefinition: LanguageDefinition) {
        let visibility = languageDefinition.publicKeyword;
        if (this.isPrivate) {
            visibility = languageDefinition.privateKeyword;
        }
        return languageDefinition.fieldDeclaration(
            visibility, 
            this.name, 
            this.type,
            this.value);
    }
}

export default PropertyDefinition;
