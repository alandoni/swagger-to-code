import Parser from "../parser-interface";
import ClassDefinition from "../definitions/class-definition";
import LanguageDefinition from "../../languages/language-definition";
import { PathHelper } from "../yaml-paths-to-api-helper-converter";
import { LanguageSettings, TypeOfClass } from "../../configuration";
import PropertyDefinition from "../definitions/property-definition";
import TypeDefinition from "../definitions/type-definition";
import { YamlType } from "../swagger-objects-representation/definition";
import ConstructorDefinition from "../definitions/constructor-definition";
import ParameterDefinition from "../definitions/parameter-definition";
import MethodDefinition from "../definitions/method-definition";
import ModelClassParser from "./model-class-parser";
import { DefinitionTypeHelper, DefinitionPropertyHelper } from "../yaml-definition-to-definition-helper-converter";
import ArrayUtils from "../../array-utils";

export default class ApiClassParser implements Parser {
    languageDefinition: LanguageDefinition;
    api: PathHelper;
    configuration: LanguageSettings;
    thisKeyword: PropertyDefinition;
    
    constructor(languageDefinition: LanguageDefinition, api: PathHelper, configuration: LanguageSettings) {
        this.languageDefinition = languageDefinition;
        this.api = api;
        this.configuration = configuration;
        this.thisKeyword = new PropertyDefinition(this.languageDefinition.thisKeyword, new TypeDefinition(this.api.name));
    }

    parse(): ClassDefinition {
        const className = this.api.name;

        let inherits = null;

        const types = [
            this.api.requestDefinition,
            this.api.urlRequestDefinition,
        ].filter((type) => {
            return type != null;
        });

        const classSettings = this.configuration.getClassSettings(TypeOfClass.API_CLASSES);
        if (classSettings.inheritsFrom) {
            inherits = TypeDefinition.typeBySplittingPackageAndName(classSettings.inheritsFrom, className);
        }
        const implementsInterfaces = classSettings.implementsInterfaces.map((interfaceString) => {
            return TypeDefinition.typeBySplittingPackageAndName(interfaceString, className);
        });

        let dependencies = this.parseDependencies(inherits, implementsInterfaces, types);

        const properties = this.parseProperties(types);

        const constructors = [this.parseConstructors(properties)];

        const methods = [
            this.getUrl(),
            this.getMethod(),
            this.getBody(),
        ];

        const packageString = classSettings.package;

        const classDefinition = new ClassDefinition(packageString, className, properties, constructors, methods, null, dependencies, false);
        classDefinition.inheritsFrom = inherits;
        classDefinition.implements = implementsInterfaces;
        return classDefinition;
    }

    parseDependencies(inherits: TypeDefinition, implementsInterfaces: Array<TypeDefinition>, properties: Array<DefinitionPropertyHelper>): Array<string> {
        const allTypes = [
            ...properties.filter((property) => {
                return property.type.name !== YamlType.TYPE_STRING;
            }).map((property) => {
                return property.type;
            }),
            this.api.successResponseDefinition,
            this.api.failureResponseDefinition
        ].filter((type) => {
            return type && type.name !== YamlType.TYPE_STRING && type.name !== YamlType.TYPE_ARRAY;
        });
        let dependenciesOfRefs = allTypes.map((type) => {
            return `${this.configuration.getClassSettings(TypeOfClass.MODEL_CLASSES).package}.${type.name}`;
        });
        dependenciesOfRefs = ArrayUtils.removeDuplicates(dependenciesOfRefs);

        return [
            inherits ? inherits.package : null,
            ...implementsInterfaces.map((interfaceType) => {
                return interfaceType.package;
            }),
            ...dependenciesOfRefs,
        ].filter((dependency) => {
            return dependency !== null;
        });
    }

    parseProperties(types: Array<DefinitionPropertyHelper>): Array<PropertyDefinition> {
        return types.map((property) => {
            return new PropertyDefinition(
                property.name, 
                ModelClassParser.getPropertyType(this.languageDefinition, new DefinitionTypeHelper(property.type.name), true),
                null, 
                []);
        });
    }

    parseConstructors(types: Array<PropertyDefinition>) {
        return new ConstructorDefinition(this.api.name, types.map((property) => {
            property.modifiers.push(this.languageDefinition.privateKeyword);
            property.modifiers.push(this.languageDefinition.constKeyword);
            return ParameterDefinition.fromProperty(property);
        }));
    }

    getMethod(): MethodDefinition {
        const method = this.languageDefinition.stringDeclaration(this.api.method);
        const body = `\t\t${this.languageDefinition.returnDeclaration(method)}`;
        return new MethodDefinition('getMethod', new TypeDefinition(this.languageDefinition.stringKeyword), null, body, null);
    }

    getUrl(): MethodDefinition {
        let url = this.api.url.replace(/{\w+}/, this.languageDefinition.stringReplacement);
        let arrayOfParams = [];
        let nullableParams = [];
        if (this.api.urlRequestDefinition) {
            if (this.api.urlRequestDefinition.subProperties) {
                url += '?';
                let params = [];
                this.api.urlRequestDefinition.subProperties.forEach((property) => {
                    const param = `${this.api.urlRequestDefinition.name}.${property.name}`;
                    if (property.required) {
                        params.push(`${property.name}=${this.languageDefinition.stringReplacement}`);
                    } else {
                        const stringDeclaration = this.languageDefinition.stringDeclaration(`${property.name}=${this.languageDefinition.stringReplacement}`);
                        const format = this.languageDefinition.methodCall(
                            new PropertyDefinition(stringDeclaration, new TypeDefinition(this.languageDefinition.stringKeyword)), 
                            'format', 
                            [param]);
                        const body = this.languageDefinition.methodCall(
                            new PropertyDefinition('params', new TypeDefinition(this.languageDefinition.arrayListKeyword)), 
                            'add',
                            [format]);
                        const ifNotNull = `\t\t${this.languageDefinition.ifNotNullStatement(param, body)}`;
                        nullableParams.push(ifNotNull);
                    }
                    arrayOfParams.push(param);
                });
                params.join('&');
            } else {
                arrayOfParams.push(this.api.urlRequestDefinition.name);
            }
        }
        let urlString = this.languageDefinition.stringDeclaration(url);
        let format = urlString;
        if (arrayOfParams.length > 0) {
            format = this.languageDefinition.methodCall(
                new PropertyDefinition(urlString, new TypeDefinition(this.languageDefinition.stringKeyword)), 
                'format', 
                arrayOfParams);
        }

        let body: string;
        if (nullableParams.length > 0) {
            const bodyLines = [];

            let listConstruct = this.languageDefinition.arrayListKeyword;
            if (this.languageDefinition.shouldConstructList) {
                listConstruct = this.languageDefinition.constructObject(new TypeDefinition(this.languageDefinition.arrayListKeyword), null);
            }
            const listDeclaration = this.languageDefinition.variableDeclaration(
                this.languageDefinition.constKeyword, 
                new TypeDefinition(this.languageDefinition.arrayListKeyword, false, new TypeDefinition(this.languageDefinition.stringKeyword)),
                'params',
                listConstruct);

            bodyLines.push(`\t\t${listDeclaration}`);
            bodyLines.push(...nullableParams);
            const joinMethod = this.languageDefinition.methodCall(
                new PropertyDefinition('params', new TypeDefinition(this.languageDefinition.arrayListKeyword)),
                this.languageDefinition.joinMethod,
                [this.languageDefinition.stringDeclaration('&')]);
            const returnObject = this.languageDefinition.appendString(urlString, joinMethod);
            bodyLines.push(`\t\t${this.languageDefinition.returnDeclaration(returnObject)}`);
            body = bodyLines.join('\n');
        } else {
            body = `\t\t${this.languageDefinition.returnDeclaration(format)}`;
        }
        return new MethodDefinition('getUrl', new TypeDefinition(this.languageDefinition.stringKeyword), null, body, null);
    }

    getBody() {
        let returnObject = this.languageDefinition.nullKeyword;
        let type = new TypeDefinition(this.languageDefinition.stringKeyword, true, null, false, true);
        if (this.api.requestDefinition) {
            returnObject = this.api.requestDefinition.name;
            type = new TypeDefinition(this.api.requestDefinition.type.name);
        }
        const body = `\t\t${this.languageDefinition.returnDeclaration(returnObject)}`;
        return new MethodDefinition('getBody', type, null, body, null);
    }
}