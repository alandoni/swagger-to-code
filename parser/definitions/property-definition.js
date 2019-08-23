class PropertyDefinition {
    constructor(name, type, enumDefinition = null, required = false) {
        this.name = name;
        this.type = type;
        this.enumDefinition = enumDefinition;
        this.required = required;
    }
}
module.exports = PropertyDefinition;
