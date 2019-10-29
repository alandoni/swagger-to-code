import { DefinitionPropertyHelper } from "../language-parser";

class YamlDefinition {
    name: string;
    type: YamlType;
    properties: Array<YamlProperty>;
    required: Array<string>;

    constructor(name: string, type: YamlType, properties: Array<YamlProperty>, required: Array<string>) {
        this.name = name;
        this.type = type;
        this.properties = properties;
        this.required = required;
    }
}

class YamlProperty {
    name: string;
    type: YamlType;
    defaultValue: string;
    enum: Array<string>;
    properties: Array<YamlProperty>;

    constructor(name: string, type: YamlType, properties: Array<YamlProperty>, defaultValue: string, enumValues: Array<string>) {
        this.name = name;
        this.type = type;
        this.defaultValue = defaultValue;
        this.enum = enumValues;
        this.properties = properties;
    }

    static fromDefinitionPropertyHelper(property: DefinitionPropertyHelper): YamlProperty {
        return new YamlProperty(
            property.name, 
            new YamlType(property.type, property.items),
            property.subProperties ? property.subProperties.map((property) => {
                return YamlProperty.fromDefinitionPropertyHelper(property);
            }) : null,
            property.default,
            property.enum
        )
    }
}

class YamlType {
    name: string;
    items: YamlType;
    constructor(name: string, items: YamlType) {
        this.name = name;
        this.items = items;
    }
}

export {
    YamlDefinition,
    YamlProperty,
    YamlType,
};