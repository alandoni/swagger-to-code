class PropertyDefinition {
    constructor(name, type, value, required = false, isPrivate) {
        this.name = name;
        this.type = type;
        this.value = value;
        this.required = required;
        this.isPrivate = isPrivate;
    }

    print(languageDefinition) {
        let visibility = languageDefinition.publicKeyword;
        if (this.isPrivate) {
            visibility = languageDefinition.privateKeyword;
        }
        return languageDefinition.fieldDeclaration(
            visibility, 
            this.name, 
            this.type,
            this.value);
    }
}

module.exports = PropertyDefinition;
