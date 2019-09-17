class ConstructorDefinition {
  constructor(className, properties) {
    this.className = className;
    this.properties = properties;
  }

  print(languageDefinition) {
    return languageDefinition.constructorDeclaration(
      this.className,
      this.properties, 
      this.className,
      '',
      languageDefinition.useDataclassForModels);
  }
}

module.exports = ConstructorDefinition;