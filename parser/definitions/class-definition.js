class ClassDefinition {
    constructor(name, properties, enums = [], dependencies = [], needsTable) {
        this.name = name;
        this.properties = properties;
        this.enums = enums;
        this.dependencies = dependencies;
        this.needsTable = needsTable;
    }
}
module.exports = ClassDefinition;
