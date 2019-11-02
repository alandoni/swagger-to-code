import TypeDefinition from "./type-definition";
import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class PropertyDefinition implements PrintableLanguageElements {
    name: string;
    type: TypeDefinition;
    value: string;
    modifiers: Array<string>;

    constructor(name: string, type: TypeDefinition, value: string = null, modifiers: Array<string> = []) {
        this.name = name;
        this.type = type;
        this.value = value;
        this.modifiers = modifiers;
    }

    print(languageDefinition: LanguageDefinition) {
        return languageDefinition.fieldDeclaration(
            this.name, 
            this.type,
            this.value,
            this.modifiers);
    }
}

export default PropertyDefinition;
