import { DefinitionPropertyHelper, DefinitionTypeHelper } from "../language-parser";

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

    static fromObject(definition: any): YamlDefinition {
        let name, properties, requiredProperties, type;
        name = definition[0];
        properties = definition[1].properties ? YamlProperty.fromObject(definition[1].properties) : null;
        requiredProperties = definition[1].required;
        type = new YamlType(definition[1].type || definition[1].$ref, null);
        return new YamlDefinition(name, type, properties, requiredProperties);
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
            YamlType.fromDefinitionTypeHelper(property.type),
            property.subProperties ? property.subProperties.map((property) => {
                return YamlProperty.fromDefinitionPropertyHelper(property);
            }) : null,
            property.default,
            property.enum
        )
    }

    static fromObject(properties: any) {
        return Object.entries(properties).map((property: Array<any>) => {
            const name = property[0];

            let type = null;

            if (property[1].items && property[1].items.properties) {
                type = new YamlTypeWithObject(property[1].name, property[1].items.properties, property[1].items.required);
            } else {
                const typeName = property[1].type || property[1].$ref;
                const typeItem = property[1].items ? new YamlType(property[1].items.type || property[1].items.$ref, null, !!property[1].items.enum) : null;
                type = new YamlType(typeName, typeItem, !!property[1].enum);
            }

            const defaultValue = property[1].default;
            const enumValues = property[1].enum;
            let subProperties = null;
            if (property[1].properties) {
                subProperties = YamlProperty.fromObject(property[1].properties);
            }
            return new YamlProperty(name, type, subProperties, defaultValue, enumValues);
        });
    }
}

class YamlType {
    static TYPE_STRING = 'string';
    static TYPE_NUMBER = 'number';
    static TYPE_INTEGER = 'integer';
    static TYPE_BOOLEAN = 'boolean';
    static TYPE_OBJECT = 'object';
    static TYPE_ARRAY = 'array';

    name: string;
    items: YamlType;
    isEnum: boolean;

    constructor(name: string, items: YamlType, isEnum: boolean = false) {
        if (!name) {
            throw new Error('You must define a name');
        }
        this.name = name;
        this.items = items;
        this.isEnum = isEnum;
    }

    static fromDefinitionTypeHelper(type: DefinitionTypeHelper) : YamlType {
        return new YamlType(type.name, type.subType ? YamlType.fromDefinitionTypeHelper(type.subType) : null, type.isEnum);
    }
}

class YamlTypeWithObject extends YamlType {
    properties: Array<YamlProperty>;
    requiredProperties: Array<string>;

    constructor(type: string, properties: Array<YamlProperty>, requiredProperties: Array<string>) {
        super(type, null, false);
        this.properties = properties;
        this.requiredProperties = requiredProperties;
    }
}

export {
    YamlDefinition,
    YamlProperty,
    YamlType,
    YamlTypeWithObject,
};