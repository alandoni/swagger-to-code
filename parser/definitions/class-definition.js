class ClassDefinition {
    constructor(name, properties, enums = []) {
        this.name = name;
        this.properties = properties;
        this.enums = enums;
    }
}
module.exports = ClassDefinition;
