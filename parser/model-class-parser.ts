import LanguageDefinition from "../languages/language-definition";
import { DefinitionHelper } from "./language-parser";
import ClassDefinition from "./definitions/class-definition";
import ConstructorDefinition from "./definitions/constructor-definition";
import ParameterDefinition from "./definitions/parameter-definition";
import PropertyDefinition from "./definitions/property-definition";
import TypeDefinition from "./definitions/type-definition";
import EnumDefinition from "./definitions/enum-definition";
import MethodDefinition from "./definitions/method-definition";

export default class ModelClassParser {
    languageDefinition: LanguageDefinition;
    definition: DefinitionHelper;
    
    constructor(languageDefinition: LanguageDefinition, definition: DefinitionHelper) {
        this.languageDefinition = languageDefinition;
        this.definition = definition
    }

    parse() {
        const className = this.definition.name;
        const properties = this.parseProperties();
        
        const dependencies = ModelClassParser.parseDependencies(this.definition);

        const enums = this.parseEnums(properties);

        const methods = [this.getCopyMethod(properties),
            this.getIsEqualMethod(properties)];

        const constructors = [this.parseConstructors(properties)];

        return new ClassDefinition(className, properties, constructors, methods, enums, dependencies, true);
    }

    static parseDependencies(definition: DefinitionHelper): Array<DefinitionHelper> {
        return definition.references.map((reference) => {
            return reference.definition;
        });
    }

    parseConstructors(properties) {
        return new ConstructorDefinition(this.definition.name, properties.map((property) => {
            return ParameterDefinition.fromProperty(property, [this.languageDefinition.constKeyword]);
        }));
    }

    parseEnums(properties) {
        return properties.map((property) => {
            if (!property.enum) {
                return null;
            }

            const enumName = property.name.substr(0, 1).toUpperCase() + property.name.substr(1);
            return new EnumDefinition(enumName, property.enum);
        }).filter((elements) => {
            return elements != null;
        });
    }

    getCopyMethod(properties) {
        const values = properties.map((property) => {
            return `${this.languageDefinition.thisKeyword}.${property.name}`;
        });
        const constructObject = this.languageDefinition.constructObject(new TypeDefinition(this.definition.name), values);
        
        const body = `\t\t${this.languageDefinition.returnDeclaration(constructObject)}`;

        return new MethodDefinition('copy', new TypeDefinition(this.definition.name), null, body, null);
    }

    getIsEqualMethod(properties) {
        const returnFalse = `\t\t\t${this.languageDefinition.returnDeclaration(this.languageDefinition.falseKeyword)}`;
        let body = `\t\t${this.languageDefinition.ifNullStatement('obj', returnFalse)}\n`;

        if (this.languageDefinition.isTypesafeLanguage) {
            body += `\t\t${this.languageDefinition.ifStatement(
                this.languageDefinition.compareTypeOfObjectsMethod(this.languageDefinition.thisKeyword, 'obj', true), returnFalse)}\n`;
        }

        body += properties.map((property) => {
            switch (property.type) {
                case this.languageDefinition.intKeyword:
                case this.languageDefinition.numberKeyword:
                case this.languageDefinition.booleanKeyword:
                    return `\t\t${this.languageDefinition.ifStatement(
                        this.languageDefinition.simpleComparison(`${this.languageDefinition.thisKeyword}.${property.name}`, `obj.${property.name}`, true), returnFalse)}`;
                default:
                    return `\t\t${this.languageDefinition.ifStatement(
                        this.languageDefinition.equalMethod(`${this.languageDefinition.thisKeyword}.${property.name}`, `obj.${property.name}`, true), returnFalse)}`;
            }
        }).join('\n');

        body += `\n\t\t${this.languageDefinition.returnDeclaration(this.languageDefinition.trueKeyword)}`;
        return new MethodDefinition(
            this.languageDefinition.equalMethodName,
            new TypeDefinition(this.languageDefinition.booleanKeyword),
            [new ParameterDefinition('obj', new TypeDefinition(this.languageDefinition.anyTypeKeyword))],
            body,
            null);
    }

    parseProperties(): Array<PropertyDefinition> {
        return this.definition.properties.map((property) => {
            const propertyType = ModelClassParser.getPropertyType(this.languageDefinition, property);
            return new PropertyDefinition(property.name, propertyType, property.default, property.required);
        });
    }

    static getPropertyType(languageDefinition, property): TypeDefinition {
        let isEnum = false;
        if (property.enum) {
            isEnum = true;
        }

        if (property.type === 'string') {
            return new TypeDefinition(languageDefinition.stringKeyword, true, null, isEnum);
        }
        if (property.type === 'number') {
            return new TypeDefinition(languageDefinition.numberKeyword, true, null, isEnum);
        }
        if (property.type === 'integer') {
            return new TypeDefinition(languageDefinition.intKeyword, true, null, isEnum);
        }
        if (property.type === 'boolean') {
            return new TypeDefinition(languageDefinition.booleanKeyword, true, null, isEnum);
        }
        if (property.type === 'array') {
            return new TypeDefinition(languageDefinition.arrayKeyword, true, this.getPropertyType(languageDefinition, property.items), isEnum);
        }
        if (property.type === 'object') {
            return new TypeDefinition(languageDefinition.mapKeyword, false, null, isEnum);
        }

        return new TypeDefinition(property.type.name || property.type, false, null, isEnum);
    }
}