class YamlDefinitionProperty {
    constructor(name, type, required, subProperties, defaultValue, enumValues, arrayItems) {
        this.name = name;
        this.type = this.getTypeReferingToAnotherClass(type);
        this.required = required;
        this.enum = enumValues;
        this.default = defaultValue;
        this.items = arrayItems;
        this.refersTo = null;
        
        if (this.items && this.items.$ref) {
            this.items.type = this.getTypeReferingToAnotherClass(this.items.$ref);
            delete this.items.$ref;
        }

        if (subProperties) {
            this.subProperties = Object.entries(subProperties).map((property) => {
                return new YamlDefinitionProperty(
                    property[0],
                    property[1].type || property[1].$ref,
                    property[1].requiredProperties ? property[1].requiredProperties.indexOf(property[0]) > -1 : false,
                    property[1].properties || []);
            });
        }
    }

    setReference(reference) {
        this.refersTo = reference;
    }

    getTypeReferingToAnotherClass(type) {
        const definitionsString = '#/definitions/';
        const definitionIndex = type.indexOf(definitionsString);
        if (definitionIndex > -1) {
            return type.substr(definitionIndex + definitionsString.length);
        }
        return type;
    }
}

module.exports = YamlDefinitionProperty;