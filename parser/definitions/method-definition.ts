import TypeDefinition from "./type-definition";
import ParameterDefinition from "./parameter-definition";
import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class MethodDefinition implements PrintableLanguageElements {
  name: string;
  returnType: TypeDefinition;
  parameters: Array<ParameterDefinition>;
  body: string;
  modifiers: Array<string>;

  constructor(name: string, returnType: TypeDefinition, parameters: Array<ParameterDefinition>, body: string, modifiers: Array<string> = null) {
    this.name = name;
    this.returnType = returnType;
    this.parameters = parameters;
    this.body =  body;
    this.modifiers = modifiers;
  }

  print(languageDefinition: LanguageDefinition) {
    return languageDefinition.methodDeclaration(
      this.name,
      this.parameters,
      this.returnType,
      this.body,
      this.modifiers);
  }
}

export default MethodDefinition;