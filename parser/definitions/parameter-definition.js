const PropertyDefinition = require('./property-definition');

class ParameterDefinition extends PropertyDefinition {
  constructor(name, type, value, required = false, modifiers = []) {
    super(name, type, value, required);
    this.modifiers = modifiers;
  }

  static fromProperty(property, modifiers = []) {
    return new ParameterDefinition(property.name, 
      property.type, 
      property.value, 
      property.required, 
      modifiers);
  }

  print(languageDefinition) {
      return languageDefinition.parameterDeclaration(this);
  }
}

module.exports = ParameterDefinition;
