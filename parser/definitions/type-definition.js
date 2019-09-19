class TypeDefinition {
  constructor(name, isNative, subtype, isEnum) {
    this.name = name;
    this.subtype = subtype;
    this.isNative = isNative;
    this.isEnum = isEnum;
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