import PropertyDefinition from "./property-definition";
import MethodDefinition from "./method-definition";
import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";
import TypeDefinition from "./type-definition";

class ConstructorDefinition extends MethodDefinition implements PrintableLanguageElements {
  properties: Array<PropertyDefinition>;

  constructor(className: string, properties: Array<PropertyDefinition>) {
    super(className, null, null, null, null);
    this.properties = properties;
  }

  print(languageDefinition: LanguageDefinition) {
    return languageDefinition.constructorDeclaration(
      this.name,
      this.properties,
      new TypeDefinition(this.name, false, null, null),
      '',
      languageDefinition.useDataclassForModels);
  }
}

export default ConstructorDefinition;