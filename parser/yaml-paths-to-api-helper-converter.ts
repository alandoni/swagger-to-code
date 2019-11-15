import { LanguageSettings } from '../configuration';
import LanguageDefinition from '../languages/language-definition';
import { YamlPath, YamlTag, YamlPathParameter, YamlPathResponse, YamlType, YamlProperty, YamlDefinition } from './swagger-objects-representation/definition';
import { DefinitionHelper, DefinitionPropertyHelper } from './yaml-definition-to-definition-helper-converter';
import StringUtils from '../string-utils';

export default class YamlPathsToApiHelperConverter {
    languageDefinition: LanguageDefinition;
    configuration: LanguageSettings;
    tags: Map<string, YamlTag> = new Map();

    convert(object: any, definitions: Map<string, DefinitionHelper>, language: LanguageDefinition, configuration: LanguageSettings): Array<PathHelper> {
        this.configuration = configuration;
        this.languageDefinition = language;

        const paths = [];
        Object.entries(object.paths).forEach((path) => {
            const url = path[0];
            Object.entries(path[1]).map((method) => {
                const methodString = method[0];
                const properties: any = method[1];
                const tags = this.convertTags(properties.tags);
                const parameters = this.convertParameters(properties.parameters);
                const responses = this.convertResponses(properties.responses);
                const yamlPath = new YamlPath(url, methodString, tags, parameters, responses);
                paths.push(PathHelper.fromYamlPath(yamlPath, definitions));
            });
        });
        return paths;
    }

    convertTags(tags: Array<any>): Array<YamlTag> {
        return tags.map((tag) => {
            const yamlTag = new YamlTag(tag.name || tag);
            this.tags[yamlTag.name] = yamlTag;
            return yamlTag;
        })
    }

    private convertParameters(parameters: Array<any>): Array<YamlPathParameter> {
        if (!parameters) {
            return [];
        }
        return parameters.map((parameter) => {
            const type = parameter.in;
            const name = parameter.name;
            const required = parameter.required;
            let schema = null;
            if (parameter.schema) {
                schema = this.convertSchemaToDefinition(parameter.schema);
            }
            return new YamlPathParameter(type, name, required, schema);
        });
    }

    private convertResponses(responses: Array<any>): Array<YamlPathResponse> {
        return Object.entries(responses).map((response) => {
            const status = Number.parseInt(response[0]);
            const description = response[1];
            let schema = null;
            if (response[1].schema) {
                schema = this.convertSchemaToDefinition(response[1].schema);
            }
            return new YamlPathResponse(status, description, schema);
        });
    }

    private convertSchemaToDefinition(schema: any): YamlDefinition {
        if (schema.type === YamlType.TYPE_OBJECT) {
            return YamlDefinition.fromObject([null, schema]);
        }
        return new YamlDefinition(null, YamlType.fromObject(schema), null, null);
    }
}

class PathHelper {
    name: string;
    url: string;
    method: string;
    tag: YamlTag;
    urlRequestDefinition: DefinitionPropertyHelper;
    requestDefinition: DefinitionPropertyHelper;
    successResponseDefinition: YamlType;
    failureResponseDefinition: YamlType;

    constructor(name: string, url: string, method: string, tag: YamlTag, urlRequestDefinition: DefinitionPropertyHelper, 
        requestDefinition: DefinitionPropertyHelper, successResponseDefinition: YamlType, failureResponseDefinition: YamlType) {
        this.name = name;
        this.url = url;
        this.method = method;
        this.tag = tag;
        this.urlRequestDefinition = urlRequestDefinition;
        this.requestDefinition = requestDefinition;
        this.successResponseDefinition = successResponseDefinition;
        this.failureResponseDefinition = failureResponseDefinition;
    }

    static getNameBasedOnPath(path: YamlPath, sufix: string) {
        let pathParts = path.path.split('/');
        const regex = new RegExp('\{(\\w+)\}');
        
        let alreadyWrittenBy = false;
        let pathString = pathParts.reduce((previous, current, currentIndex) => {
            const regexResult = regex.exec(current);
            let param = current;
            if (regexResult) {
                param = regexResult[1];
            }
            param = StringUtils.firstLetterUpperCase(param);
            if (currentIndex > 1) {
                if (!alreadyWrittenBy) {
                    param = `By${previous}${param}`;
                    alreadyWrittenBy = true;
                } else if (regex.test(previous)) {
                    param = `And${previous}${param}`;
                }
            }
            return previous + param;
        });

        return `${StringUtils.firstLetterUpperCase(path.method)}${pathString}${sufix}`;
    }

    static fromYamlPath(path: YamlPath, definitions: Map<string, DefinitionHelper>): PathHelper {
        const urlRequestParameters = path.parameters.filter((param) => {
            return param.type !== YamlPathParameter.TYPE_BODY;
        });

        let urlRequestType: DefinitionPropertyHelper;
        if (urlRequestParameters && urlRequestParameters.length > 0) {
            if (urlRequestParameters.length === 1) {
                urlRequestType = new DefinitionPropertyHelper(urlRequestParameters[0].name, new YamlType(YamlType.TYPE_STRING));
            } else {
                const urlRequestDefinition = PathHelper.createDefinitionBasedOnUrlParameters(path, urlRequestParameters, definitions);
                const name = StringUtils.firstLetterLowerCase(urlRequestDefinition.name);
                const properties = urlRequestParameters.map((property) => {
                    return new YamlProperty(property.name, new YamlType(YamlType.TYPE_STRING));
                });
                urlRequestType = new DefinitionPropertyHelper(name, new YamlType(urlRequestDefinition.name), false, properties, null, null);
            }
        }

        const requestParameter = path.parameters.filter((param) => {
            return param.type === YamlPathParameter.TYPE_BODY;
        });

        let requestType: DefinitionPropertyHelper;
        if (requestParameter && requestParameter.length > 0) {
            let name = StringUtils.firstLetterLowerCase(requestParameter[0].schema.type.name);
            requestType = new DefinitionPropertyHelper(name, PathHelper.getRequestTypeOrCreateDefinitionIfNeeded(path, '', requestParameter[0], definitions));
        }
        
        const successResponseDefinitions = path.responses.filter((response) => {
            return response.statusCode >= 200 && response.statusCode < 300;
        });
        let successType: YamlType;
        if (successResponseDefinitions && successResponseDefinitions.length > 0) {
            successType = PathHelper.getRequestTypeOrCreateDefinitionIfNeeded(path, 'SuccessResponse', successResponseDefinitions[0], definitions);
        }

        const errorResponseDefinitions = path.responses.filter((response) => {
            return response.statusCode > 300;
        });
        let errorType: YamlType;
        if (errorResponseDefinitions && errorResponseDefinitions.length > 0) {
            errorType = PathHelper.getRequestTypeOrCreateDefinitionIfNeeded(path, 'ErrorResponse', errorResponseDefinitions[0], definitions);
        }

        return new PathHelper(PathHelper.getNameBasedOnPath(path, 'Api'), path.path, path.method, path.tags[0], urlRequestType, requestType, successType, errorType);
    }

    private static getRequestTypeOrCreateDefinitionIfNeeded(path: YamlPath, sufix: string, requestParameter: any, definitions: Map<string, DefinitionHelper>): YamlType {
        if (requestParameter.schema === null) {
            return new YamlType(YamlType.TYPE_STRING);
        }
        const requestDefinitionName = (requestParameter.schema.type.name === YamlType.TYPE_ARRAY && requestParameter.schema.type.items.name) ||
            requestParameter.schema.type.name;
        if (requestDefinitionName === YamlType.TYPE_OBJECT) {
            const name = PathHelper.getNameBasedOnPath(path, sufix);
            const definition = new DefinitionHelper(name, requestParameter.schema.properties, requestParameter.schema.requiredProperties);
            definition.needsTable = false;
            definition.tag = path.tags[0];
            definitions[definition.name] = definition;
            return new YamlType(definition.name);
        } else {
            const definition = definitions[requestParameter.schema.type.name];
            if (definition) {
                definition.tag = path.tags[0];
            }
            return requestParameter.schema.type;
        }
    }

    private static createDefinitionBasedOnUrlParameters(path: YamlPath, urlRequestParameters: Array<YamlPathParameter>, definitions: Map<string, DefinitionHelper>): DefinitionHelper {
        const name = PathHelper.getNameBasedOnPath(path, 'RequestParameters');
        const requiredProperties = [];
        const properties = urlRequestParameters.map((param) => {
            if (param.required) {
                requiredProperties.push(param.name);
            }
            return new YamlProperty(param.name, new YamlType(YamlType.TYPE_STRING));
        });
        const definition = new DefinitionHelper(name, properties, requiredProperties);
        definition.needsTable = false;
        definition.tag = path.tags[0];
        definitions[definition.name] = definition;
        return definition;
    }
}

export { PathHelper };