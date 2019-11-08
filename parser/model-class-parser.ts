import LanguageDefinition from "../languages/language-definition";
import { DefinitionHelper, DefinitionTypeHelper, DefinitionPropertyHelper } from "./language-parser";
import ClassDefinition from "./definitions/class-definition";
import ConstructorDefinition from "./definitions/constructor-definition";
import ParameterDefinition from "./definitions/parameter-definition";
import PropertyDefinition from "./definitions/property-definition";
import TypeDefinition from "./definitions/type-definition";
import EnumDefinition from "./definitions/enum-definition";
import MethodDefinition from "./definitions/method-definition";
import Parser from "./parser-interface";
import { ClassSettings } from "../configuration";
import { YamlType } from "./swagger-objects-representation/definition";

export default class ModelClassParser implements Parser {
    languageDefinition: LanguageDefinition;
    definition: DefinitionHelper;
    configuration: ClassSettings;
    thisKeyword: PropertyDefinition;
    
    constructor(languageDefinition: LanguageDefinition, definition: DefinitionHelper, configuration: ClassSettings) {
        this.languageDefinition = languageDefinition;
        this.definition = definition;
        this.configuration = configuration;
        this.thisKeyword = new PropertyDefinition(this.languageDefinition.thisKeyword, new TypeDefinition(this.definition.name));
    }

    parse(): ClassDefinition {
        const className = this.definition.name;

        const enums = this.parseEnums(this.definition.properties);

        const properties = this.parseProperties();
        
        let inherits = null;
        if (this.configuration.inheritsFrom) {
            inherits = TypeDefinition.typeBySplittingPackageAndName(this.configuration.inheritsFrom, className);
        }
        const implementsInterfaces = this.configuration.implementsInterfaces.map((interfaceString) => {
            return TypeDefinition.typeBySplittingPackageAndName(interfaceString, className);
        });

        let dependencies = ModelClassParser.parseDependencies(this.definition, this.configuration);
        dependencies = [
            'java.util.Objects',
            inherits ? inherits.package : null,
            ...implementsInterfaces.map((interfaceType) => {
                return interfaceType.package;
            }),
            ...dependencies,
        ].filter((dependency) => {
            return dependency !== null;
        });

        const methods = [this.getCopyMethod(properties),
            this.getIsEqualMethod(properties)];

        if (this.languageDefinition.hashCodeMethodName) {
            methods.push(this.getHashCodeMethod(properties));
        }

        const constructors = [this.parseConstructors(properties)];

        const packageString = this.configuration.package;

        const classDefinition = new ClassDefinition(packageString, className, properties, constructors, methods, enums, dependencies, true);
        classDefinition.inheritsFrom = inherits;
        classDefinition.implements = implementsInterfaces;
        return classDefinition;
    }

    static parseDependencies(definition: DefinitionHelper, configuration: ClassSettings): Array<string> {
        return definition.references.map((reference) => {
            return `${configuration.package}.${reference.definition.name}`;
        });
    }

    parseConstructors(properties: Array<PropertyDefinition>): ConstructorDefinition {
        return new ConstructorDefinition(this.definition.name, properties.map((property) => {
            property.modifiers.push(this.languageDefinition.constKeyword);
            return ParameterDefinition.fromProperty(property);
        }));
    }

    parseEnums(properties: Array<DefinitionPropertyHelper>): Array<EnumDefinition> {
        return properties.map((property) => {
            if (!property.enum) {
                return null;
            }

            const enumName = property.name.substr(0, 1).toUpperCase() + property.name.substr(1);
            property.type = new DefinitionTypeHelper(enumName, new DefinitionTypeHelper(property.type.name), true);
            return new EnumDefinition(enumName, property.enum);
        }).filter((elements) => {
            return elements != null;
        });
    }

    getCopyMethod(properties: Array<PropertyDefinition>): MethodDefinition {
        const values = properties.map((property) => {
            return this.languageDefinition.callProperty(
                new PropertyDefinition(this.languageDefinition.thisKeyword, new TypeDefinition(this.definition.name)),
                property, false);
        });
        const constructObject = this.languageDefinition.constructObject(new TypeDefinition(this.definition.name), values);
        
        const body = `\t\t${this.languageDefinition.returnDeclaration(constructObject)}`;

        return new MethodDefinition('copy', new TypeDefinition(this.definition.name), null, body, null);
    }

    getIsEqualMethod(properties: Array<PropertyDefinition>): MethodDefinition {
        let objectName = 'other';

        const returnFalse = `${this.languageDefinition.returnDeclaration(this.languageDefinition.falseKeyword)}`;
        let body = `\t\t${this.languageDefinition.ifNullStatement(objectName, returnFalse)}\n`;

        if (this.languageDefinition.isTypeSafeLanguage) {
            body += `\t\t${this.languageDefinition.ifStatement(
                this.languageDefinition.compareTypeOfObjectsMethod(this.languageDefinition.thisKeyword, objectName, true), returnFalse)}\n`;
            const cast = this.languageDefinition.cast(objectName, new TypeDefinition(this.definition.name));
            objectName = 'otherObj';
            body += `\t\t${this.languageDefinition.variableDeclaration(
                this.languageDefinition.constKeyword,
                new TypeDefinition(this.definition.name),
                objectName,
                cast)}\n`;
        }

        body += properties.map((property) => {
            const type = new TypeDefinition(this.languageDefinition.stringKeyword);
            const thisPropertyName = new PropertyDefinition(
                this.languageDefinition.callProperty(this.thisKeyword, property, property.type.name === this.languageDefinition.arrayKeyword), 
                property.type);
            const object = new PropertyDefinition(objectName, new TypeDefinition(this.definition.name));
            const objectPropertyName = new PropertyDefinition(this.languageDefinition.callProperty(object, property, false), type);

            switch (property.type.name) {
                case this.languageDefinition.intKeyword:
                case this.languageDefinition.numberKeyword:
                case this.languageDefinition.booleanKeyword:
                    return `\t\t${this.languageDefinition.ifStatement(
                        this.languageDefinition.simpleComparison(thisPropertyName, objectPropertyName, true), returnFalse)}`;
                case this.languageDefinition.arrayKeyword:
                    return this.arrayComparison(thisPropertyName, objectPropertyName, returnFalse);
                case this.languageDefinition.arrayKeyword:
                default:
                    return `\t\t${this.languageDefinition.ifStatement(
                        this.languageDefinition.equalMethod(thisPropertyName, objectPropertyName, true), returnFalse)}`;
            }
        }).join('\n');

        body += `\n\t\t${this.languageDefinition.returnDeclaration(this.languageDefinition.trueKeyword)}`;
        return new MethodDefinition(
            this.languageDefinition.equalMethodName,
            new TypeDefinition(this.languageDefinition.booleanKeyword),
            [new ParameterDefinition('other', new TypeDefinition(this.languageDefinition.anyTypeKeyword, false, null, false, true))],
            body,
            [this.languageDefinition.overrideKeyword]);
    }

    private arrayComparison(thisPropertyName: PropertyDefinition, objectPropertyName: PropertyDefinition, returnFalse: string): string {
        let var1 = new PropertyDefinition(this.languageDefinition.arrayComparison(thisPropertyName, objectPropertyName, false), new TypeDefinition(this.languageDefinition.booleanKeyword));
        const var2 = new PropertyDefinition(this.languageDefinition.falseKeyword, new TypeDefinition(this.languageDefinition.booleanKeyword));

        if (thisPropertyName.type.nullable) {
            objectPropertyName.name += '!!';
            var1 = new PropertyDefinition(this.languageDefinition.arrayComparison(thisPropertyName, objectPropertyName, false), new TypeDefinition(this.languageDefinition.booleanKeyword));
            return `\t\t${this.languageDefinition.ifStatement(this.languageDefinition.simpleComparison(var1, var2, false), returnFalse)}`;
        } else {
            return `\t\t${this.languageDefinition.ifStatement(this.languageDefinition.arrayComparison(thisPropertyName, objectPropertyName, true), returnFalse)}`;
        }
    }

    getHashCodeMethod(properties: Array<PropertyDefinition>): MethodDefinition {
        const caller = new PropertyDefinition('Objects', new TypeDefinition('Objects'));
        const result = this.languageDefinition.methodCall(caller, 'hash', properties.map((property) => {
            return property.name;
        }));

        let body = `\t\t${this.languageDefinition.returnDeclaration(result)}`;

        return new MethodDefinition(
            this.languageDefinition.hashCodeMethodName,
            new TypeDefinition(this.languageDefinition.intKeyword),
            [],
            body,
            [this.languageDefinition.overrideKeyword]);
    }

    parseProperties(): Array<PropertyDefinition> {
        return this.definition.properties.map((property) => {
            const propertyType = ModelClassParser.getPropertyType(this.languageDefinition, property.type, property.required);
            return new PropertyDefinition(property.name, propertyType, property.default);
        });
    }

    static getPropertyType(languageDefinition: LanguageDefinition, type: DefinitionTypeHelper, required: boolean): TypeDefinition {
        let isEnum = false;
        if (type.isEnum) {
            isEnum = true;
        }

        if (type.name === YamlType.TYPE_STRING) {
            return new TypeDefinition(languageDefinition.stringKeyword, true, null, isEnum, !required);
        }
        if (type.name === YamlType.TYPE_NUMBER) {
            return new TypeDefinition(languageDefinition.numberKeyword, true, null, isEnum, !required);
        }
        if (type.name === YamlType.TYPE_INTEGER) {
            return new TypeDefinition(languageDefinition.intKeyword, true, null, isEnum, !required);
        }
        if (type.name === YamlType.TYPE_BOOLEAN) {
            return new TypeDefinition(languageDefinition.booleanKeyword, true, null, isEnum, !required);
        }
        if (type.name === YamlType.TYPE_ARRAY) {
            return new TypeDefinition(languageDefinition.arrayKeyword, false, this.getPropertyType(languageDefinition, type.subType, true), isEnum, !required);
        }
        if (type.name === YamlType.TYPE_OBJECT) {
            return new TypeDefinition(languageDefinition.mapKeyword, false, null, isEnum, !required);
        }

        return new TypeDefinition(type.name, false, type.subType ? this.getPropertyType(languageDefinition, type.subType, required) : null, isEnum, !required);
    }
}