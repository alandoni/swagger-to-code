import { DefinitionPropertyHelper, DefinitionTypeHelper } from "../yaml-definition-to-definition-helper-converter";

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
        type = YamlType.fromObject(definition[1]);
        return new YamlDefinition(name, type, properties, requiredProperties);
    }
}

class YamlProperty {
    name: string;
    type: YamlType;
    defaultValue: string;
    enum: Array<string>;
    properties: Array<YamlProperty>;

    constructor(name: string, type: YamlType, properties: Array<YamlProperty> = null, defaultValue: string = null, enumValues: Array<string> = null) {
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
                type = YamlType.fromObject(property[1]);
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

    constructor(name: string, items: YamlType = null, isEnum: boolean = false) {
        if (!name) {
            throw new Error('You must define a name');
        }
        this.name = YamlType.getTypeReferingToAnotherClass(name);
        this.items = items;
        this.isEnum = isEnum;
    }

    static fromDefinitionTypeHelper(type: DefinitionTypeHelper) : YamlType {
        return new YamlType(type.name, type.subType ? YamlType.fromDefinitionTypeHelper(type.subType) : null, type.isEnum);
    }

    static fromObject(object: any) {
        const typeName = object.type || object.$ref;
        const typeItem = object.items ? new YamlType(object.items.type || object.items.$ref, null, !!object.items.enum) : null;
        return new YamlType(typeName, typeItem, !!object.enum);
    }

    static getTypeReferingToAnotherClass(type: string): string {
        const definitionsString = '#/definitions/';
        const definitionIndex = type.indexOf(definitionsString);
        if (definitionIndex > -1) {
            return type.substr(definitionIndex + definitionsString.length);
        }
        return type;
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

class YamlTag {
    name: string;

    constructor(name: string) {
        this.name = name;
    }
}

class YamlPath {
    static METHOD_GET = 'GET';
    static METHOD_POST = 'POST';
    static METHOD_PUT = 'PUT';
    static METHOD_DELETE = 'DELETE';

    path: string;
    method: string;
    tags: Array<YamlTag>;
    parameters: Array<YamlPathParameter>;
    responses: Array<YamlPathResponse>;

    constructor(path: string, method: string, tags: Array<YamlTag>, parameters: Array<YamlPathParameter>, responses: Array<YamlPathResponse>) {
        this.path = path;

        switch (method) {
            case 'get':
                this.method = YamlPath.METHOD_GET;
                break;
            case 'put':
                    this.method = YamlPath.METHOD_PUT;
                    break;
            case 'delete':
                    this.method = YamlPath.METHOD_DELETE;
                    break;
            default:
                this.method = YamlPath.METHOD_POST;
                break;
        }
        this.tags = tags;
        this.parameters = parameters;
        this.responses = responses;
    }
}

class YamlPathParameter {
    static TYPE_BODY = 'TYPE_BODY';
    static TYPE_QUERY = 'TYPE_QUERY';
    static TYPE_PATH = 'TYPE_PATH';

    type: string;
    name: string;
    required: boolean;
    schema: YamlDefinition;

    constructor(type: string, name: string, required: boolean, schema: YamlDefinition) {
        this.name = name;
        this.required = required;
        this.schema = schema;

        switch(type) {
            case 'body':
                this.type = YamlPathParameter.TYPE_BODY;
                this.name = 'body';
                break;
            case 'query':
                this.type = YamlPathParameter.TYPE_QUERY;
                break;
            default:
                this.type = YamlPathParameter.TYPE_PATH;
        }
    }
}

class YamlPathResponse {
    statusCode: number;
    description: string;
    schema: YamlDefinition;

    constructor(statusCode: number, description: string, schema: YamlDefinition) {
        this.statusCode = statusCode;
        this.description = description;
        this.schema = schema;
    }
}

export {
    YamlDefinition,
    YamlProperty,
    YamlType,
    YamlTypeWithObject,
    YamlTag,
    YamlPath,
    YamlPathParameter,
    YamlPathResponse,
};