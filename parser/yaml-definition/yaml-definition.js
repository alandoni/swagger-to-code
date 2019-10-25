const YamlDefinitionProperty = require('./yaml-definition-property');

class YamlDefinition {
    constructor(name, needsTable, properties, requiredProperties) {
        this.name = name;
        this.needsTable = needsTable;

        if (properties) {
            this.properties = Object.entries(properties).map((property) => {
                return new YamlDefinitionProperty(
                    property[0],
                    property[1].type || property[1].$ref,
                    requiredProperties ? requiredProperties.indexOf(property[0]) > -1 : false,
                    property[1].properties || null,
                    property[1].default,
                    property[1].enum,
                    property[1].items);
            });
        }
        this.requiredProperties = requiredProperties;
        this.references = [];
    }

    addReference(otherDefinition) {
        this.references.push(otherDefinition);
    }
}

module.exports = YamlDefinition;