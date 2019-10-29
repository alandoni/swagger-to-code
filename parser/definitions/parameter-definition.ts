import TypeDefinition from "./type-definition";
import PropertyDefinition from "./property-definition";
import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class ParameterDefinition extends PropertyDefinition implements PrintableLanguageElements {
  modifiers: Array<string>;

  constructor(name: string, type: TypeDefinition, value: string = null, required: boolean = false, modifiers: Array<string> = []) {
    super(name, type, value, required, false);
    this.modifiers = modifiers;
  }

  static fromProperty(property: PropertyDefinition, modifiers: Array<string> = []): ParameterDefinition {
    return new ParameterDefinition(property.name, 
      property.type, 
      property.value, 
      property.required, 
      modifiers);
  }

  print(languageDefinition: LanguageDefinition) {
      return languageDefinition.parameterDeclaration(this);
  }
}

export default ParameterDefinition;
