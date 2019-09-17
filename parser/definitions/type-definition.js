class TypeDefinition {
  constructor(name, isNativeType, subtype) {
    this.name = name;
    this.subtype = subtype;
    this.isNativeType = isNativeType;
  }

  print(languageDefinition) {
    if (this.subtype) {
      return `${this.name}<${this.subtype.print(languageDefinition)}>`;
    } else {
      return this.name;
    }
  }
}

module.exports = TypeDefinition;