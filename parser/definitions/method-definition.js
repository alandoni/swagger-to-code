class MethodDefinition {
  constructor(name, returnType, parameters, body, visiblity) {
    this.name = name;
    this.returnType = returnType;
    this.parameters = parameters;
    this.body =  body;
    this.visiblity = visiblity;
  }

  print(languageDefinition) {
    return languageDefinition.methodDeclaration(
      this.name,
      this.parameters,
      this.returnType,
      this.body);
  }
}

module.exports = MethodDefinition;