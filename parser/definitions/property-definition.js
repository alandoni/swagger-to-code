class PropertyDefinition {
    constructor(name, type, enumDefinition = null, required = false, subtype = null) {
        this.name = name;
        this.type = type;
        this.enumDefinition = enumDefinition;
        this.required = required;
        this.subtype = subtype;
    }
}
module.exports = PropertyDefinition;
