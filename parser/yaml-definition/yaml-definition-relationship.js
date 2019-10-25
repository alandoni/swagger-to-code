class YamlDefinitionRelationship {

    static get ONE_TO_ONE() {
        return  "ONE_TO_ONE";
    }
    static get ONE_TO_N() {
        return  "ONE_TO_N";
    }
    static get N_TO_ONE() {
        return  "N_TO_ONE";
    }

    constructor(definition, property, relationship) {
        this.definition = definition;
        this.property = property;
        this.relationship = relationship;
    }
}

module.exports = YamlDefinitionRelationship;