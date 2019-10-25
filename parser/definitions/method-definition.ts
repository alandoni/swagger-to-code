import TypeDefinition from "./type-definition";
import ParameterDefinition from "./parameter-definition";
import LanguageDefinition from "../../languages/language-definition";
import PrintableLanguageElements from "./printable-language-elements";

class MethodDefinition implements PrintableLanguageElements {
  name: string;
  returnType: TypeDefinition;
  parameters: Array<ParameterDefinition>;
  body: string;
  visiblity: string;

  constructor(name: string, returnType: TypeDefinition, parameters: Array<ParameterDefinition>, body: string, visiblity: string) {
    this.name = name;
    this.returnType = returnType;
    this.parameters = parameters;
    this.body =  body;
    this.visiblity = visiblity;
  }

  print(languageDefinition: LanguageDefinition) {
    return languageDefinition.methodDeclaration(
      this.name,
      this.parameters,
      this.returnType,
      this.body);
  }
}

export default MethodDefinition;