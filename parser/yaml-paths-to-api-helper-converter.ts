import { LanguageSettings } from '../configuration';
import LanguageDefinition from '../languages/language-definition';
import { YamlPath, YamlTag, YamlPathParameter, YamlPathResponse, YamlType, YamlDefinition } from './swagger-objects-representation/definition';
import { DefinitionHelper } from './yaml-definition-to-definition-helper-converter';

export default class YamlPathsToApiHelperConverter {
    languageDefinition: LanguageDefinition;
    configuration: LanguageSettings;
    tags: Map<string, YamlTag>;

    convert(object: any, language: LanguageDefinition, configuration: LanguageSettings): Array<YamlPath> {
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
                paths.push(yamlPath);
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
                schema = YamlType.fromObject(parameter.schema);
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
                schema = YamlType.fromObject(response[1].schema);
            }
            return new YamlPathResponse(status, description, schema);
        });
    }
}

class PathHelper {
    name: string;
    url: string;
    method: string;
    tag: YamlTag;
    requestObject: YamlDefinition;
    successResponseObject: YamlDefinition;
    failureResponseObject: Array<YamlDefinition>;

    constructor(name: string, url: string, method: string, tag: YamlTag, requestObject: YamlDefinition, successResponseObject: YamlDefinition, failureResponseObject: Array<YamlDefinition>) {
        this.name = name;
        this.url = url;
        this.method = method;
        this.tag = tag;
        this.requestObject = requestObject;
        this.successResponseObject = successResponseObject;
        this.failureResponseObject = failureResponseObject;
    }

    static fromYamlPath(path: YamlPath): PathHelper {
        const name = `${path.method}${path.path}`;

        return new PathHelper(name, path.path, path.method, path.tags[0], null, null, null);
    }
}

export { PathHelper };