class EnumDefinition {
    constructor(name, values) {
        this.name = name;
        this.values = values;
    }

    print(languageDefinition)  {
        return languageDefinition.enumDeclaration(this.name, this.values);
    }
}

module.exports = EnumDefinition;
