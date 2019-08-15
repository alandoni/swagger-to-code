class PropertyDefinition {
    constructor(name, type, enumDefinition = null) {
        this.name = name;
        this.type = type;
        this.enumDefinition = enumDefinition;
    }
}
module.exports = PropertyDefinition;
