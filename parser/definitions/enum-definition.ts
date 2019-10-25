import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class EnumDefinition implements PrintableLanguageElements {
    name: string;
    values: Array<string>;

    constructor(name: string, values: Array<string>) {
        this.name = name;
        this.values = values;
    }

    print(languageDefinition: LanguageDefinition)  {
        return languageDefinition.enumDeclaration(this.name, this.values);
    }
}

export default EnumDefinition;
