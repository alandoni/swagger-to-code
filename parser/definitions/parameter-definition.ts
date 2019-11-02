import TypeDefinition from "./type-definition";
import PropertyDefinition from "./property-definition";
import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class ParameterDefinition extends PropertyDefinition implements PrintableLanguageElements {

  constructor(name: string, type: TypeDefinition, value: string = null, modifiers: Array<string> = []) {
    super(name, type, value, modifiers);
  }

  static fromProperty(property: PropertyDefinition): ParameterDefinition {
    return new ParameterDefinition(property.name, 
      property.type, 
      property.value, 
      property.modifiers);
  }

  print(languageDefinition: LanguageDefinition) {
      return languageDefinition.parameterDeclaration(this);
  }
}

export default ParameterDefinition;
