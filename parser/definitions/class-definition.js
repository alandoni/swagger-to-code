class ClassDefinition {
    constructor(name, properties, enums = [], dependencies = []) {
        this.name = name;
        this.properties = properties;
        this.enums = enums;
        this.dependencies = dependencies;
    }
}
module.exports = ClassDefinition;
