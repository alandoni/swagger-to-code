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

  constructor(name: string, type: YamlType, defaultValue: string, enumValues: Array<string>) {
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;
    this.enum = enumValues;
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